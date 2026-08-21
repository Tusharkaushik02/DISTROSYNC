/**
 * Message type classifier — registry pattern.
 *
 * An ordered array of classifiers, each with a type and a test function.
 * The first classifier whose test returns true determines the messageType.
 *
 * Adding a new message type = pushing one object into MESSAGE_TYPE_CLASSIFIERS.
 */

const { MESSAGE_TYPES, EVENT_TYPES } = require('../events/event.types');

/**
 * Classifier registry.
 * Evaluated in priority order — first match wins.
 */
const MESSAGE_TYPE_CLASSIFIERS = [
    {
        type: MESSAGE_TYPES.IMAGE,
        test: (event) => {
            const media = event.content && event.content.media;
            if (!media || media.length === 0) return false;
            const ct = media[0].contentType || '';
            return ct.startsWith('image/') && ct !== 'image/webp';
        },
    },
    {
        type: MESSAGE_TYPES.STICKER,
        test: (event) => {
            const media = event.content && event.content.media;
            if (!media || media.length === 0) return false;
            return (media[0].contentType || '') === 'image/webp';
        },
    },
    {
        type: MESSAGE_TYPES.VIDEO,
        test: (event) => {
            const media = event.content && event.content.media;
            if (!media || media.length === 0) return false;
            return (media[0].contentType || '').startsWith('video/');
        },
    },
    {
        type: MESSAGE_TYPES.AUDIO,
        test: (event) => {
            const media = event.content && event.content.media;
            if (!media || media.length === 0) return false;
            return (media[0].contentType || '').startsWith('audio/');
        },
    },
    {
        type: MESSAGE_TYPES.DOCUMENT,
        test: (event) => {
            const media = event.content && event.content.media;
            if (!media || media.length === 0) return false;
            const ct = media[0].contentType || '';
            // Anything with media that isn't image/video/audio is a document
            return ct.startsWith('application/') ||
                (!ct.startsWith('image/') && !ct.startsWith('video/') && !ct.startsWith('audio/'));
        },
    },
    {
        type: MESSAGE_TYPES.LOCATION,
        test: (event) => {
            const raw = (event.metadata && event.metadata.raw) || {};
            return !!(raw.Latitude && raw.Longitude);
        },
    },
    {
        type: MESSAGE_TYPES.CONTACT,
        test: (event) => {
            const raw = (event.metadata && event.metadata.raw) || {};
            return !!raw.vCard;
        },
    },
    {
        type: MESSAGE_TYPES.INTERACTIVE,
        test: (event) => {
            const raw = (event.metadata && event.metadata.raw) || {};
            return !!(raw.ButtonText || raw.ListId);
        },
    },
    {
        type: MESSAGE_TYPES.TEXT,
        test: (event) => {
            return !!(event.content && event.content.text && event.content.text.trim().length > 0);
        },
    },
    {
        type: MESSAGE_TYPES.UNKNOWN,
        test: () => true, // Default fallback — always matches
    },
];

/**
 * Classify the message type of a canonical event.
 *
 * Only applies when eventType is "message" or "interactive".
 * For status events, returns null.
 *
 * @param {object} canonicalEvent — Normalized canonical event with eventType set
 * @returns {string|null} One of MESSAGE_TYPES values, or null for non-message events
 */
function classifyMessageType(canonicalEvent) {
    // Status and unknown events don't have message types
    if (canonicalEvent.eventType === EVENT_TYPES.STATUS ||
        canonicalEvent.eventType === EVENT_TYPES.UNKNOWN) {
        return null;
    }

    // Interactive events: determine button vs list
    if (canonicalEvent.eventType === EVENT_TYPES.INTERACTIVE) {
        const raw = (canonicalEvent.metadata && canonicalEvent.metadata.raw) || {};
        if (raw.ListId) return 'list';
        if (raw.ButtonText) return 'button';
        return MESSAGE_TYPES.INTERACTIVE;
    }

    // Run through classifier registry for message events
    for (const classifier of MESSAGE_TYPE_CLASSIFIERS) {
        if (classifier.test(canonicalEvent)) {
            return classifier.type;
        }
    }

    return MESSAGE_TYPES.UNKNOWN;
}

module.exports = {
    classifyMessageType,
    MESSAGE_TYPE_CLASSIFIERS,
};
