const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const { getInstallment, updateInstallment } = require('./installments.controller');
const { addPartial, getPartials, deletePartial } = require('./partial.controller');

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/',  getInstallment);
router.put('/',  updateInstallment);

router.get('/:n/partial',      getPartials);
router.post('/:n/partial',     addPartial);
router.delete('/:n/partial/:id', deletePartial);

module.exports = router;
