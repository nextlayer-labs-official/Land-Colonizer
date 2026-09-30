const prisma = require('../../lib/prisma');

const getLayout = async (req, res) => {
  const purchase_id = Number(req.params.id);
  const layout = await prisma.purchaseLayout.findUnique({ where: { purchase_id } });
  res.json(layout || null);
};

const saveLayout = async (req, res) => {
  const purchase_id = Number(req.params.id);
  const { grid_rows, grid_cols, items } = req.body;

  const existing = await prisma.purchaseLayout.findUnique({ where: { purchase_id } });
  if (existing?.locked) return res.status(400).json({ message: 'Layout is locked and cannot be edited.' });

  const layout = await prisma.purchaseLayout.upsert({
    where:  { purchase_id },
    create: { purchase_id, grid_rows: Number(grid_rows) || 20, grid_cols: Number(grid_cols) || 10, items: items || [] },
    update: { grid_rows: Number(grid_rows) || 20, grid_cols: Number(grid_cols) || 10, items: items || [] },
  });
  res.json(layout);
};

const toggleLock = async (req, res) => {
  const purchase_id = Number(req.params.id);
  const existing = await prisma.purchaseLayout.findUnique({ where: { purchase_id } });
  if (!existing) return res.status(404).json({ message: 'No layout found. Save the layout first.' });
  const layout = await prisma.purchaseLayout.update({
    where: { purchase_id },
    data:  { locked: !existing.locked },
  });
  res.json(layout);
};

module.exports = { getLayout, saveLayout, toggleLock };
