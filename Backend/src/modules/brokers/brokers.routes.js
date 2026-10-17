const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');
const { getBrokers, getBrokerById, createBroker, updateBroker, deleteBroker } = require('./brokers.controller');

const router = Router();
router.use(authenticate);

router.get('/',       authorize('BROKER_VIEW'),   getBrokers);
router.get('/:id',    authorize('BROKER_VIEW'),   getBrokerById);
router.post('/',      authorize('BROKER_CREATE'), createBroker);
router.put('/:id',    authorize('BROKER_EDIT'),   updateBroker);
router.delete('/:id', authorize('BROKER_DELETE'), deleteBroker);

module.exports = router;
