const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');
const { getRoles, getRoleById, createRole, updateRolePermissions, deleteRole } = require('./roles.controller');

const router = Router();

router.use(authenticate);

router.get('/',       authorize('ROLE_VIEW'),   getRoles);
router.get('/:id',    authorize('ROLE_VIEW'),   getRoleById);
router.post('/',      authorize('ROLE_CREATE'),  createRole);
router.put('/:id',    authorize('ROLE_EDIT'),    updateRolePermissions);
router.delete('/:id', authorize('ROLE_DELETE'),  deleteRole);

module.exports = router;
