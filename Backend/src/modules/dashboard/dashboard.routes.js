const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');
const { getDashboard } = require('./dashboard.controller');

const router = Router();
router.use(authenticate);
router.get('/', authorize('DASHBOARD_VIEW'), getDashboard);

module.exports = router;
