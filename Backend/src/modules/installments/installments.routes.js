const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');
const { getInstallment, updateInstallment } = require('./installments.controller');
const { addPartial, getPartials, updatePartial, deletePartial } = require('./partial.controller');

const router = Router({ mergeParams: true });
router.use(authenticate);

// Viewing needs Sale View; changing the schedule or partial payments needs Sale Installment or Sale Edit
// (the same rule the sale page uses to show its edit controls)
const canManage = authorize.any('SALE_INSTALLMENT_MANAGE', 'SALE_EDIT');

router.get('/',  authorize('SALE_VIEW'), getInstallment);
router.put('/',  canManage,              updateInstallment);

router.get('/:n/partial',        authorize('SALE_VIEW'), getPartials);
router.post('/:n/partial',       canManage, addPartial);
router.patch('/:n/partial/:id',  canManage, updatePartial);
router.delete('/:n/partial/:id', canManage, deletePartial);

module.exports = router;
