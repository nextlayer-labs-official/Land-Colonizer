const zlib = require('zlib');
const prisma = require('../../lib/prisma');
const { sendMailCritical, isSmtpConfigured } = require('../../lib/mailer');
const { buildBackup } = require('./backup.controller');

// Automatic email backup: every N hours the full backup is emailed as a compressed (.json.gz) attachment.
const INTERVAL_OPTIONS = [1, 2, 4, 6, 8, 12, 24, 48, 168]; // hours
const CHECK_EVERY_MS   = 60 * 1000;                        // how often the scheduler looks for a due backup
const MAX_ATTACHMENT   = 10 * 1024 * 1024;                 // ZeptoMail caps the whole email at 15 MB
const HOUR = 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseEmails = (s) => [...new Set(String(s || '').split(/[,;\s]+/).map(e => e.trim().toLowerCase()).filter(Boolean))];
const invalidEmails = (list) => list.filter(e => !EMAIL_RE.test(e));

const fmtIST = (d) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(d);
function stampIST(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}-${p.hour === '24' ? '00' : p.hour}${p.minute}`;
}
const fmtSize = (n) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

// Builds the backup and emails it to the configured recipients. Records the outcome in auto_backup_last_status.
async function sendBackupEmail(settings) {
  const recipients = parseEmails(settings.auto_backup_emails);
  const finish = async (ok, status) => {
    await prisma.companySettings.update({ where: { id: settings.id }, data: { auto_backup_last_status: status } });
    return { ok, message: status };
  };
  if (!recipients.length) return finish(false, 'Not sent: no email addresses are set.');
  if (!(await isSmtpConfigured())) return finish(false, 'Not sent: email (SMTP) is not configured in the server .env.');

  const now = new Date();
  const backup = await buildBackup();
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(backup)));
  const company = settings.company_name || 'AMS';
  const filename = `${company.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'ams'}-backup-${stampIST(now)}.json.gz`;
  const records = Object.values(backup.tables).reduce((s, rows) => s + (rows?.length || 0), 0);

  if (gz.length > MAX_ATTACHMENT) {
    return finish(false, `Not sent: the backup (${fmtSize(gz.length)}) is larger than the 10 MB email attachment limit. Use Download Backup instead.`);
  }

  const result = await sendMailCritical({
    to: recipients.join(', '),
    subject: `${company} backup — ${fmtIST(now)}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;color:#1f2937">
      <div style="background:#875A7B;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-weight:700">${company} — automatic backup</div>
      <div style="border:1px solid #e5e7eb;border-top:0;padding:18px;border-radius:0 0 8px 8px;font-size:14px;line-height:1.5">
        <p style="margin:0 0 10px">The backup taken on <b>${fmtIST(now)}</b> is attached.</p>
        <p style="margin:0 0 10px">File: <b>${filename}</b> (${fmtSize(gz.length)}, ${records.toLocaleString('en-IN')} records)</p>
        <p style="margin:0;font-size:12px;color:#6b7280">To restore, go to Settings → Backup → Restore from Backup and choose this file. Keep it somewhere safe — it contains all of your data.</p>
      </div></div>`,
    attachments: [{ filename, content: gz, contentType: 'application/gzip' }],
  });
  return result?.sent
    ? finish(true, `Sent to ${recipients.join(', ')} (${fmtSize(gz.length)}) on ${fmtIST(now)}.`)
    : finish(false, `Failed on ${fmtIST(now)}: ${result?.reason || 'unknown error'}`);
}

// "Send backup now" from the Backup tab — also restarts the interval from now
async function runBackupNow() {
  const settings = await prisma.companySettings.findFirst();
  if (!settings) return { ok: false, message: 'Settings not found.' };
  await prisma.companySettings.update({ where: { id: settings.id }, data: { auto_backup_last_at: new Date() } });
  return sendBackupEmail(settings);
}

// One scheduler pass: claims the due backup in the database first, so a restart or a second server
// process can never send the same scheduled backup twice
async function checkAndRun() {
  const settings = await prisma.companySettings.findFirst();
  if (!settings?.auto_backup_enabled) return;
  const hours = INTERVAL_OPTIONS.includes(settings.auto_backup_interval_hours) ? settings.auto_backup_interval_hours : 24;
  const now = new Date();
  const cutoff = new Date(now.getTime() - hours * HOUR + 30 * 1000); // small allowance for timer drift
  const claimed = await prisma.companySettings.updateMany({
    where: { id: settings.id, auto_backup_enabled: true, OR: [{ auto_backup_last_at: null }, { auto_backup_last_at: { lte: cutoff } }] },
    data: { auto_backup_last_at: now },
  });
  if (claimed.count !== 1) return;
  const r = await sendBackupEmail(settings);
  console.log(`[AutoBackup] ${r.message}`);
}

let timer = null;
function startScheduler() {
  if (timer) return;
  const tick = () => checkAndRun().catch(err => console.error('[AutoBackup] check failed:', err.message));
  timer = setInterval(tick, CHECK_EVERY_MS);
  timer.unref?.();
  setTimeout(tick, 15 * 1000).unref?.(); // first check shortly after start-up
}

function nextDueAt(settings) {
  if (!settings?.auto_backup_enabled) return null;
  const hours = settings.auto_backup_interval_hours || 24;
  return settings.auto_backup_last_at ? new Date(settings.auto_backup_last_at.getTime() + hours * HOUR) : new Date();
}

module.exports = { INTERVAL_OPTIONS, parseEmails, invalidEmails, runBackupNow, startScheduler, checkAndRun, nextDueAt };
