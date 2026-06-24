const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const { getBrokers, getBrokerById, createBroker, updateBroker, deleteBroker } = require('./brokers.controller');

const router = Router();
router.use(authenticate);

router.get('/',       getBrokers);
router.get('/:id',    getBrokerById);
router.post('/',      createBroker);
router.put('/:id',    updateBroker);
router.delete('/:id', deleteBroker);

module.exports = router;
