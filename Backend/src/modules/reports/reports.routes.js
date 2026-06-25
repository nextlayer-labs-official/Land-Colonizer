const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const { salesReport, inventoryReport, purchaseReport, brokerReport } = require('./reports.controller');

const router = Router();
router.use(authenticate);

router.get('/sales',     salesReport);
router.get('/inventory', inventoryReport);
router.get('/purchases', purchaseReport);
router.get('/brokers',   brokerReport);

module.exports = router;
