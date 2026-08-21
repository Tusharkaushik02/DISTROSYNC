/**
 * Twilio adapter — normalizes Twilio-specific webhook payloads into
 * provider-independent canonical events.
 *
 * This is the provider boundary. Everything downstream has zero knowledge
 * of Twilio field names.
 */

const { createCanonicalEvent } = require('../models/canonical-event');
const { NormalizationError } = require('../errors/webhook.errors');

/**
 * Strip the "whatsapp:" prefix and normalize to E.164 format.
 *
 * @param {string} phone — e.g. "whatsapp:+919876543210"
 * @returns {string} — e.g. "+919876543210"
 */
function normalizePhone(phone) {
    if (!phone) return null;

    let cleaned = phone.replace(/^whatsapp:/i, '').trim();

    if (cleaned && !cleaned.startsWith('+')) {
        cleaned = `+${cleaned}`;
    }

    return cleaned || null;
}

/**
 * Extract media items from Twilio payload.
 *
 * Twilio sends media as indexed fields: MediaUrl0, MediaContentType0, MediaUrl1, etc.
 *
 * @param {object} payload — Validated Twilio payload
 * @returns {Array<{url: string, contentType: string, index: number}>|null}
 */
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

/**
 * Normalize a validated Twilio webhook payload into a canonical event.
 *
 * @param {object} validatedPayload — Payload that passed Zod validation
 * @returns {object} Canonical event (without eventType/messageType — those are set by classifiers)
 */
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
