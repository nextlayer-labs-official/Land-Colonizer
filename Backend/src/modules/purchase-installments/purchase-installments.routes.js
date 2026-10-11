const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');
const { getInstallment, updateInstallment } = require('./purchase-installments.controller');

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/',  authorize('PURCHASE_VIEW'), getInstallment);
router.put('/',  authorize('PURCHASE_EDIT'), updateInstallment);

module.exports = router;
