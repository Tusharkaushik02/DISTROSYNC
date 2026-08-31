/**
 * Tests for the webhook payload validator.
 */

const { validate } = require('../../src/modules/whatsapp/validation/webhook.validator');

// ── Test Payloads ─────────────────────────────────────────────────────

const validTextPayload = {
    MessageSid: 'SM1234567890abcdef',
    AccountSid: 'AC1234567890abcdef',
    From: 'whatsapp:+919876543210',
    To: 'whatsapp:+14155238886',
    Body: 'Hello, World!',
    NumMedia: '0',
    ProfileName: 'John',
    WaId: '919876543210',
    SmsStatus: 'received',
    ApiVersion: '2010-04-01',
    NumSegments: '1',
};

const validMediaPayload = {
    MessageSid: 'SM1234567890abcdef',
    AccountSid: 'AC1234567890abcdef',
    From: 'whatsapp:+919876543210',
    To: 'whatsapp:+14155238886',
    Body: 'Check this photo',
    NumMedia: '1',
    MediaContentType0: 'image/jpeg',
    MediaUrl0: 'https://api.twilio.com/media/image.jpg',
    ProfileName: 'John',
    WaId: '919876543210',
};

const validStatusPayload = {
    MessageSid: 'SM1234567890abcdef',
    AccountSid: 'AC1234567890abcdef',
    MessageStatus: 'delivered',
    To: 'whatsapp:+919876543210',
    From: 'whatsapp:+14155238886',
    ChannelPrefix: 'whatsapp',
};

describe('Webhook Validator', () => {

    describe('Valid payloads', () => {
        it('should validate a text message', () => {
            const result = validate(validTextPayload);
            expect(result.valid).toBe(true);
            expect(result.webhookType).toBe('text');
            expect(result.data.MessageSid).toBe('SM1234567890abcdef');
        });

        it('should validate a media message', () => {
            const result = validate(validMediaPayload);
            expect(result.valid).toBe(true);
            expect(result.webhookType).toBe('media');
            expect(result.data.MediaUrl0).toBe('https://api.twilio.com/media/image.jpg');
        });

        it('should validate a status callback', () => {
            const result = validate(validStatusPayload);
            expect(result.valid).toBe(true);
            expect(result.webhookType).toBe('status');
            expect(result.data.MessageStatus).toBe('delivered');
        });
    });

    describe('Missing required fields', () => {
        it('should reject text message without MessageSid', () => {
            const { MessageSid, ...payload } = validTextPayload;
            const result = validate(payload);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'MessageSid')).toBe(true);
        });

        it('should reject text message without From', () => {
            const { From, ...payload } = validTextPayload;
            const result = validate(payload);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'From')).toBe(true);
        });

        it('should reject text message without To', () => {
            const { To, ...payload } = validTextPayload;
            const result = validate(payload);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'To')).toBe(true);
        });

        it('should reject text message with empty Body', () => {
            const payload = { ...validTextPayload, Body: '' };
            const result = validate(payload);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'Body')).toBe(true);
        });
    });

    describe('Media message validation', () => {
        it('should reject media message without MediaContentType0', () => {
            const { MediaContentType0, ...payload } = validMediaPayload;
            const result = validate(payload);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'MediaContentType0')).toBe(true);
        });

        it('should reject media message without MediaUrl0', () => {
            const { MediaUrl0, ...payload } = validMediaPayload;
            const result = validate(payload);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'MediaUrl0')).toBe(true);
        });

        it('should accept media message without Body (no caption)', () => {
            const { Body, ...payload } = validMediaPayload;
            const result = validate(payload);
            expect(result.valid).toBe(true);
            expect(result.webhookType).toBe('media');
        });
    });

    describe('Status callback validation', () => {
        it('should reject status callback without MessageStatus', () => {
            const { MessageStatus, ...payload } = validStatusPayload;
            // Without MessageStatus, it will be detected as text type
            // and fail because there's no Body
            const result = validate(payload);
            expect(result.valid).toBe(false);
        });
    });

    describe('Edge cases', () => {
        it('should reject empty body', () => {
            const result = validate({});
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('EMPTY_BODY');
        });

        it('should reject null body', () => {
            const result = validate(null);
            expect(result.valid).toBe(false);
        });

        it('should reject undefined body', () => {
            const result = validate(undefined);
            expect(result.valid).toBe(false);
        });

        it('should provide structured errors with field, code, and message', () => {
            const result = validate({ AccountSid: 'AC123' });
            expect(result.valid).toBe(false);
            result.errors.forEach(err => {
                expect(err).toHaveProperty('field');
                expect(err).toHaveProperty('code');
                expect(err).toHaveProperty('message');
            });
        });
    });
});
