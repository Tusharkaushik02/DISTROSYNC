const path = require('path');
const fs = require('fs');
const multer = require('multer');
const documentService = require('./document.service');
const { getDocumentByIdSchema, ingestDocumentParamsSchema } = require('./document.schema');
const { successResponse } = require('../../shared/utils/response');
const { AppError } = require('../../shared/errors/app.error');

// Configure storage directory
const uploadDir = process.env.UPLOAD_DIR || './storage/documents';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const safeExt = path.extname(file.originalname).toLowerCase() || '.pdf';
        cb(null, `doc-${uniqueSuffix}${safeExt}`);
    }
});

const fileFilter = (req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfExt = file.originalname.toLowerCase().endsWith('.pdf');

    if (isPdfMime || isPdfExt) {
        cb(null, true);
    } else {
        cb(new AppError('INVALID_DOCUMENT_TYPE', 'Only PDF files are accepted'), false);
    }
};

const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB) || 10;
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: maxFileSizeMB * 1024 * 1024
    }
});

class DocumentController {
    get uploadMiddleware() {
        return upload.single('file');
    }

    async upload(req, res, next) {
        try {
            if (!req.file) {
                throw new AppError('INVALID_DOCUMENT_TYPE', 'Please select a PDF file to upload');
            }
            const doc = await documentService.uploadDocument(req.file, req.tenantId);
            return successResponse(res, doc, 'Document uploaded successfully', 201);
        } catch (error) {
            next(error);
        }
    }

    async ingest(req, res, next) {
        try {
            const { id } = ingestDocumentParamsSchema.parse(req.params);
            const doc = await documentService.ingestDocument(id, req.tenantId);
            return successResponse(res, doc, 'Document ingested into AI RAG successfully');
        } catch (error) {
            next(error);
        }
    }

    async getById(req, res, next) {
        try {
            const { id } = getDocumentByIdSchema.parse(req.params);
            const doc = await documentService.getDocumentById(id, req.tenantId);
            return successResponse(res, doc);
        } catch (error) {
            next(error);
        }
    }

    async list(req, res, next) {
        try {
            const skip = parseInt(req.query.skip) || 0;
            const take = Math.min(parseInt(req.query.take) || 50, 100);
            const docs = await documentService.listDocuments(req.tenantId, { skip, take });
            return successResponse(res, docs);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new DocumentController();
