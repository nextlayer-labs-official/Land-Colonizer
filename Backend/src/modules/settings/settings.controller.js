const prisma = require('../../lib/prisma');
const { sendMail } = require('../../lib/mailer');
const { auditLog, diff } = require('../../lib/audit');

// Strip sensitive fields before sending settings to the client
function safeSettings(s) {
  if (!s) return s;
  const { smtp_pass, google_drive_service_account_json, ...rest } = s;
  return {
    ...rest,
    smtp_pass_set:       !!smtp_pass,
    google_drive_json_set: !!google_drive_service_account_json,
  };
}

// ── Get settings (always returns one row) ─────────────────────────────────────
const getSettings = async (req, res) => {
  let settings = await prisma.companySettings.findFirst();
  if (!settings) {
    settings = await prisma.companySettings.create({ data: {} });
  }
  res.json(safeSettings(settings));
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

  auditLog({ req, action: 'UPDATE', entity: 'settings', entityCode: 'company_info' });
  res.json(safeSettings(updated));
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
  auditLog({ req, action: 'UPDATE', entity: 'settings', entityCode: 'email_settings' });
  res.json(safeSettings(updated));
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

  auditLog({ req, action: 'UPDATE', entity: 'settings', entityCode: 'security_settings' });
  res.json(safeSettings(updated));
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

  res.json(safeSettings(updated));
};

// ── Update Google Drive settings ───────────────────────────────────────────────
const updateDriveSettings = async (req, res) => {
  const { google_drive_enabled, google_drive_purchase_folder_id, google_drive_sale_folder_id } = req.body;

  let settings = await prisma.companySettings.findFirst();
  if (!settings) {
    settings = await prisma.companySettings.create({ data: {} });
  }

  const updated = await prisma.companySettings.update({
    where: { id: settings.id },
    data: {
      ...(google_drive_enabled              !== undefined ? { google_drive_enabled: Boolean(google_drive_enabled) }       : {}),
      ...(google_drive_purchase_folder_id   !== undefined ? { google_drive_purchase_folder_id: String(google_drive_purchase_folder_id).trim() || null } : {}),
      ...(google_drive_sale_folder_id       !== undefined ? { google_drive_sale_folder_id:     String(google_drive_sale_folder_id).trim()     || null } : {}),
    },
  });

  auditLog({ req, action: 'UPDATE', entity: 'settings', entityCode: 'drive_settings' });
  res.json(safeSettings(updated));
};

// ── Upload Google Drive service account JSON ───────────────────────────────────
const updateDriveJson = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No JSON file provided' });

  let parsed;
  try {
    parsed = JSON.parse(req.file.buffer.toString('utf-8'));
  } catch {
    return res.status(400).json({ message: 'Invalid JSON file' });
  }

  if (parsed.type !== 'service_account') {
    return res.status(400).json({ message: 'File must be a Google service account JSON (type: service_account)' });
  }
  if (!parsed.client_email || !parsed.private_key) {
    return res.status(400).json({ message: 'JSON is missing required fields (client_email, private_key)' });
  }

  let settings = await prisma.companySettings.findFirst();
  if (!settings) {
    settings = await prisma.companySettings.create({ data: {} });
  }

  await prisma.companySettings.update({
    where: { id: settings.id },
    data:  { google_drive_service_account_json: JSON.stringify(parsed) },
  });

  auditLog({ req, action: 'UPDATE', entity: 'settings', entityCode: 'drive_json' });
  res.json({ message: 'Service account JSON saved', client_email: parsed.client_email });
};

// ── Public: company name + drive status (no auth required) ────────────────────
const getPublicSettings = async (req, res) => {
  const settings = await prisma.companySettings.findFirst();
  res.json({
    company_name:           settings?.company_name || null,
    google_drive_enabled:   settings?.google_drive_enabled || false,
    google_drive_configured: !!(
      settings?.google_drive_service_account_json &&
      settings?.google_drive_purchase_folder_id   &&
      settings?.google_drive_sale_folder_id
    ),
  });
};

module.exports = {
  getSettings,
  getPublicSettings,
  updateCompanyInfo,
  updateEmailSettings,
  updateSecuritySettings,
  updatePrefixSettings,
  updateDriveSettings,
  updateDriveJson,
  testEmail,
  uploadLogo,
};
