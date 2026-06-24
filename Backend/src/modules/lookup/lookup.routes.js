const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const { getRoles, getUsers, getPermissions, getBrokers, getCustomers, getPlots, getPurchases, getInventoryUnits, getProjects } = require('./lookup.controller');

const router = Router();

router.use(authenticate);

router.get('/roles',       getRoles);
router.get('/users',       getUsers);
router.get('/permissions', getPermissions);
router.get('/brokers',     getBrokers);
router.get('/customers',   getCustomers);
router.get('/plots',       getPlots);
router.get('/purchases',   getPurchases);
router.get('/inventory',   getInventoryUnits);
router.get('/projects',    getProjects);

module.exports = router;
