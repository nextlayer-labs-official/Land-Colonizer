const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');
const {
  getPurchases, getPurchaseById, createPurchase, updatePurchase, deletePurchase, importPurchases,
} = require('./purchases.controller');
const purchaseInstallmentsRoutes = require('../purchase-installments/purchase-installments.routes');

const router = Router();
router.use(authenticate);

router.get('/',     authorize('PURCHASE_VIEW'),   getPurchases);
router.get('/:id',  authorize('PURCHASE_VIEW'),   getPurchaseById);
router.post('/',           authorize('PURCHASE_CREATE'), createPurchase);
router.post('/import',     authorize('PURCHASE_CREATE'), importPurchases);
router.put('/:id',  authorize('PURCHASE_EDIT'),   updatePurchase);
router.delete('/:id', authorize('PURCHASE_DELETE'), deletePurchase);

router.use('/:purchase_id/installments', purchaseInstallmentsRoutes);

module.exports = router;
