const { AppError } = require('../../shared/errors/app.error');

class AiRagClient {
    constructor() {
        this.baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        this.apiKey = process.env.AI_SERVICE_API_KEY || '';
    }

    /**
     * Ingests extracted document text into the AI Service RAG vector store.
     * @param {object} params
     * @param {string} params.tenantId
     * @param {string} params.documentId
     * @param {string} params.fileName
     * @param {string} params.text
     * @param {object} [params.metadata]
     * @returns {Promise<{ success: boolean, documentId: string, chunks: number }>}
     */
    async ingestDocument({ tenantId, documentId, fileName, text, metadata = {} }) {
        const url = `${this.baseUrl}/api/v1/rag/ingest`;
        const payload = {
            tenantId,
            documentId,
            fileName,
            text,
            metadata: {
                source: 'erp',
                type: 'business_document',
                ...metadata
            }
        };

        const headers = {
            'Content-Type': 'application/json',
            ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}`, 'X-API-Key': this.apiKey } : {})
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorDetails = '';
                try {
                    const errBody = await response.json();
                    errorDetails = errBody.detail || errBody.message || JSON.stringify(errBody);
                } catch {
                    errorDetails = await response.text();
                }

                console.error(`[AiRagClient] Ingestion failed with status ${response.status}:`, errorDetails);
                throw new AppError(
                    'AI_INGESTION_FAILED',
                    `AI RAG service rejected ingestion (${response.status}): ${errorDetails}`
                );
            }

            const data = await response.json();
            return {
                success: true,
                documentId: data.document_id || data.documentId || documentId,
                chunks: data.chunks || 0
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            console.error('[AiRagClient] Request error:', error.message);
            throw new AppError(
                'AI_INGESTION_FAILED',
                `Failed to communicate with AI Service at ${this.baseUrl}: ${error.message}`
            );
        }
    }
}

module.exports = new AiRagClient();
