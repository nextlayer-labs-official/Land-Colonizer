const prisma = require('../../lib/prisma');
const { sendMail } = require('../../lib/mailer');

// ── Get settings (always returns one row) ─────────────────────────────────────
const getSettings = async (req, res) => {
  let settings = await prisma.companySettings.findFirst();
  if (!settings) {
    settings = await prisma.companySettings.create({ data: {} });
  }
  // Never expose smtp_pass to the client
  const { smtp_pass, ...safe } = settings;
  res.json({ ...safe, smtp_pass_set: !!smtp_pass });
};

// ── Update company info ────────────────────────────────────────────────────────
const updateCompanyInfo = async (req, res) => {
  const {
    company_name, company_address, company_phone,
    company_email, company_website, company_gstin,
  } = req.body;

  let settings = await prisma.companySettings.findFirst();
  if (!settings) {
    settings = await prisma.companySettings.create({ data: {} });
  }

  const updated = await prisma.companySettings.update({
    where: { id: settings.id },
    data: {
      ...(company_name    !== undefined ? { company_name }    : {}),
      ...(company_address !== undefined ? { company_address } : {}),
      ...(company_phone   !== undefined ? { company_phone }   : {}),
      ...(company_email   !== undefined ? { company_email }   : {}),
      ...(company_website !== undefined ? { company_website } : {}),
      ...(company_gstin   !== undefined ? { company_gstin }   : {}),
    },
  });

  const { smtp_pass, ...safe } = updated;
  res.json({ ...safe, smtp_pass_set: !!smtp_pass });
};

// ── Update SMTP / email settings ──────────────────────────────────────────────
const updateEmailSettings = async (req, res) => {
  const {
    smtp_host, smtp_port, smtp_user, smtp_pass,
    smtp_from_name, smtp_from_email, email_notifications,
  } = req.body;

  let settings = await prisma.companySettings.findFirst();
  if (!settings) {
    settings = await prisma.companySettings.create({ data: {} });
  }

  const data = {
    ...(smtp_host           !== undefined ? { smtp_host }           : {}),
    ...(smtp_port           !== undefined ? { smtp_port: Number(smtp_port) } : {}),
    ...(smtp_user           !== undefined ? { smtp_user }           : {}),
    ...(smtp_from_name      !== undefined ? { smtp_from_name }      : {}),
    ...(smtp_from_email     !== undefined ? { smtp_from_email }     : {}),
    ...(email_notifications !== undefined ? { email_notifications: Boolean(email_notifications) } : {}),
  };
  // Only update password if explicitly provided and non-empty
  if (smtp_pass && smtp_pass.trim()) {
    data.smtp_pass = smtp_pass.trim();
  }

  const updated = await prisma.companySettings.update({ where: { id: settings.id }, data });
  const { smtp_pass: _, ...safe } = updated;
  res.json({ ...safe, smtp_pass_set: !!updated.smtp_pass });
};

// ── Update security settings (rate limiting, upload size) ─────────────────────
const updateSecuritySettings = async (req, res) => {
  const { login_max_attempts, login_window_minutes, max_upload_mb } = req.body;

  if (login_max_attempts !== undefined && (login_max_attempts < 1 || login_max_attempts > 100)) {
    return res.status(400).json({ message: 'Max attempts must be between 1 and 100' });
  }
  if (login_window_minutes !== undefined && (login_window_minutes < 1 || login_window_minutes > 1440)) {
    return res.status(400).json({ message: 'Window must be between 1 and 1440 minutes' });
  }
  if (max_upload_mb !== undefined && (max_upload_mb < 1 || max_upload_mb > 50)) {
    return res.status(400).json({ message: 'Upload size must be between 1 and 50 MB' });
  }

  let settings = await prisma.companySettings.findFirst();
  if (!settings) {
    settings = await prisma.companySettings.create({ data: {} });
  }

  const updated = await prisma.companySettings.update({
    where: { id: settings.id },
    data: {
      ...(login_max_attempts   !== undefined ? { login_max_attempts: Number(login_max_attempts) }     : {}),
      ...(login_window_minutes !== undefined ? { login_window_minutes: Number(login_window_minutes) } : {}),
      ...(max_upload_mb        !== undefined ? { max_upload_mb: Number(max_upload_mb) }               : {}),
    },
  });

  const { smtp_pass, ...safe } = updated;
  res.json({ ...safe, smtp_pass_set: !!smtp_pass });
};

// ── Test email connection ──────────────────────────────────────────────────────
const testEmail = async (req, res) => {
  const { test_to } = req.body;
  if (!test_to) return res.status(400).json({ message: 'test_to email is required' });

  const settings = await prisma.companySettings.findFirst();
  if (!settings?.smtp_host || !settings?.smtp_user || !settings?.smtp_pass) {
    return res.status(400).json({ message: 'SMTP is not configured. Please save SMTP settings first.' });
  }

  await sendMail({
    to: test_to,
    subject: 'AMS — Email Test',
    html: `<p>This is a test email from <strong>${settings.company_name || 'AMS'}</strong>. Your email configuration is working correctly.</p>`,
  });

  res.json({ message: `Test email sent to ${test_to}` });
};

// ── Upload company logo ────────────────────────────────────────────────────────
const uploadLogo = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  let settings = await prisma.companySettings.findFirst();
  if (!settings) {
    settings = await prisma.companySettings.create({ data: {} });
  }

  const logoPath = `/uploads/logos/${req.file.filename}`;
  await prisma.companySettings.update({
    where: { id: settings.id },
    data: { company_logo: logoPath },
  });

  res.json({ logo: logoPath });
};

// ── Update code prefix settings ────────────────────────────────────────────────
const updatePrefixSettings = async (req, res) => {
  const { purchase_prefix, inventory_prefix } = req.body;

  let settings = await prisma.companySettings.findFirst();
  if (!settings) {
    settings = await prisma.companySettings.create({ data: {} });
  }

  const updated = await prisma.companySettings.update({
    where: { id: settings.id },
    data: {
      ...(purchase_prefix  !== undefined ? { purchase_prefix:  String(purchase_prefix).trim().toUpperCase()  || 'PUR' } : {}),
      ...(inventory_prefix !== undefined ? { inventory_prefix: String(inventory_prefix).trim().toUpperCase() || 'INV' } : {}),
    },
  });

  const { smtp_pass, ...safe } = updated;
  res.json({ ...safe, smtp_pass_set: !!smtp_pass });
};

// ── Public: company name only (no auth required) ──────────────────────────────
const getPublicSettings = async (req, res) => {
  const settings = await prisma.companySettings.findFirst();
  res.json({ company_name: settings?.company_name || null });
};

module.exports = {
  getSettings,
  getPublicSettings,
  updateCompanyInfo,
  updateEmailSettings,
  updateSecuritySettings,
  updatePrefixSettings,
  testEmail,
  uploadLogo,
};
