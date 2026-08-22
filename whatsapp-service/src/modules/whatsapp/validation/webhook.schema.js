// Zod schemas for Twilio WhatsApp webhook payloads
const { z } = require('zod');

const sidField = z.string().min(1, 'SID is required');
const phoneField = z.string().min(1, 'Phone number is required');

// Text message schema
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

// Media message schema
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

// Status callback schema
const statusCallbackSchema = z.object({
    MessageSid: sidField,
    AccountSid: sidField,
    MessageStatus: z.string().min(1, 'MessageStatus is required for status callbacks'),
    From: z.string().optional(),
    To: z.string().optional(),
    ChannelPrefix: z.string().optional(),
    ApiVersion: z.string().optional(),
    SmsSid: z.string().optional(),
    SmsStatus: z.string().optional(),
}).passthrough();

// Location message schema
const locationMessageSchema = z.object({
    MessageSid: sidField,
    AccountSid: sidField,
    From: phoneField,
    To: phoneField,
    Latitude: z.string().min(1, 'Latitude is required for location messages'),
    Longitude: z.string().min(1, 'Longitude is required for location messages'),
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

// Contact message schema
const contactMessageSchema = z.object({
    MessageSid: sidField,
    AccountSid: sidField,
    From: phoneField,
    To: phoneField,
    vCard: z.string().min(1, 'vCard is required for contact messages'),
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

// Interactive message schema
const interactiveMessageSchema = z.object({
    MessageSid: sidField,
    AccountSid: sidField,
    From: phoneField,
    To: phoneField,
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

// Detect which webhook type a payload represents
function detectWebhookType(body) {
    if (body.MessageStatus && !body.Body && (!body.NumMedia || body.NumMedia === '0')) {
        return 'status';
    }
    if (body.NumMedia && parseInt(body.NumMedia, 10) >= 1) {
        return 'media';
    }
    if (body.Latitude && body.Longitude) {
        return 'location';
    }
    if (body.vCard) {
        return 'contact';
    }
    if (body.ButtonText || body.ListId) {
        return 'interactive';
    }
    return 'text';
}

// Get the appropriate schema for a webhook type
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
