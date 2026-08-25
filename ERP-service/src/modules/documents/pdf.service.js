const fs = require('fs');
const pdfParse = require('pdf-parse');
const { AppError } = require('../../shared/errors/app.error');

class PdfService {
    /**
     * Extracts plain text from a local PDF file using pdf-parse.
     * @param {string} filePath - Absolute or relative path to the PDF file.
     * @returns {Promise<{ text: string, numPages: number, info: object }>}
     */
    async extractText(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new AppError('DOCUMENT_NOT_FOUND', `File not found on disk: ${filePath}`);
            }

            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);

            const text = (pdfData.text || '').trim();

            if (!text) {
                throw new AppError(
                    'DOCUMENT_PROCESSING_FAILED',
                    'No readable text could be extracted from this PDF document'
                );
            }

            return {
                text,
                numPages: pdfData.numpages || 1,
                info: pdfData.info || {}
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            console.error('[PdfService] Text extraction error:', error.message);
            throw new AppError(
                'DOCUMENT_PROCESSING_FAILED',
                `Failed to extract text from PDF: ${error.message}`
            );
        }
    }
}

module.exports = new PdfService();
