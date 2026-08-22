const { EVENT_TYPES, MESSAGE_TYPES } = require('../../application/events/event.types');

// Build provider-independent canonical event structure
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
