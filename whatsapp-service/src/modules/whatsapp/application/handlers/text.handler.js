// Text message handler — extract text + stub pipeline stages
const { createHandlerResult } = require('./handler.result');

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
        timestamp: canonicalEvent.timestamp,
        channel: canonicalEvent.channel,
        messageId: canonicalEvent.id,
    };
}

// Stub: intent detection — future AI/NLP integration point
function detectIntent(_context) {
    return { implemented: false, reason: 'AI intent detection not integrated' };
}

// Stub: entity extraction — future NLP integration point
function extractEntities(_context) {
    return { implemented: false, reason: 'Entity extraction not integrated' };
}

// Stub: action determination — future business logic integration point
function determineAction(_intent, _entities) {
    return { implemented: false, reason: 'Action determination not integrated' };
}

// Stub: response generation — future LLM/template integration point
function generateResponse(_action) {
    return { implemented: false, reason: 'Response generation not integrated' };
}

// Main text handler
function textHandler(canonicalEvent, event) {
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
    const intent = detectIntent(context);
    const entities = extractEntities(context);
    const action = determineAction(intent, entities);
    const response = generateResponse(action);

    return createHandlerResult({
        handled: true,
        event,
        status: 'processed',
        data: {
            extracted,
            context,
            pipeline: { intent, entities, action, response },
        },
    });
}

module.exports = {
    textHandler,
    extractText,
    buildTextContext,
    detectIntent,
    extractEntities,
    determineAction,
    generateResponse,
};
