const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authenticate = require('../../middleware/authenticate');
const {
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

// JSON file upload storage (memory, 1 MB max)
const jsonUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) cb(null, true);
    else cb(new Error('Only .json files are allowed'));
  },
});

router.get('/public',            getPublicSettings);

// All settings routes require authentication
// Super-admin-only enforcement is handled in frontend; backend trusts authenticate
router.get('/',                  authenticate, getSettings);
router.put('/company',           authenticate, updateCompanyInfo);
router.put('/email',             authenticate, updateEmailSettings);
router.put('/security',          authenticate, updateSecuritySettings);
router.put('/prefixes',          authenticate, updatePrefixSettings);
router.put('/drive',             authenticate, updateDriveSettings);
router.post('/drive/json',       authenticate, jsonUpload.single('json'), updateDriveJson);
router.post('/test-email',       authenticate, testEmail);
router.post('/logo',             authenticate, logoUpload.single('logo'), uploadLogo);

module.exports = router;
