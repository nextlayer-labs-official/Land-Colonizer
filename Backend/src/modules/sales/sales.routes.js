const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');
const { getSales, getSaleById, createSale, updateSale, deleteSale } = require('./sales.controller');
const installmentsRoutes = require('../installments/installments.routes');

const router = Router();
router.use(authenticate);

router.get('/',      authorize('SALE_VIEW'),   getSales);
router.get('/:id',   authorize('SALE_VIEW'),   getSaleById);
router.post('/',     authorize('SALE_CREATE'),  createSale);
router.put('/:id',   authorize('SALE_EDIT'),    updateSale);
router.delete('/:id', authorize('SALE_DELETE'), deleteSale);

router.use('/:sale_id/installments', installmentsRoutes);

module.exports = router;
