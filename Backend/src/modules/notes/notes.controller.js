const prisma = require('../../lib/prisma');

// Deleted notes stay in the Recycle Bin for this long, then are removed for good
const BIN_DAYS = 30;
const binCutoff = () => new Date(Date.now() - BIN_DAYS * 24 * 60 * 60 * 1000);

async function getNotes(req, res) {
  const { search = '', bin } = req.query;
  const inBin = bin === '1' || bin === 'true';

  // Clear out this user's notes that have been in the bin longer than BIN_DAYS
  await prisma.note.deleteMany({ where: { user_id: req.user.id, deleted_at: { lt: binCutoff() } } });

  const where = {
    user_id: req.user.id,
    deleted_at: inBin ? { not: null } : null,
    ...(search.trim() ? {
      OR: [
        { title:   { contains: search } },
        { content: { contains: search } },
      ],
    } : {}),
  };
  const notes = await prisma.note.findMany({
    where,
    orderBy: inBin ? { deleted_at: 'desc' } : { updated_at: 'desc' },
  });
  res.json(notes);
}

async function createNote(req, res) {
  const { title, content, color } = req.body;
  if (!title && !content) return res.status(400).json({ message: 'Note cannot be empty' });
  const note = await prisma.note.create({
    data: {
      title:   title   ? String(title).trim()   : null,
      content: content ? String(content).trim() : '',
      color:   color   || 'default',
      user_id: req.user.id,
    },
  });
  res.status(201).json(note);
}

async function updateNote(req, res) {
  const id = Number(req.params.id);
  const existing = await prisma.note.findFirst({ where: { id, user_id: req.user.id, deleted_at: null } });
  if (!existing) return res.status(404).json({ message: 'Note not found' });
  const { title, content, color } = req.body;
  const note = await prisma.note.update({
    where: { id },
    data: {
      title:   title   !== undefined ? (title   ? String(title).trim()   : null) : existing.title,
      content: content !== undefined ? (content ? String(content).trim() : '')   : existing.content,
      color:   color   !== undefined ? color                                      : existing.color,
    },
  });
  res.json(note);
}

// Moves the note to the Recycle Bin
async function deleteNote(req, res) {
  const id = Number(req.params.id);
  const existing = await prisma.note.findFirst({ where: { id, user_id: req.user.id, deleted_at: null } });
  if (!existing) return res.status(404).json({ message: 'Note not found' });
  const note = await prisma.note.update({ where: { id }, data: { deleted_at: new Date() } });
  res.json(note);
}

async function restoreNote(req, res) {
  const id = Number(req.params.id);
  const existing = await prisma.note.findFirst({ where: { id, user_id: req.user.id, deleted_at: { not: null } } });
  if (!existing) return res.status(404).json({ message: 'Note not found in Recycle Bin' });
  const note = await prisma.note.update({ where: { id }, data: { deleted_at: null } });
  res.json(note);
}

// Removes a note from the Recycle Bin for good
async function purgeNote(req, res) {
  const id = Number(req.params.id);
  const existing = await prisma.note.findFirst({ where: { id, user_id: req.user.id, deleted_at: { not: null } } });
  if (!existing) return res.status(404).json({ message: 'Note not found in Recycle Bin' });
  await prisma.note.delete({ where: { id } });
  res.json({ message: 'Deleted permanently' });
}

module.exports = { getNotes, createNote, updateNote, deleteNote, restoreNote, purgeNote, BIN_DAYS };
