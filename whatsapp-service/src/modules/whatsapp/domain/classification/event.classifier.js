// Event type classifier (message, interactive, status, unknown)
const { EVENT_TYPES } = require('../../application/events/event.types');

// Classify the top-level event type
function classifyEventType(canonicalEvent) {
    const raw = (canonicalEvent.metadata && canonicalEvent.metadata.raw) || {};

    if (raw.MessageStatus) {
        const hasBody = raw.Body && raw.Body.trim().length > 0;
        const hasMedia = raw.NumMedia && parseInt(raw.NumMedia, 10) > 0;

        if (!hasBody && !hasMedia) {
            return EVENT_TYPES.STATUS;
        }
    }

    // Interactive: button press or list selection
    if (raw.ButtonText || raw.ListId) {
        return EVENT_TYPES.INTERACTIVE;
    }

    // Message: has MessageSid with content (Body or media)
    if (raw.MessageSid) {
        return EVENT_TYPES.MESSAGE;
    }

    return EVENT_TYPES.UNKNOWN;
}

module.exports = {
    classifyEventType,
};
