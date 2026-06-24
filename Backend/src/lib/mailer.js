const nodemailer = require('nodemailer');
const prisma = require('./prisma');

// Returns a configured transporter — null if SMTP not set up
async function getTransporter() {
  const settings = await prisma.companySettings.findFirst();
  if (!settings || !settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
    return null;
  }
  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port || 587,
    secure: (settings.smtp_port || 587) === 465,
    auth: { user: settings.smtp_user, pass: settings.smtp_pass },
  });
}

async function getFromAddress() {
  const settings = await prisma.companySettings.findFirst();
  const name  = settings?.smtp_from_name  || settings?.company_name || 'AMS';
  const email = settings?.smtp_from_email || settings?.smtp_user    || '';
  return `"${name}" <${email}>`;
}

async function isSmtpConfigured() {
  const settings = await prisma.companySettings.findFirst();
  return !!(settings?.smtp_host && settings?.smtp_user && settings?.smtp_pass);
}

async function isEmailEnabled() {
  const settings = await prisma.companySettings.findFirst();
  return !!(settings?.email_notifications && settings?.smtp_host && settings?.smtp_user && settings?.smtp_pass);
}

// For approval/rejection notifications — respects the email_notifications toggle
async function sendMail({ to, subject, html }) {
  try {
    if (!(await isEmailEnabled())) return;
    const transporter = await getTransporter();
    if (!transporter) return;
    const from = await getFromAddress();
    await transporter.sendMail({ from, to, subject, html });
  } catch (err) {
    console.error('[Mailer] Failed to send email:', err.message);
  }
}

// For critical emails (password reset) — sends if SMTP is configured, ignores the toggle
async function sendMailCritical({ to, subject, html }) {
  try {
    if (!(await isSmtpConfigured())) {
      console.warn('[Mailer] SMTP not configured — cannot send critical email to', to);
      return { skipped: true, reason: 'SMTP not configured' };
    }
    const transporter = await getTransporter();
    if (!transporter) return { skipped: true, reason: 'Could not create transporter' };
    const from = await getFromAddress();
    await transporter.sendMail({ from, to, subject, html });
    return { sent: true };
  } catch (err) {
    console.error('[Mailer] Failed to send critical email:', err.message);
    return { skipped: true, reason: err.message };
  }
}

module.exports = { sendMail, sendMailCritical, isEmailEnabled, isSmtpConfigured };
