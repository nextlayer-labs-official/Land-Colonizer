const { Router } = require('express');
const {
  login, getMe, getProfile,
  updateProfile, changePassword,
} = require('./auth.controller');
const { forgotPassword, verifyResetCode, resetPassword } = require('./password-reset.controller');
const authenticate = require('../../middleware/authenticate');
const { loginRateLimiter, ipRateLimit } = require('../../middleware/rateLimiter');

const router = Router();

// Forgot password (public): limit how often one IP can request codes and try them
const resetRequestLimit = ipRateLimit({ name: 'pw-forgot', max: 5,  windowMs: 15 * 60 * 1000, message: 'Too many reset requests. Please try again in a few minutes.' });
const resetVerifyLimit  = ipRateLimit({ name: 'pw-verify', max: 20, windowMs: 15 * 60 * 1000, message: 'Too many attempts. Please try again in a few minutes.' });

router.post('/login', loginRateLimiter, login);
router.post('/forgot-password',   resetRequestLimit, forgotPassword);
router.post('/verify-reset-code', resetVerifyLimit,  verifyResetCode);
router.post('/reset-password',    resetVerifyLimit,  resetPassword);
router.get('/me',               authenticate, getMe);
router.get('/profile',          authenticate, getProfile);
router.put('/profile',          authenticate, updateProfile);
router.put('/change-password',  authenticate, changePassword);

module.exports = router;
