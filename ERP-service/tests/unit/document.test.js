const documentService = require('../../src/modules/documents/document.service');
const documentRepository = require('../../src/modules/documents/document.repository');
const pdfService = require('../../src/modules/documents/pdf.service');
const aiRagClient = require('../../src/modules/documents/ai-rag.client');
const { AppError } = require('../../src/shared/errors/app.error');

jest.mock('../../src/modules/documents/document.repository');
jest.mock('../../src/modules/documents/pdf.service');
jest.mock('../../src/modules/documents/ai-rag.client');

describe('Document Service Unit Tests', () => {
    const mockTenantA = '11111111-1111-1111-1111-111111111111';
    const mockDocId = '66666666-6666-6666-6666-666666666666';

    const mockDoc = {
        id: mockDocId,
        tenantId: mockTenantA,
        fileName: 'catalog.pdf',
        filePath: './storage/documents/catalog.pdf',
        mimeType: 'application/pdf',
        fileSize: 102400,
        status: 'UPLOADED',
        extractedText: null,
        aiDocumentId: null,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('uploadDocument', () => {
        it('should create document record with UPLOADED status for valid PDF', async () => {
            documentRepository.create.mockResolvedValue(mockDoc);

            const file = {
                originalname: 'catalog.pdf',
                path: './storage/documents/catalog.pdf',
                mimetype: 'application/pdf',
                size: 102400
            };

            const result = await documentService.uploadDocument(file, mockTenantA);

            expect(documentRepository.create).toHaveBeenCalledWith({
                tenantId: mockTenantA,
                fileName: 'catalog.pdf',
                filePath: './storage/documents/catalog.pdf',
                mimeType: 'application/pdf',
                fileSize: 102400,
                status: 'UPLOADED'
            });
            expect(result.status).toBe('UPLOADED');
            expect(result.fileName).toBe('catalog.pdf');
        });

        it('should reject non-PDF file upload', async () => {
            const file = {
                originalname: 'image.png',
                path: './storage/documents/image.png',
                mimetype: 'image/png',
                size: 102400
            };

            await expect(documentService.uploadDocument(file, mockTenantA))
                .rejects
                .toMatchObject({
                    code: 'INVALID_DOCUMENT_TYPE',
                    statusCode: 400
                });
        });
    });

    describe('ingestDocument', () => {
        it('should orchestrate text extraction and AI RAG ingestion, updating status to INGESTED', async () => {
            documentRepository.findById
                .mockResolvedValueOnce(mockDoc)
                .mockResolvedValueOnce({
                    ...mockDoc,
                    status: 'INGESTED',
                    extractedText: 'Extracted product catalog text',
                    aiDocumentId: 'ai-doc-123'
                });

            pdfService.extractText.mockResolvedValue({
                text: 'Extracted product catalog text',
                numPages: 2
            });

            aiRagClient.ingestDocument.mockResolvedValue({
                success: true,
                documentId: 'ai-doc-123',
                chunks: 4
            });

            const result = await documentService.ingestDocument(mockDocId, mockTenantA);

            expect(documentRepository.update).toHaveBeenCalledWith(mockDocId, mockTenantA, { status: 'PROCESSING' });
            expect(pdfService.extractText).toHaveBeenCalledWith(mockDoc.filePath);
            expect(aiRagClient.ingestDocument).toHaveBeenCalledWith({
                tenantId: mockTenantA,
                documentId: mockDocId,
                fileName: 'catalog.pdf',
                text: 'Extracted product catalog text',
                metadata: {
                    fileSize: 102400,
                    mimeType: 'application/pdf'
                }
            });
            expect(documentRepository.update).toHaveBeenCalledWith(mockDocId, mockTenantA, {
                status: 'INGESTED',
                extractedText: 'Extracted product catalog text',
                aiDocumentId: 'ai-doc-123'
            });
            expect(result.status).toBe('INGESTED');
            expect(result.aiDocumentId).toBe('ai-doc-123');
        });

        it('should mark document as FAILED if text extraction fails', async () => {
            documentRepository.findById.mockResolvedValue(mockDoc);
            pdfService.extractText.mockRejectedValue(new AppError('DOCUMENT_PROCESSING_FAILED', 'Cannot parse PDF'));

            await expect(documentService.ingestDocument(mockDocId, mockTenantA))
                .rejects
                .toMatchObject({
                    code: 'DOCUMENT_PROCESSING_FAILED'
                });

            expect(documentRepository.update).toHaveBeenCalledWith(mockDocId, mockTenantA, { status: 'FAILED' });
        });

        it('should mark document as FAILED if AI RAG ingestion fails', async () => {
            documentRepository.findById.mockResolvedValue(mockDoc);
            pdfService.extractText.mockResolvedValue({ text: 'Valid text', numPages: 1 });
            aiRagClient.ingestDocument.mockRejectedValue(new AppError('AI_INGESTION_FAILED', 'AI Service unreachable'));

            await expect(documentService.ingestDocument(mockDocId, mockTenantA))
                .rejects
                .toMatchObject({
                    code: 'AI_INGESTION_FAILED'
                });

            expect(documentRepository.update).toHaveBeenCalledWith(mockDocId, mockTenantA, { status: 'FAILED' });
        });
    });
});
