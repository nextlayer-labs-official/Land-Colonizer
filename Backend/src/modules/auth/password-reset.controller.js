const crypto = require('crypto');
const bcrypt = require('bcrypt');
const prisma = require('../../lib/prisma');
const { sendMailCritical, isSmtpConfigured } = require('../../lib/mailer');
const { auditLog } = require('../../lib/audit');

// Forgot password: the user gets a 6-digit code by email, verifies it, then sets a new password
const CODE_TTL_MIN       = 10;  // code is valid for this many minutes
const MAX_CODE_ATTEMPTS  = 5;   // wrong tries before the code is voided
const MAX_CODES_PER_HOUR = 5;   // codes one account can request per hour
const MIN_PASSWORD_LEN   = 6;   // same rule as Change Password

// Same reply whether or not the email exists, so the form can't be used to discover accounts
const GENERIC_SENT = 'If an account exists for this email, a verification code has been sent. It expires in 10 minutes.';

const hashCode = (userId, code) => crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');
const cleanEmail = (e) => String(e || '').trim().toLowerCase();

async function companyName() {
  const s = await prisma.companySettings.findFirst();
  return s?.company_name || 'AMS';
}

function emailShell(company, title, body) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#1f2937">
  <div style="background:#875A7B;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;font-weight:700;font-size:16px">${company}</div>
  <div style="border:1px solid #e5e7eb;border-top:0;padding:20px;border-radius:0 0 8px 8px">
    <h2 style="margin:0 0 12px;font-size:18px">${title}</h2>${body}
  </div></div>`;
}

// POST /auth/forgot-password { email }
const forgotPassword = async (req, res) => {
  const email = cleanEmail(req.body?.email);
  if (!email) return res.status(400).json({ message: 'Please enter your email address.' });
  if (!(await isSmtpConfigured())) {
    return res.status(503).json({ message: 'Password reset by email is not set up yet. Please contact your administrator.' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'ACTIVE') return res.json({ message: GENERIC_SENT });

  const recent = await prisma.passwordResetToken.count({
    where: { user_id: user.id, created_at: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_CODES_PER_HOUR) return res.json({ message: GENERIC_SENT });

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.passwordResetToken.updateMany({ where: { user_id: user.id, used: false }, data: { used: true } });
  await prisma.passwordResetToken.create({
    data: { user_id: user.id, token: hashCode(user.id, code), expires_at: new Date(Date.now() + CODE_TTL_MIN * 60 * 1000) },
  });

  const company = await companyName();
  // Sent in the background: the reply comes back immediately (and takes the same time whether or not the
  // account exists), and a slow mail server can't hold up the request
  sendMailCritical({
    to: user.email,
    subject: `${code} is your ${company} password reset code`,
    html: emailShell(company, 'Reset your password', `
      <p style="margin:0 0 12px">Hi ${user.name || ''},</p>
      <p style="margin:0 0 12px">Use this code to reset your password:</p>
      <p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:8px 0 16px;color:#875A7B">${code}</p>
      <p style="margin:0 0 12px;font-size:13px;color:#6b7280">The code expires in ${CODE_TTL_MIN} minutes. If you didn't ask to reset your password, you can ignore this email — your password won't change.</p>`),
  }).then(result => { if (!result?.sent) console.warn('[ForgotPassword] code email not sent:', result?.reason); });

  auditLog({ req, action: 'PASSWORD_RESET_REQUEST', entity: 'auth', userId: user.id });
  res.json({ message: GENERIC_SENT });
};

// Checks the code against the user's latest active reset request; counts wrong attempts
async function checkCode(email, code) {
  const fail = (message) => ({ ok: false, message });
  if (!email || !/^\d{6}$/.test(String(code || ''))) return fail('Enter the 6-digit code from the email.');
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'ACTIVE') return fail('This code is invalid or has expired. Please request a new one.');
  const rec = await prisma.passwordResetToken.findFirst({
    where: { user_id: user.id, used: false, expires_at: { gt: new Date() } },
    orderBy: { created_at: 'desc' },
  });
  if (!rec || rec.attempts >= MAX_CODE_ATTEMPTS) return fail('This code is invalid or has expired. Please request a new one.');

  const a = Buffer.from(hashCode(user.id, String(code))), b = Buffer.from(rec.token);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const attempts = rec.attempts + 1;
    await prisma.passwordResetToken.update({ where: { id: rec.id }, data: { attempts, used: attempts >= MAX_CODE_ATTEMPTS } });
    const left = MAX_CODE_ATTEMPTS - attempts;
    return fail(left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many incorrect attempts. Please request a new code.');
  }
  return { ok: true, user, rec };
}

// POST /auth/verify-reset-code { email, code }
const verifyResetCode = async (req, res) => {
  const r = await checkCode(cleanEmail(req.body?.email), req.body?.code);
  if (!r.ok) return res.status(400).json({ message: r.message });
  res.json({ message: 'Code verified. You can now set a new password.' });
};

// POST /auth/reset-password { email, code, password }
const resetPassword = async (req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < MIN_PASSWORD_LEN) {
    return res.status(400).json({ message: `New password must be at least ${MIN_PASSWORD_LEN} characters.` });
  }
  const r = await checkCode(cleanEmail(req.body?.email), req.body?.code);
  if (!r.ok) return res.status(400).json({ message: r.message });

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: r.user.id }, data: { password: hashed } });
  await prisma.passwordResetToken.updateMany({ where: { user_id: r.user.id, used: false }, data: { used: true } });
  auditLog({ req, action: 'PASSWORD_RESET', entity: 'auth', userId: r.user.id });

  const company = await companyName();
  sendMailCritical({
    to: r.user.email,
    subject: `Your ${company} password was changed`,
    html: emailShell(company, 'Your password was changed', `
      <p style="margin:0 0 12px">Hi ${r.user.name || ''},</p>
      <p style="margin:0 0 12px">The password for your account was just reset using a verification code sent to this email.</p>
      <p style="margin:0;font-size:13px;color:#6b7280">If this wasn't you, contact your administrator straight away.</p>`),
  }).catch(() => {});

  res.json({ message: 'Your password has been reset. You can now sign in with your new password.' });
};

module.exports = { forgotPassword, verifyResetCode, resetPassword };
