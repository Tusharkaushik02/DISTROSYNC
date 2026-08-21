/**
 * Zod v4 validation schemas for Twilio WhatsApp webhook payloads.
 *
 * Three discriminated schemas based on webhook type:
 *   - Text Message
 *   - Media Message
 *   - Status Callback
 *
 * Auto-detection logic determines which schema to apply.
 */

const { z } = require('zod');

// ── Shared field schemas ──────────────────────────────────────────────

const sidField = z.string().min(1, 'SID is required');
const phoneField = z.string().min(1, 'Phone number is required');

// ── Text Message Schema ───────────────────────────────────────────────

const textMessageSchema = z.object({
    MessageSid: sidField,
    AccountSid: sidField,
    From: phoneField,
    To: phoneField,
    Body: z.string().min(1, 'Message body is required for text messages'),

    // Optional fields
    ProfileName: z.string().optional(),
    WaId: z.string().optional(),
    NumMedia: z.string().optional(),
    NumSegments: z.string().optional(),
    SmsMessageSid: z.string().optional(),
    SmsSid: z.string().optional(),
    SmsStatus: z.string().optional(),
    ApiVersion: z.string().optional(),
    MessageType: z.string().optional(),
}).passthrough();

// ── Media Message Schema ──────────────────────────────────────────────

const mediaMessageSchema = z.object({
    MessageSid: sidField,
    AccountSid: sidField,
    From: phoneField,
    To: phoneField,
    NumMedia: z.string().refine(
        (val) => parseInt(val, 10) >= 1,
        { message: 'NumMedia must be >= 1 for media messages' }
    ),
    MediaContentType0: z.string().min(1, 'MediaContentType0 is required for media messages'),
    MediaUrl0: z.string().url('MediaUrl0 must be a valid URL'),

    // Caption is optional for media messages
    Body: z.string().optional(),
    ProfileName: z.string().optional(),
    WaId: z.string().optional(),
    NumSegments: z.string().optional(),
    SmsMessageSid: z.string().optional(),
    SmsSid: z.string().optional(),
    SmsStatus: z.string().optional(),
    ApiVersion: z.string().optional(),
    MessageType: z.string().optional(),
}).passthrough();

// ── Status Callback Schema ────────────────────────────────────────────

const statusCallbackSchema = z.object({
    MessageSid: sidField,
    AccountSid: sidField,
    MessageStatus: z.string().min(1, 'MessageStatus is required for status callbacks'),

    // These may or may not be present for status callbacks
    From: z.string().optional(),
    To: z.string().optional(),
    ChannelPrefix: z.string().optional(),
    ApiVersion: z.string().optional(),
    SmsSid: z.string().optional(),
    SmsStatus: z.string().optional(),
}).passthrough();

// ── Location Message Schema ───────────────────────────────────────────

const locationMessageSchema = z.object({
    MessageSid: sidField,
    AccountSid: sidField,
    From: phoneField,
    To: phoneField,
    Latitude: z.string().min(1, 'Latitude is required for location messages'),
    Longitude: z.string().min(1, 'Longitude is required for location messages'),

    // Optional fields
    Body: z.string().optional(),
    ProfileName: z.string().optional(),
    WaId: z.string().optional(),
    NumMedia: z.string().optional(),
    NumSegments: z.string().optional(),
    SmsMessageSid: z.string().optional(),
    SmsSid: z.string().optional(),
    SmsStatus: z.string().optional(),
    ApiVersion: z.string().optional(),
    MessageType: z.string().optional(),
}).passthrough();

// ── Contact Message Schema ────────────────────────────────────────────

const contactMessageSchema = z.object({
    MessageSid: sidField,
    AccountSid: sidField,
    From: phoneField,
    To: phoneField,
    vCard: z.string().min(1, 'vCard is required for contact messages'),

    // Optional fields
    Body: z.string().optional(),
    ProfileName: z.string().optional(),
    WaId: z.string().optional(),
    NumMedia: z.string().optional(),
    NumSegments: z.string().optional(),
    SmsMessageSid: z.string().optional(),
    SmsSid: z.string().optional(),
    SmsStatus: z.string().optional(),
    ApiVersion: z.string().optional(),
    MessageType: z.string().optional(),
}).passthrough();

// ── Interactive Message Schema ────────────────────────────────────────

const interactiveMessageSchema = z.object({
    MessageSid: sidField,
    AccountSid: sidField,
    From: phoneField,
    To: phoneField,

    // Optional fields
    Body: z.string().optional(),
    ButtonText: z.string().optional(),
    ListId: z.string().optional(),
    ProfileName: z.string().optional(),
    WaId: z.string().optional(),
    NumMedia: z.string().optional(),
    NumSegments: z.string().optional(),
    SmsMessageSid: z.string().optional(),
    SmsSid: z.string().optional(),
    SmsStatus: z.string().optional(),
    ApiVersion: z.string().optional(),
    MessageType: z.string().optional(),
}).passthrough();

// ── Webhook type detection ────────────────────────────────────────────

/**
 * Detect which webhook type a payload represents.
 *
 * Order matters:
 *   1. Has MessageStatus and no Body/NumMedia → status
 *   2. Has NumMedia > 0 → media
 *   3. Has Latitude and Longitude → location
 *   4. Has vCard → contact
 *   5. Has ButtonText or ListId → interactive
 *   6. Default → text (general message)
 *
 * @param {object} body — Raw req.body from Twilio
 * @returns {'status' | 'media' | 'location' | 'contact' | 'interactive' | 'text'}
 */
function detectWebhookType(body) {
    // Status callback: has MessageStatus, no meaningful message content
    if (body.MessageStatus && !body.Body && (!body.NumMedia || body.NumMedia === '0')) {
        return 'status';
    }

    // Media message: has NumMedia >= 1
    if (body.NumMedia && parseInt(body.NumMedia, 10) >= 1) {
        return 'media';
    }

    // Location message: has Latitude and Longitude
    if (body.Latitude && body.Longitude) {
        return 'location';
    }

    // Contact message: has vCard
    if (body.vCard) {
        return 'contact';
    }

    // Interactive message: button press or list selection
    if (body.ButtonText || body.ListId) {
        return 'interactive';
    }

    // Default: text/general message
    return 'text';
}

/**
 * Get the appropriate schema for a webhook type.
 *
 * @param {'status' | 'media' | 'location' | 'contact' | 'interactive' | 'text'} webhookType
 * @returns {z.ZodObject}
 */
function getSchemaForType(webhookType) {
    switch (webhookType) {
        case 'status': return statusCallbackSchema;
        case 'media': return mediaMessageSchema;
        case 'location': return locationMessageSchema;
        case 'contact': return contactMessageSchema;
        case 'interactive': return interactiveMessageSchema;
        case 'text': return textMessageSchema;
        default: return textMessageSchema;
    }
}

module.exports = {
    textMessageSchema,
    mediaMessageSchema,
    statusCallbackSchema,
    locationMessageSchema,
    contactMessageSchema,
    interactiveMessageSchema,
    detectWebhookType,
    getSchemaForType,
};
