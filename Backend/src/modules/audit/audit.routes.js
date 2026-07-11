const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');
const { getAuditLogs } = require('./audit.controller');

const router = Router();
router.use(authenticate);

router.get('/', authorize('AUDIT_VIEW'), getAuditLogs);

module.exports = router;
