// Event and message type constants

const EVENT_TYPES = Object.freeze({
    MESSAGE: 'message',
    INTERACTIVE: 'interactive',
    STATUS: 'status',
    UNKNOWN: 'unknown',
});

const MESSAGE_TYPES = Object.freeze({
    TEXT: 'text',
    IMAGE: 'image',
    AUDIO: 'audio',
    VIDEO: 'video',
    DOCUMENT: 'document',
    LOCATION: 'location',
    CONTACT: 'contact',
    INTERACTIVE: 'interactive',
    STICKER: 'sticker',
    UNKNOWN: 'unknown',
});

module.exports = {
    EVENT_TYPES,
    MESSAGE_TYPES,
};
