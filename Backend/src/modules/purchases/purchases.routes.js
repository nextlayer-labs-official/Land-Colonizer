const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');
const {
  getPurchases, getPurchaseById, createPurchase, updatePurchase, archivePurchase, unarchivePurchase, deletePurchase, importPurchases,
} = require('./purchases.controller');
const { getLayout, saveLayout, toggleLock } = require('./layout.controller');
const purchaseInstallmentsRoutes = require('../purchase-installments/purchase-installments.routes');

const router = Router();
router.use(authenticate);

router.get('/',     authorize('PURCHASE_VIEW'),   getPurchases);
router.get('/:id',  authorize('PURCHASE_VIEW'),   getPurchaseById);
router.post('/',           authorize('PURCHASE_CREATE'), createPurchase);
router.post('/import',     authorize('PURCHASE_CREATE'), importPurchases);
router.put('/:id',           authorize('PURCHASE_EDIT'),   updatePurchase);
router.patch('/:id/archive',   authorize('PURCHASE_ARCHIVE'),  archivePurchase);
router.patch('/:id/unarchive', authorize('PURCHASE_ARCHIVE'),  unarchivePurchase);
router.delete('/:id',          authorize('PURCHASE_DELETE'),   deletePurchase);

router.get('/:id/layout',      authorize('PURCHASE_VIEW'), getLayout);
router.put('/:id/layout',      authorize('PURCHASE_EDIT'), saveLayout);
router.post('/:id/layout/lock',authorize('PURCHASE_EDIT'), toggleLock);

router.use('/:purchase_id/installments', purchaseInstallmentsRoutes);

module.exports = router;
