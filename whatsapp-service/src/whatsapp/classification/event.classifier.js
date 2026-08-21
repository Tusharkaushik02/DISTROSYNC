/**
 * Event type classifier.
 *
 * Determines the top-level eventType of a canonical event:
 *   - "status"      — status callbacks (delivered, read, failed, etc.)
 *   - "interactive"  — button presses, list selections
 *   - "message"      — text, media, location, contact, etc.
 *   - "unknown"      — unrecognized payload
 */

const { EVENT_TYPES } = require('../events/event.types');

/**
 * Classify the event type from a canonical event.
 *
 * Uses the raw Twilio payload preserved in metadata.raw to check for
 * provider-specific fields that indicate event type.
 *
 * @param {object} canonicalEvent — Normalized canonical event
 * @returns {string} One of EVENT_TYPES values
 */
function classifyEventType(canonicalEvent) {
    const raw = (canonicalEvent.metadata && canonicalEvent.metadata.raw) || {};

    // Status callback: has MessageStatus, typically no Body/NumMedia content
    if (raw.MessageStatus) {
        // If it has MessageStatus but also has Body or media, it's a message
        // with a status (edge case). Pure status callbacks have no Body.
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
