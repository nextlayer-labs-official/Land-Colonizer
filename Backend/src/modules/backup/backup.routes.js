const { Router } = require('express');
const multer = require('multer');
const prisma = require('../../lib/prisma');
const authenticate = require('../../middleware/authenticate');
const { isSmtpConfigured } = require('../../lib/mailer');
const { auditLog } = require('../../lib/audit');
const { exportBackup, restoreBackup } = require('./backup.controller');
const { INTERVAL_OPTIONS, parseEmails, invalidEmails, runBackupNow, nextDueAt } = require('./auto-backup');

const router = Router();

// Backups contain all data (including password hashes) — Super Admin only, like the Backup tab
const superAdminOnly = (req, res, next) =>
  req.user?.is_system ? next() : res.status(403).json({ message: 'Only the Super Admin can manage backups.' });

// Backup files can be large — 100 MB limit, memory storage (no disk write needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (file.mimetype === 'application/json' || name.endsWith('.json') || name.endsWith('.json.gz') || name.endsWith('.gz'))
      cb(null, true);
    else
      cb(new Error('Only .json or .json.gz backup files are allowed'));
  },
});

router.use(authenticate, superAdminOnly);

router.get('/export',  exportBackup);
router.post('/restore', upload.single('backup'), restoreBackup);

// ── Automatic email backup ────────────────────────────────────────────────────
const autoState = async (s) => ({
  enabled:          !!s?.auto_backup_enabled,
  interval_hours:   s?.auto_backup_interval_hours || 24,
  emails:           parseEmails(s?.auto_backup_emails),
  last_at:          s?.auto_backup_last_at || null,
  last_status:      s?.auto_backup_last_status || null,
  next_at:          nextDueAt(s),
  interval_options: INTERVAL_OPTIONS,
  smtp_configured:  await isSmtpConfigured(),
});

router.get('/auto', async (req, res) => {
  res.json(await autoState(await prisma.companySettings.findFirst()));
});

router.put('/auto', async (req, res) => {
  const { enabled, interval_hours, emails } = req.body || {};
  const list = parseEmails(Array.isArray(emails) ? emails.join(',') : emails);
  const bad = invalidEmails(list);
  if (bad.length) return res.status(400).json({ message: `Not a valid email address: ${bad.join(', ')}` });
  if (list.length > 10) return res.status(400).json({ message: 'Add at most 10 email addresses.' });
  if (!INTERVAL_OPTIONS.includes(Number(interval_hours))) return res.status(400).json({ message: 'Choose one of the listed intervals.' });
  if (enabled && !list.length) return res.status(400).json({ message: 'Add at least one email address to turn on automatic backup.' });

  let s = await prisma.companySettings.findFirst();
  if (!s) s = await prisma.companySettings.create({ data: {} });
  const turningOn = !!enabled && !s.auto_backup_enabled;
  const updated = await prisma.companySettings.update({
    where: { id: s.id },
    data: {
      auto_backup_enabled: !!enabled,
      auto_backup_interval_hours: Number(interval_hours),
      auto_backup_emails: list.join(', ') || null,
      // Turning it on sends the first backup within a minute, then every interval after that
      ...(turningOn ? { auto_backup_last_at: null } : {}),
    },
  });
  auditLog({ req, action: 'UPDATE', entity: 'settings', entityCode: 'auto_backup' });
  res.json(await autoState(updated));
});

router.post('/auto/run', async (req, res) => {
  const r = await runBackupNow();
  auditLog({ req, action: 'BACKUP_EMAIL', entity: 'settings', entityCode: 'auto_backup' });
  const state = await autoState(await prisma.companySettings.findFirst());
  res.status(r.ok ? 200 : 400).json({ ...state, message: r.message });
});

module.exports = router;
