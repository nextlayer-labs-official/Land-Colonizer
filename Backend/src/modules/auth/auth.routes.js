const { Router } = require('express');
const {
  login, getMe, getProfile,
  updateProfile, changePassword,
} = require('./auth.controller');
const authenticate = require('../../middleware/authenticate');
const { loginRateLimiter } = require('../../middleware/rateLimiter');

const router = Router();

router.post('/login', loginRateLimiter, login);
router.get('/me',               authenticate, getMe);
router.get('/profile',          authenticate, getProfile);
router.put('/profile',          authenticate, updateProfile);
router.put('/change-password',  authenticate, changePassword);

module.exports = router;
