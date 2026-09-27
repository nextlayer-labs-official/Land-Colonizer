const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');
const { getUsers, getUserById, createUser, updateUser, deleteUser, resetPassword } = require('./users.controller');

const router = Router();

router.use(authenticate);

router.get('/',    authorize('USER_VIEW'),   getUsers);
router.get('/:id', authorize('USER_VIEW'),   getUserById);
router.post('/',   authorize('USER_CREATE'), createUser);
router.put('/:id', authorize('USER_EDIT'),   updateUser);
router.delete('/:id', authorize('USER_DELETE'), deleteUser);
router.put('/:id/reset-password', authorize('USER_EDIT'), resetPassword);

module.exports = router;
