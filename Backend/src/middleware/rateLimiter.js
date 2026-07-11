const prisma = require('../lib/prisma');

// In-memory store: key → { count, resetAt }
const store = new Map();

// Cache settings so we don't hit DB on every login attempt
let cachedSettings = null;
let settingsCachedAt = 0;
const SETTINGS_TTL = 60_000; // refresh every 60s

async function getSettings() {
  if (cachedSettings && Date.now() - settingsCachedAt < SETTINGS_TTL) return cachedSettings;
  try {
    const settings = await prisma.companySettings.findFirst();
    cachedSettings = {
      maxAttempts: settings?.login_max_attempts   ?? 5,
      windowMs:    (settings?.login_window_minutes ?? 15) * 60 * 1000,
    };
    settingsCachedAt = Date.now();
  } catch {
    // If DB is down fall back to defaults
    cachedSettings = { maxAttempts: 5, windowMs: 15 * 60 * 1000 };
  }
  return cachedSettings;
}

async function loginRateLimiter(req, res, next) {
  try {
    const { maxAttempts, windowMs } = await getSettings();

    const key = req.ip || 'unknown';
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
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
  } catch {
    next();
  }
}

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
