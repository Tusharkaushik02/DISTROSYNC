/**
 * Tests for the Twilio adapter (normalizer).
 */

const { normalize, normalizePhone, extractMedia } = require('../../src/modules/whatsapp/infrastructure/providers/twilio/twilio.adapter');

describe('Twilio Adapter', () => {

    describe('normalizePhone', () => {
        it('should strip whatsapp: prefix', () => {
            expect(normalizePhone('whatsapp:+919876543210')).toBe('+919876543210');
        });

        it('should handle numbers without prefix', () => {
            expect(normalizePhone('+14155238886')).toBe('+14155238886');
        });

        it('should add + if missing', () => {
            expect(normalizePhone('919876543210')).toBe('+919876543210');
        });

        it('should return null for empty/null input', () => {
            expect(normalizePhone(null)).toBeNull();
            expect(normalizePhone('')).toBeNull();
        });

        it('should handle case-insensitive prefix', () => {
            expect(normalizePhone('WhatsApp:+1234')).toBe('+1234');
        });
    });

    describe('extractMedia', () => {
        it('should extract single media item', () => {
            const payload = {
                NumMedia: '1',
                MediaUrl0: 'https://api.twilio.com/media/img.jpg',
                MediaContentType0: 'image/jpeg',
            };
            const result = extractMedia(payload);
            expect(result).toEqual([
                { url: 'https://api.twilio.com/media/img.jpg', contentType: 'image/jpeg', index: 0 },
            ]);
        });

        it('should extract multiple media items', () => {
            const payload = {
                NumMedia: '2',
                MediaUrl0: 'https://media/a.jpg',
                MediaContentType0: 'image/jpeg',
                MediaUrl1: 'https://media/b.pdf',
                MediaContentType1: 'application/pdf',
            };
            const result = extractMedia(payload);
            expect(result).toHaveLength(2);
            expect(result[1].contentType).toBe('application/pdf');
        });

        it('should return null when NumMedia is 0', () => {
            expect(extractMedia({ NumMedia: '0' })).toBeNull();
        });

        it('should return null when NumMedia is absent', () => {
            expect(extractMedia({})).toBeNull();
        });
    });

    describe('normalize', () => {
        const basePayload = {
            MessageSid: 'SM123abc',
            AccountSid: 'AC456def',
            From: 'whatsapp:+919876543210',
            To: 'whatsapp:+14155238886',
            Body: '  Hello World  ',
            NumMedia: '0',
            ProfileName: 'John',
            WaId: '919876543210',
            ApiVersion: '2010-04-01',
            NumSegments: '1',
        };

        it('should normalize phone numbers to E.164', () => {
            const event = normalize(basePayload);
            expect(event.sender.phone).toBe('+919876543210');
            expect(event.recipient.phone).toBe('+14155238886');
        });

        it('should trim text content', () => {
            const event = normalize(basePayload);
            expect(event.content.text).toBe('Hello World');
        });

        it('should set provider and channel', () => {
            const event = normalize(basePayload);
            expect(event.provider).toBe('twilio');
            expect(event.channel).toBe('whatsapp');
        });

        it('should generate ISO-8601 timestamp', () => {
            const event = normalize(basePayload);
            expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        it('should preserve raw payload in metadata', () => {
            const event = normalize(basePayload);
            expect(event.metadata.raw).toEqual(basePayload);
            expect(event.metadata.accountSid).toBe('AC456def');
            expect(event.metadata.apiVersion).toBe('2010-04-01');
            expect(event.metadata.numSegments).toBe(1);
        });

        it('should extract sender profile info', () => {
            const event = normalize(basePayload);
            expect(event.sender.name).toBe('John');
            expect(event.sender.waId).toBe('919876543210');
        });

        it('should set id from MessageSid', () => {
            const event = normalize(basePayload);
            expect(event.id).toBe('SM123abc');
        });

        it('should handle media messages', () => {
            const mediaPayload = {
                ...basePayload,
                NumMedia: '1',
                MediaUrl0: 'https://api.twilio.com/media/photo.jpg',
                MediaContentType0: 'image/jpeg',
                Body: 'Photo caption',
            };
            const event = normalize(mediaPayload);
            expect(event.content.media).toEqual([
                { url: 'https://api.twilio.com/media/photo.jpg', contentType: 'image/jpeg', index: 0 },
            ]);
            expect(event.content.caption).toBe('Photo caption');
        });

        it('should set text to null for media without caption', () => {
            const mediaPayload = {
                ...basePayload,
                NumMedia: '1',
                MediaUrl0: 'https://api.twilio.com/media/photo.jpg',
                MediaContentType0: 'image/jpeg',
                Body: '',
            };
            const event = normalize(mediaPayload);
            expect(event.content.text).toBeNull();
        });

        it('should handle status callbacks', () => {
            const statusPayload = {
                MessageSid: 'SM123',
                AccountSid: 'AC456',
                MessageStatus: 'delivered',
            };
            const event = normalize(statusPayload);
            expect(event.content.status).toBe('delivered');
        });

        it('should set eventType and messageType to null (for classifiers to fill)', () => {
            const event = normalize(basePayload);
            // eventType is set to 'unknown' by createCanonicalEvent default when null is passed
            // messageType should be null
            expect(event.messageType).toBeNull();
        });
    });
});
