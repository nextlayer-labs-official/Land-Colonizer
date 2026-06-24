const { Router }     = require('express');
const authenticate   = require('../../middleware/authenticate');
const authorize      = require('../../middleware/authorize');
const { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer } = require('./customers.controller');

const router = Router();
router.use(authenticate);

router.get('/',     authorize('CUSTOMER_VIEW'),   getCustomers);
router.get('/:id',  authorize('CUSTOMER_VIEW'),   getCustomerById);
router.post('/',    authorize('CUSTOMER_CREATE'),  createCustomer);
router.put('/:id',  authorize('CUSTOMER_EDIT'),    updateCustomer);
router.delete('/:id', authorize('CUSTOMER_DELETE'), deleteCustomer);

module.exports = router;
