const { mediaHandler, identifyMediaType } = require('../../src/whatsapp/handlers/media.handler');
const { EVENT_TYPES, MESSAGE_TYPES } = require('../../src/whatsapp/events/event.types');

function makeMediaEvent(contentType, messageType) {
    return {
        id: 'SM123',
        provider: 'twilio',
        channel: 'whatsapp',
        eventType: EVENT_TYPES.MESSAGE,
        messageType: messageType,
        sender: { phone: '+919876543210' },
        recipient: { phone: '+14155238886' },
        timestamp: '2026-01-01T00:00:00.000Z',
        content: {
            text: null,
            media: [{ url: 'https://example.com/file', contentType, index: 0 }],
        },
        metadata: { raw: {} },
    };
}

describe('Media Handler', () => {
    describe('identifyMediaType', () => {
        it('should identify image type', () => {
            expect(identifyMediaType(makeMediaEvent('image/jpeg', MESSAGE_TYPES.IMAGE))).toBe('image');
        });

        it('should identify video type', () => {
            expect(identifyMediaType(makeMediaEvent('video/mp4', MESSAGE_TYPES.VIDEO))).toBe('video');
        });

        it('should identify audio type', () => {
            expect(identifyMediaType(makeMediaEvent('audio/ogg', MESSAGE_TYPES.AUDIO))).toBe('audio');
        });

        it('should identify application type for documents', () => {
            expect(identifyMediaType(makeMediaEvent('application/pdf', MESSAGE_TYPES.DOCUMENT))).toBe('application');
        });

        it('should return unknown for missing media', () => {
            const event = makeMediaEvent('image/jpeg', MESSAGE_TYPES.IMAGE);
            event.content.media = null;
            expect(identifyMediaType(event)).toBe('unknown');
        });
    });

    describe('mediaHandler', () => {
        const mediaTypes = [
            ['image/jpeg', MESSAGE_TYPES.IMAGE, 'message.image'],
            ['video/mp4', MESSAGE_TYPES.VIDEO, 'message.video'],
            ['audio/ogg', MESSAGE_TYPES.AUDIO, 'message.audio'],
            ['application/pdf', MESSAGE_TYPES.DOCUMENT, 'message.document'],
            ['image/webp', MESSAGE_TYPES.STICKER, 'message.sticker'],
        ];

        it.each(mediaTypes)(
            'should reject %s → %s',
            (contentType, messageType, eventString) => {
                const event = makeMediaEvent(contentType, messageType);
                const result = mediaHandler(event, eventString);

                expect(result.handled).toBe(false);
                expect(result.status).toBe('rejected');
                expect(result.error.code).toBe('MEDIA_NOT_SUPPORTED');
                expect(result.data.mediaCount).toBe(1);
            }
        );

        it('should reject location events', () => {
            const event = {
                id: 'SM123',
                eventType: EVENT_TYPES.MESSAGE,
                messageType: MESSAGE_TYPES.LOCATION,
                sender: { phone: '+919876543210' },
                content: { media: null, latitude: 12.9, longitude: 77.5 },
                metadata: { raw: {} },
            };

            const result = mediaHandler(event, 'message.location');
            expect(result.handled).toBe(false);
            expect(result.error.code).toBe('MEDIA_NOT_SUPPORTED');
        });

        it('should reject contact events', () => {
            const event = {
                id: 'SM123',
                eventType: EVENT_TYPES.MESSAGE,
                messageType: MESSAGE_TYPES.CONTACT,
                sender: { phone: '+919876543210' },
                content: { media: null },
                metadata: { raw: { vCard: 'BEGIN:VCARD' } },
            };

            const result = mediaHandler(event, 'message.contact');
            expect(result.handled).toBe(false);
            expect(result.error.code).toBe('MEDIA_NOT_SUPPORTED');
        });
    });
});
