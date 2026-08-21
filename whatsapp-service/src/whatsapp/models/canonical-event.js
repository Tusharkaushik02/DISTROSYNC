/**
 * Canonical event factory.
 *
 * Builds the provider-independent canonical event structure that every
 * downstream consumer uses. Fields not relevant to a specific event type
 * are set to null (not omitted) for schema consistency.
 */

const { EVENT_TYPES, MESSAGE_TYPES } = require('../events/event.types');

/**
 * Create a canonical event from normalized data.
 *
 * @param {object} data
 * @param {string} data.id — Provider message ID (e.g. MessageSid)
 * @param {string} [data.provider='twilio']
 * @param {string} [data.channel='whatsapp']
 * @param {string} [data.eventType='unknown']
 * @param {string|null} [data.messageType=null]
 * @param {object} [data.sender]
 * @param {string} [data.sender.phone]
 * @param {string|null} [data.sender.name]
 * @param {string|null} [data.sender.waId]
 * @param {object} [data.recipient]
 * @param {string} [data.recipient.phone]
 * @param {string} [data.timestamp]
 * @param {object} [data.content]
 * @param {string|null} [data.content.text]
 * @param {Array|null} [data.content.media]
 * @param {string|null} [data.content.caption]
 * @param {number|null} [data.content.latitude]
 * @param {number|null} [data.content.longitude]
 * @param {string|null} [data.content.status]
 * @param {object} [data.metadata]
 * @returns {object} Canonical event
 */
function createCanonicalEvent(data) {
    return {
        id: data.id || null,
        provider: data.provider || 'twilio',
        channel: data.channel || 'whatsapp',
        eventType: data.eventType || EVENT_TYPES.UNKNOWN,
        messageType: data.messageType || null,

        sender: {
            phone: (data.sender && data.sender.phone) || null,
            name: (data.sender && data.sender.name) || null,
            waId: (data.sender && data.sender.waId) || null,
        },

        recipient: {
            phone: (data.recipient && data.recipient.phone) || null,
        },

        timestamp: data.timestamp || new Date().toISOString(),

        content: {
            text: (data.content && data.content.text) || null,
            media: (data.content && data.content.media) || null,
            caption: (data.content && data.content.caption) || null,
            latitude: (data.content && data.content.latitude) || null,
            longitude: (data.content && data.content.longitude) || null,
            status: (data.content && data.content.status) || null,
        },

        metadata: {
            accountSid: (data.metadata && data.metadata.accountSid) || null,
            apiVersion: (data.metadata && data.metadata.apiVersion) || null,
            numSegments: (data.metadata && data.metadata.numSegments) || null,
            raw: (data.metadata && data.metadata.raw) || null,
        },
    };
}

module.exports = {
    createCanonicalEvent,
};
