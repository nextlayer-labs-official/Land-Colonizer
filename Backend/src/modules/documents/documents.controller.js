const prisma      = require('../../lib/prisma');
const { uploadFile, deleteFile } = require('../../lib/googleDrive');

const PURCHASE_FOLDER = () => process.env.GOOGLE_DRIVE_PURCHASE_FOLDER_ID;
const SALE_FOLDER     = () => process.env.GOOGLE_DRIVE_SALE_FOLDER_ID;

async function getDocuments(req, res) {
  const { entity_type, entity_id } = req.params;
  const docs = await prisma.document.findMany({
    where: { entity_type, entity_id: Number(entity_id) },
    include: { uploader: { select: { id: true, name: true } } },
    orderBy: { created_at: 'desc' },
  });
  res.json(docs);
}

async function uploadDocument(req, res) {
  const { entity_type, entity_id } = req.params;
  if (!req.file) return res.status(400).json({ message: 'No file provided' });

  const folderId = entity_type === 'purchase' ? PURCHASE_FOLDER() : SALE_FOLDER();
  if (!folderId) return res.status(500).json({ message: `Drive folder not configured for ${entity_type}` });

  const { buffer, originalname, mimetype, size } = req.file;
  const { id: drive_file_id, webViewLink: drive_url } = await uploadFile(buffer, originalname, mimetype, folderId);

  const doc = await prisma.document.create({
    data: {
      entity_type,
      entity_id:    Number(entity_id),
      name:         originalname,
      drive_file_id,
      drive_url,
      mime_type:    mimetype,
      size,
      uploaded_by:  req.user.id,
    },
    include: { uploader: { select: { id: true, name: true } } },
  });

  res.status(201).json(doc);
}

async function deleteDocument(req, res) {
  const id  = Number(req.params.id);
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return res.status(404).json({ message: 'Document not found' });

  try {
    await deleteFile(doc.drive_file_id);
  } catch (e) {
    // If Drive delete fails (already removed), continue to delete DB record
    console.warn('Drive delete warning:', e.message);
  }

  await prisma.document.delete({ where: { id } });
  res.json({ message: 'Deleted' });
}

module.exports = { getDocuments, uploadDocument, deleteDocument };
