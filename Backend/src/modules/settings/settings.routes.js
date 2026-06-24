const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authenticate = require('../../middleware/authenticate');
const {
  getSettings,
  updateCompanyInfo,
  updateEmailSettings,
  updateSecuritySettings,
  updatePrefixSettings,
  testEmail,
  uploadLogo,
} = require('./settings.controller');

const router = Router();

// Logo upload storage
const logoDir = path.join(__dirname, '../../../uploads/logos');
if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, logoDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  },
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB for logos
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// All settings routes require authentication
// Super-admin-only enforcement is handled in frontend; backend trusts authenticate
router.get('/',                  authenticate, getSettings);
router.put('/company',           authenticate, updateCompanyInfo);
router.put('/email',             authenticate, updateEmailSettings);
router.put('/security',          authenticate, updateSecuritySettings);
router.put('/prefixes',          authenticate, updatePrefixSettings);
router.post('/test-email',       authenticate, testEmail);
router.post('/logo',             authenticate, logoUpload.single('logo'), uploadLogo);

module.exports = router;
