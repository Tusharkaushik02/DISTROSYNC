const documentRepository = require('./document.repository');
const pdfService = require('./pdf.service');
const aiRagClient = require('./ai-rag.client');
const { AppError } = require('../../shared/errors/app.error');

class DocumentService {
    async getDocumentById(id, tenantId) {
        const doc = await documentRepository.findById(id, tenantId);
        if (!doc) {
            throw new AppError('DOCUMENT_NOT_FOUND', `Document with id ${id} not found`);
        }
        return this.formatDocument(doc);
    }

    async uploadDocument(file, tenantId) {
        if (!file) {
            throw new AppError('INVALID_DOCUMENT_TYPE', 'No file was uploaded');
        }

        // Validate MIME type
        const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            throw new AppError('INVALID_DOCUMENT_TYPE', 'Only PDF files are supported');
        }

        const doc = await documentRepository.create({
            tenantId,
            fileName: file.originalname,
            filePath: file.path,
            mimeType: file.mimetype || 'application/pdf',
            fileSize: file.size,
            status: 'UPLOADED'
        });

        return this.formatDocument(doc);
    }

    async ingestDocument(id, tenantId) {
        const doc = await documentRepository.findById(id, tenantId);
        if (!doc) {
            throw new AppError('DOCUMENT_NOT_FOUND', `Document with id ${id} not found`);
        }

        // 1. Mark status as PROCESSING
        await documentRepository.update(id, tenantId, { status: 'PROCESSING' });

        try {
            // 2. Extract text from original PDF
            const { text } = await pdfService.extractText(doc.filePath);

            // 3. Send text and metadata to AI RAG Service
            const aiResult = await aiRagClient.ingestDocument({
                tenantId,
                documentId: doc.id,
                fileName: doc.fileName,
                text,
                metadata: {
                    fileSize: doc.fileSize,
                    mimeType: doc.mimeType
                }
            });

            // 4. Update Document record with AI document ID and INGESTED status
            await documentRepository.update(id, tenantId, {
                status: 'INGESTED',
                extractedText: text,
                aiDocumentId: aiResult.documentId
            });

            const updated = await documentRepository.findById(id, tenantId);
            return this.formatDocument(updated);

        } catch (error) {
            // Mark status as FAILED on error
            await documentRepository.update(id, tenantId, { status: 'FAILED' });
            throw error;
        }
    }

    async listDocuments(tenantId, options = {}) {
        const docs = await documentRepository.list(tenantId, options);
        return docs.map(d => this.formatDocument(d));
    }

    formatDocument(doc) {
        return {
            id: doc.id,
            tenantId: doc.tenantId,
            fileName: doc.fileName,
            filePath: doc.filePath,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            status: doc.status,
            aiDocumentId: doc.aiDocumentId,
            hasExtractedText: Boolean(doc.extractedText),
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    }
}

module.exports = new DocumentService();
