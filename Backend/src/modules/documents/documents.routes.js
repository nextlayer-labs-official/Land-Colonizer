const { Router } = require('express');
const multer       = require('multer');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');
const { getDocuments, uploadDocument, deleteDocument } = require('./documents.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/png', 'image/webp',
      'application/zip',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Injected entity_type middleware
function withEntityType(type) {
  return (req, _res, next) => { req.params.entity_type = type; next(); };
}

// Purchase documents: /purchases/:entity_id/documents
const purchaseDocsRouter = Router({ mergeParams: true });
purchaseDocsRouter.use(authenticate);
purchaseDocsRouter.get ('/', authorize('PURCHASE_VIEW'), withEntityType('purchase'), getDocuments);
purchaseDocsRouter.post('/', authorize('PURCHASE_EDIT'), withEntityType('purchase'), upload.single('file'), uploadDocument);

// Sale documents: /sales/:entity_id/documents
const saleDocsRouter = Router({ mergeParams: true });
saleDocsRouter.use(authenticate);
saleDocsRouter.get ('/', authorize('SALE_VIEW'), withEntityType('sale'), getDocuments);
saleDocsRouter.post('/', authorize('SALE_EDIT'), withEntityType('sale'), upload.single('file'), uploadDocument);

// Delete: /documents/:id
const deleteRouter = Router();
deleteRouter.use(authenticate);
deleteRouter.delete('/:id', deleteDocument);

module.exports = { purchaseDocsRouter, saleDocsRouter, deleteRouter };
