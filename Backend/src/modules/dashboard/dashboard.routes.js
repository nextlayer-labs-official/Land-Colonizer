const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const { getDashboard } = require('./dashboard.controller');

const router = Router();
router.use(authenticate);
router.get('/', getDashboard);

module.exports = router;
