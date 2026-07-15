const { Router } = require('express');
const multer = require('multer');
const authenticate = require('../../middleware/authenticate');
const { exportBackup, restoreBackup } = require('./backup.controller');

const router = Router();

// Backup files can be large — 100 MB limit, memory storage (no disk write needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json'))
      cb(null, true);
    else
      cb(new Error('Only .json backup files are allowed'));
  },
});

router.get('/export',  authenticate, exportBackup);
router.post('/restore', authenticate, upload.single('backup'), restoreBackup);

module.exports = router;
