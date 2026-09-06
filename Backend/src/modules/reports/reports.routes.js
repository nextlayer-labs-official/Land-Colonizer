const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const { salesReport, inventoryReport, purchaseReport, brokerReport, instalmentsReport, availabilityReport, balanceDueReport, additionalCostsReport, bookingIncomeReport, otherFinancialsReport } = require('./reports.controller');

const router = Router();
router.use(authenticate);

router.get('/sales',             salesReport);
router.get('/inventory',         inventoryReport);
router.get('/purchases',         purchaseReport);
router.get('/brokers',           brokerReport);
router.get('/instalments',       instalmentsReport);
router.get('/availability',      availabilityReport);
router.get('/balance-due',       balanceDueReport);
router.get('/additional-costs',  additionalCostsReport);
router.get('/booking-income',    bookingIncomeReport);
router.get('/other-financials',  otherFinancialsReport);

module.exports = router;
