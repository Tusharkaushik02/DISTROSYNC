const { EVENT_TYPES, MESSAGE_TYPES } = require('./event.types');

// Registry mapping (eventType, messageType) pairs to dot-notation event strings
const EVENT_REGISTRY = Object.freeze({
    'message.text':        { eventType: EVENT_TYPES.MESSAGE,     messageType: MESSAGE_TYPES.TEXT },
    'message.image':       { eventType: EVENT_TYPES.MESSAGE,     messageType: MESSAGE_TYPES.IMAGE },
    'message.audio':       { eventType: EVENT_TYPES.MESSAGE,     messageType: MESSAGE_TYPES.AUDIO },
    'message.video':       { eventType: EVENT_TYPES.MESSAGE,     messageType: MESSAGE_TYPES.VIDEO },
    'message.document':    { eventType: EVENT_TYPES.MESSAGE,     messageType: MESSAGE_TYPES.DOCUMENT },
    'message.location':    { eventType: EVENT_TYPES.MESSAGE,     messageType: MESSAGE_TYPES.LOCATION },
    'message.contact':     { eventType: EVENT_TYPES.MESSAGE,     messageType: MESSAGE_TYPES.CONTACT },
    'message.sticker':     { eventType: EVENT_TYPES.MESSAGE,     messageType: MESSAGE_TYPES.STICKER },
    'message.interactive': { eventType: EVENT_TYPES.MESSAGE,     messageType: MESSAGE_TYPES.INTERACTIVE },
    'interactive.button':  { eventType: EVENT_TYPES.INTERACTIVE, messageType: 'button' },
    'interactive.list':    { eventType: EVENT_TYPES.INTERACTIVE, messageType: 'list' },
    'status':              { eventType: EVENT_TYPES.STATUS,      messageType: null },
    'unknown':             { eventType: EVENT_TYPES.UNKNOWN,     messageType: null },
});

// Resolve event string from eventType and messageType
function resolveEventString(eventType, messageType) {
    for (const [eventString, entry] of Object.entries(EVENT_REGISTRY)) {
        if (entry.eventType === eventType && entry.messageType === messageType) {
            return eventString;
        }
    }

    // Try compound key as fallback
    if (eventType && messageType) {
        const compound = `${eventType}.${messageType}`;
        if (EVENT_REGISTRY[compound]) {
            return compound;
        }
    }

    return 'unknown';
}

module.exports = {
    EVENT_REGISTRY,
    resolveEventString,
};
