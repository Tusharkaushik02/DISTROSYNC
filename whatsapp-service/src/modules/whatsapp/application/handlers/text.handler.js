// Text message handler - send text to AI service and reply via Twilio
const { createHandlerResult } = require('./handler.result');
const { generateAIResponse } = require('../services/ai.service');
const { sendMessage } = require('../services/whatsapp.service');

// Extract text content from canonical event
function extractText(canonicalEvent) {
    const text = (canonicalEvent.content && canonicalEvent.content.text) || '';
    return {
        text: text.trim(),
        length: text.trim().length,
        sender: canonicalEvent.sender.phone,
    };
}

// Build processing context for downstream stages
function buildTextContext(canonicalEvent, extracted) {
    return {
        text: extracted.text,
        sender: canonicalEvent.sender.phone,
        senderName: canonicalEvent.sender.name,
        waId: canonicalEvent.sender.waId,
        timestamp: canonicalEvent.timestamp,
        channel: canonicalEvent.channel,
        messageId: canonicalEvent.id,
    };
}

// Main text handler
async function textHandler(canonicalEvent, event) {
    const extracted = extractText(canonicalEvent);

    if (!extracted.text) {
        return createHandlerResult({
            handled: false,
            event,
            status: 'rejected',
            error: { code: 'EMPTY_TEXT', message: 'Text message body is empty' },
        });
    }

    const context = buildTextContext(canonicalEvent, extracted);

    try {
        console.log('[Webhook] Incoming WhatsApp message');
        console.log('[AI] Sending message to AI service');
        const aiResponse = await generateAIResponse(
            context.text,
            context.waId,
            process.env.WHATSAPP_TENANT_ID,
        );

        console.log('[WhatsApp] Sending AI response');
        const outbound = await sendMessage(context.sender, aiResponse);

        return createHandlerResult({
            handled: true,
            event,
            action: 'ai_response_sent',
            status: 'processed',
            data: {
                extracted,
                context,
                aiResponse,
                outbound,
            },
        });
    } catch (error) {
        console.error(`[AI] Text handling failed: ${error.message}`);

        return createHandlerResult({
            handled: false,
            event,
            action: 'ai_response_failed',
            status: 'failed',
            data: {
                extracted,
                context,
            },
            error: {
                code: 'AI_RESPONSE_FAILED',
                message: 'Failed to generate or send AI response',
            },
        });
    }
}

module.exports = {
    textHandler,
    extractText,
    buildTextContext,
};
