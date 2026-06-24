const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const { getInstallment, updateInstallment } = require('./installments.controller');

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/',  getInstallment);
router.put('/',  updateInstallment);

module.exports = router;
