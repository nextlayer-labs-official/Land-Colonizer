const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const { getNotes, createNote, updateNote, deleteNote } = require('./notes.controller');

const router = Router();
router.use(authenticate);

router.get('/',       getNotes);
router.post('/',      createNote);
router.put('/:id',   updateNote);
router.delete('/:id', deleteNote);

module.exports = router;
