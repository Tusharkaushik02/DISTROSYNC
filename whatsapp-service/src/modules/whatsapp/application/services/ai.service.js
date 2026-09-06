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

async function generateAIResponse(message, userId, tenantId = process.env.WHATSAPP_TENANT_ID, phone = null) {
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

    const senderPhone = (phone || userId || '').trim();

    try {
        const response = await fetch(getConversationUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId.trim(),
                phone: senderPhone,
                message: cleanMessage,
                tenant_id: tenantId.trim(),
            }),
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
        if (error instanceof AIServiceError) {
            throw error;
        }
        throw new AIServiceError('Failed to call AI service');
    }
}

module.exports = {
    AIServiceError,
    generateAIResponse,
    getConversationUrl,
};
