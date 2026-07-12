const prisma      = require('../../lib/prisma');
const { uploadFile, deleteFile } = require('../../lib/googleDrive');

async function getDriveConfig() {
  const s = await prisma.companySettings.findFirst();
  const credentials = s?.google_drive_service_account_json
    ? JSON.parse(s.google_drive_service_account_json)
    : null;
  return {
    enabled:           !!(s?.google_drive_enabled && credentials),
    credentials,
    purchaseFolderId:  s?.google_drive_purchase_folder_id || null,
    saleFolderId:      s?.google_drive_sale_folder_id     || null,
  };
}

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

  const drive = await getDriveConfig();
  if (!drive.enabled) {
    return res.status(503).json({ message: 'Google Drive integration is not enabled or not configured' });
  }

  const folderId = entity_type === 'purchase' ? drive.purchaseFolderId : drive.saleFolderId;
  if (!folderId) {
    return res.status(500).json({ message: `Drive folder not configured for ${entity_type}` });
  }

  const { buffer, originalname, mimetype, size } = req.file;
  const { id: drive_file_id, webViewLink: drive_url } = await uploadFile(
    buffer, originalname, mimetype, folderId, drive.credentials,
  );

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

  const drive = await getDriveConfig();
  if (drive.enabled && drive.credentials) {
    try {
      await deleteFile(doc.drive_file_id, drive.credentials);
    } catch (e) {
      console.warn('Drive delete warning:', e.message);
    }
  }

  await prisma.document.delete({ where: { id } });
  res.json({ message: 'Deleted' });
}

module.exports = { getDocuments, uploadDocument, deleteDocument };
