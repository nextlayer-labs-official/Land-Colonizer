const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const { getNotes, createNote, updateNote, deleteNote, restoreNote, purgeNote } = require('./notes.controller');

const router = Router();
router.use(authenticate);

router.get('/',       getNotes);              // ?bin=1 lists the Recycle Bin
router.post('/',      createNote);
router.put('/:id',   updateNote);
router.delete('/:id', deleteNote);           // moves to the Recycle Bin
router.post('/:id/restore',     restoreNote);
router.delete('/:id/permanent', purgeNote);

module.exports = router;
