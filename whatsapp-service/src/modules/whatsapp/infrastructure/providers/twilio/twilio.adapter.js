// Twilio payload adapter and normalizer
const { createCanonicalEvent } = require('../../../domain/models/canonical-event');
const { NormalizationError } = require('../../../domain/errors/webhook.errors');

// Strip whatsapp: prefix and normalize phone number
function normalizePhone(phone) {
    if (!phone) return null;

    let cleaned = phone.replace(/^whatsapp:/i, '').trim();

    if (cleaned && !cleaned.startsWith('+')) {
        cleaned = `+${cleaned}`;
    }

    return cleaned || null;
}

// Extract media items from indexed fields (MediaUrl0, MediaContentType0, etc.)
function extractMedia(payload) {
    const numMedia = parseInt(payload.NumMedia, 10) || 0;

    if (numMedia === 0) return null;

    const media = [];
    for (let i = 0; i < numMedia; i++) {
        const url = payload[`MediaUrl${i}`];
        const contentType = payload[`MediaContentType${i}`];

        if (url && contentType) {
            media.push({ url, contentType, index: i });
        }
    }

    return media.length > 0 ? media : null;
}

// Normalize validated Twilio payload into canonical event
function normalize(validatedPayload) {
    try {
        const media = extractMedia(validatedPayload);
        const bodyText = validatedPayload.Body
            ? validatedPayload.Body.trim()
            : null;

        return createCanonicalEvent({
            id: validatedPayload.MessageSid,
            provider: 'twilio',
            channel: 'whatsapp',

            // eventType and messageType will be set by classifiers
            eventType: null,
            messageType: null,

            sender: {
                phone: normalizePhone(validatedPayload.From),
                name: validatedPayload.ProfileName || null,
                waId: validatedPayload.WaId || null,
            },

            recipient: {
                phone: normalizePhone(validatedPayload.To),
            },

            // Twilio webhooks don't include timestamps; use reception time
            timestamp: new Date().toISOString(),

            content: {
                text: bodyText,
                media: media,
                caption: media && bodyText ? bodyText : null,
                latitude: validatedPayload.Latitude
                    ? parseFloat(validatedPayload.Latitude)
                    : null,
                longitude: validatedPayload.Longitude
                    ? parseFloat(validatedPayload.Longitude)
                    : null,
                status: validatedPayload.MessageStatus || null,
            },

            metadata: {
                accountSid: validatedPayload.AccountSid,
                apiVersion: validatedPayload.ApiVersion || null,
                numSegments: validatedPayload.NumSegments
                    ? parseInt(validatedPayload.NumSegments, 10)
                    : null,
                raw: validatedPayload,
            },
        });
    } catch (error) {
        throw new NormalizationError(
            `Failed to normalize Twilio payload: ${error.message}`,
            { originalError: error.message }
        );
    }
}

module.exports = {
    normalize,
    normalizePhone,
    extractMedia,
};
