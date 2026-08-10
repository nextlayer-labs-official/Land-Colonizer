const prisma = require('../../lib/prisma');

async function getNotes(req, res) {
  const { search = '' } = req.query;
  const where = {
    user_id: req.user.id,
    ...(search.trim() ? {
      OR: [
        { title:   { contains: search } },
        { content: { contains: search } },
      ],
    } : {}),
  };
  const notes = await prisma.note.findMany({
    where,
    orderBy: { updated_at: 'desc' },
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
  const existing = await prisma.note.findFirst({ where: { id, user_id: req.user.id } });
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

async function deleteNote(req, res) {
  const id = Number(req.params.id);
  const existing = await prisma.note.findFirst({ where: { id, user_id: req.user.id } });
  if (!existing) return res.status(404).json({ message: 'Note not found' });
  await prisma.note.delete({ where: { id } });
  res.json({ message: 'Deleted' });
}

module.exports = { getNotes, createNote, updateNote, deleteNote };
