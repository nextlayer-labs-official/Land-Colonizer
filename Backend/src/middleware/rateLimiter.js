const prisma = require('../lib/prisma');

// In-memory store: key → { count, resetAt }
const store = new Map();

// Dynamic rate limiter that reads config from CompanySettings on each request
async function loginRateLimiter(req, res, next) {
  try {
    const settings = await prisma.companySettings.findFirst();
    const maxAttempts  = settings?.login_max_attempts   ?? 5;
    const windowMs     = (settings?.login_window_minutes ?? 15) * 60 * 1000;

    const key = req.ip || 'unknown';
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      // Fresh window
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > maxAttempts) {
      const retryAfterSecs = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSecs);
      return res.status(429).json({
        message: `Too many login attempts. Please try again in ${Math.ceil(retryAfterSecs / 60)} minute(s).`,
        retry_after: retryAfterSecs,
      });
    }

    next();
  } catch (err) {
    // If DB is down, don't block login
    next();
  }
}

// Reset attempts on successful login (call after successful auth)
function resetLoginAttempts(ip) {
  store.delete(ip);
}

// Cleanup stale entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 30 * 60 * 1000);

module.exports = { loginRateLimiter, resetLoginAttempts };
