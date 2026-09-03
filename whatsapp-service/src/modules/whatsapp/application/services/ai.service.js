const DEFAULT_TIMEOUT_MS = 30000;

class AIServiceError extends Error {
    constructor(message, statusCode = 502) {
        super(message);
        this.name = 'AIServiceError';
        this.statusCode = statusCode;
    }
}

function getConversationUrl() {
    const baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    return `${baseUrl.replace(/\/+$/, '')}/api/v1/conversation`;
}

async function generateAIResponse(message, userId, tenantId = process.env.WHATSAPP_TENANT_ID) {
    const cleanMessage = (message || '').trim();
    if (!cleanMessage) {
        throw new AIServiceError('Message cannot be empty', 400);
    }

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
        throw new AIServiceError('User ID (WaId) is required', 400);
    }

    if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
        throw new AIServiceError('WhatsApp tenant ID is not configured', 500);
    }

    const controller = new AbortController();
    const timeoutMs = parseInt(process.env.AI_SERVICE_TIMEOUT_MS, 10) || DEFAULT_TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(getConversationUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId.trim(),
                message: cleanMessage,
                tenant_id: tenantId.trim(),
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            console.error(`[AI] AI service returned HTTP ${response.status}`);
            throw new AIServiceError('AI service returned an error response', response.status);
        }

        const payload = await response.json();
        const aiText = payload && typeof payload.response === 'string'
            ? payload.response.trim()
            : '';

        if (!aiText) {
            throw new AIServiceError('AI service returned an empty response');
        }

        console.log('[AI] Received response');
        return aiText;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new AIServiceError('AI service request timed out', 504);
        }
        if (error instanceof AIServiceError) {
            throw error;
        }
        throw new AIServiceError('Failed to call AI service');
    } finally {
        clearTimeout(timeoutId);
    }
}

module.exports = {
    AIServiceError,
    generateAIResponse,
    getConversationUrl,
};
