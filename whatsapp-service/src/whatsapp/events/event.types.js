/**
 * Canonical event type and message type constants.
 *
 * eventType  = what kind of webhook event (message vs status)
 * messageType = what kind of content (text vs image vs audio)
 */

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
