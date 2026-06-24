const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');
const { getUsers, getUserById, createUser, updateUser, deleteUser } = require('./users.controller');

const router = Router();

router.use(authenticate);

router.get('/',    authorize('USER_VIEW'),   getUsers);
router.get('/:id', authorize('USER_VIEW'),   getUserById);
router.post('/',   authorize('USER_CREATE'), createUser);
router.put('/:id', authorize('USER_EDIT'),   updateUser);
router.delete('/:id', authorize('USER_DELETE'), deleteUser);

module.exports = router;
