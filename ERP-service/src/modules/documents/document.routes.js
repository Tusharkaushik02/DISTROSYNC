const express = require('express');
const router = express.Router();
const documentController = require('./document.controller');
const { authMiddleware } = require('../../shared/middleware/auth.middleware');

// All document routes require authentication and tenant context
router.use(authMiddleware);

// Routes
router.post('/', documentController.uploadMiddleware, documentController.upload.bind(documentController));
router.get('/', documentController.list.bind(documentController));
router.post('/:id/ingest', documentController.ingest.bind(documentController));
router.get('/:id', documentController.getById.bind(documentController));

module.exports = router;
