const { Router } = require('express');
const dashboardRoutes  = require('../modules/dashboard/dashboard.routes');
const projectsRoutes   = require('../modules/projects/projects.routes');
const authRoutes       = require('../modules/auth/auth.routes');
const lookupRoutes     = require('../modules/lookup/lookup.routes');
const usersRoutes      = require('../modules/users/users.routes');
const rolesRoutes      = require('../modules/roles/roles.routes');
const settingsRoutes   = require('../modules/settings/settings.routes');
const purchasesRoutes  = require('../modules/purchases/purchases.routes');
const customersRoutes  = require('../modules/customers/customers.routes');
const brokersRoutes    = require('../modules/brokers/brokers.routes');
const salesRoutes      = require('../modules/sales/sales.routes');
const inventoryRoutes  = require('../modules/inventory/inventory.routes');
const reportsRoutes    = require('../modules/reports/reports.routes');

const router = Router();

router.use('/dashboard', dashboardRoutes);
router.use('/projects',  projectsRoutes);
router.use('/auth',      authRoutes);
router.use('/lookup',    lookupRoutes);
router.use('/users',     usersRoutes);
router.use('/roles',     rolesRoutes);
router.use('/settings',  settingsRoutes);
router.use('/purchases', purchasesRoutes);
router.use('/customers', customersRoutes);
router.use('/brokers',   brokersRoutes);
router.use('/sales',     salesRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/reports',   reportsRoutes);

module.exports = router;
