// Unsupported/unknown event handler — clean rejection for unhandled event types
const { createHandlerResult } = require('./handler.result');

// Main unsupported handler — rejects status, unknown, and any unregistered events
function unsupportedHandler(canonicalEvent, event) {
    return createHandlerResult({
        handled: false,
        event,
        status: 'rejected',
        data: {
            eventType: canonicalEvent.eventType,
            messageType: canonicalEvent.messageType,
        },
        error: {
            code: 'UNSUPPORTED_EVENT',
            message: `Event type "${event}" is not supported`,
        },
    });
}

module.exports = { unsupportedHandler };
