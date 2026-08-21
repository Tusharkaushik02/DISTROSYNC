/**
 * Tests for event type and message type classifiers.
 */

const { classifyEventType } = require('../../src/whatsapp/classification/event.classifier');
const { classifyMessageType } = require('../../src/whatsapp/classification/message.classifier');
const { EVENT_TYPES, MESSAGE_TYPES } = require('../../src/whatsapp/events/event.types');

// ── Helper: minimal canonical event ───────────────────────────────────

function makeEvent(overrides = {}) {
    return {
        id: 'SM123',
        provider: 'twilio',
        channel: 'whatsapp',
        eventType: null,
        messageType: null,
        sender: { phone: '+919876543210', name: null, waId: null },
        recipient: { phone: '+14155238886' },
        timestamp: new Date().toISOString(),
        content: {
            text: null,
            media: null,
            caption: null,
            latitude: null,
            longitude: null,
            status: null,
        },
        metadata: {
            accountSid: 'AC123',
            apiVersion: '2010-04-01',
            numSegments: 1,
            raw: {},
        },
        ...overrides,
    };
}

describe('Event Type Classifier', () => {

    it('should classify status callbacks', () => {
        const event = makeEvent({
            metadata: { raw: { MessageSid: 'SM123', AccountSid: 'AC123', MessageStatus: 'delivered' } },
        });
        expect(classifyEventType(event)).toBe(EVENT_TYPES.STATUS);
    });

    it('should classify interactive button press', () => {
        const event = makeEvent({
            metadata: { raw: { MessageSid: 'SM123', ButtonText: 'Yes', Body: 'Yes' } },
        });
        expect(classifyEventType(event)).toBe(EVENT_TYPES.INTERACTIVE);
    });

    it('should classify interactive list selection', () => {
        const event = makeEvent({
            metadata: { raw: { MessageSid: 'SM123', ListId: 'list_1', Body: 'Option A' } },
        });
        expect(classifyEventType(event)).toBe(EVENT_TYPES.INTERACTIVE);
    });

    it('should classify text messages', () => {
        const event = makeEvent({
            metadata: { raw: { MessageSid: 'SM123', Body: 'Hello', NumMedia: '0' } },
        });
        expect(classifyEventType(event)).toBe(EVENT_TYPES.MESSAGE);
    });

    it('should classify media messages', () => {
        const event = makeEvent({
            metadata: { raw: { MessageSid: 'SM123', NumMedia: '1', MediaUrl0: 'http://x' } },
        });
        expect(classifyEventType(event)).toBe(EVENT_TYPES.MESSAGE);
    });

    it('should return unknown for unrecognized payloads', () => {
        const event = makeEvent({ metadata: { raw: {} } });
        expect(classifyEventType(event)).toBe(EVENT_TYPES.UNKNOWN);
    });

    it('should classify as message (not status) when MessageStatus AND Body are both present', () => {
        const event = makeEvent({
            metadata: { raw: { MessageSid: 'SM123', MessageStatus: 'sent', Body: 'Hello' } },
        });
        // Has MessageStatus but also has Body — it's a message
        expect(classifyEventType(event)).toBe(EVENT_TYPES.MESSAGE);
    });
});

describe('Message Type Classifier', () => {

    it('should classify text messages', () => {
        const event = makeEvent({
            eventType: EVENT_TYPES.MESSAGE,
            content: { text: 'Hello', media: null },
            metadata: { raw: { Body: 'Hello' } },
        });
        expect(classifyMessageType(event)).toBe(MESSAGE_TYPES.TEXT);
    });

    it('should classify image messages (JPEG)', () => {
        const event = makeEvent({
            eventType: EVENT_TYPES.MESSAGE,
            content: { text: null, media: [{ url: 'http://x', contentType: 'image/jpeg', index: 0 }] },
            metadata: { raw: {} },
        });
        expect(classifyMessageType(event)).toBe(MESSAGE_TYPES.IMAGE);
    });

    it('should classify image messages (PNG)', () => {
        const event = makeEvent({
            eventType: EVENT_TYPES.MESSAGE,
            content: { text: null, media: [{ url: 'http://x', contentType: 'image/png', index: 0 }] },
            metadata: { raw: {} },
        });
        expect(classifyMessageType(event)).toBe(MESSAGE_TYPES.IMAGE);
    });

    it('should classify stickers (image/webp)', () => {
        const event = makeEvent({
            eventType: EVENT_TYPES.MESSAGE,
            content: { text: null, media: [{ url: 'http://x', contentType: 'image/webp', index: 0 }] },
            metadata: { raw: {} },
        });
        expect(classifyMessageType(event)).toBe(MESSAGE_TYPES.STICKER);
    });

    it('should classify video messages', () => {
        const event = makeEvent({
            eventType: EVENT_TYPES.MESSAGE,
            content: { text: null, media: [{ url: 'http://x', contentType: 'video/mp4', index: 0 }] },
            metadata: { raw: {} },
        });
        expect(classifyMessageType(event)).toBe(MESSAGE_TYPES.VIDEO);
    });

    it('should classify audio messages', () => {
        const event = makeEvent({
            eventType: EVENT_TYPES.MESSAGE,
            content: { text: null, media: [{ url: 'http://x', contentType: 'audio/ogg', index: 0 }] },
            metadata: { raw: {} },
        });
        expect(classifyMessageType(event)).toBe(MESSAGE_TYPES.AUDIO);
    });

    it('should classify document messages (PDF)', () => {
        const event = makeEvent({
            eventType: EVENT_TYPES.MESSAGE,
            content: { text: null, media: [{ url: 'http://x', contentType: 'application/pdf', index: 0 }] },
            metadata: { raw: {} },
        });
        expect(classifyMessageType(event)).toBe(MESSAGE_TYPES.DOCUMENT);
    });

    it('should classify location messages', () => {
        const event = makeEvent({
            eventType: EVENT_TYPES.MESSAGE,
            content: { text: null, media: null },
            metadata: { raw: { Latitude: '12.9716', Longitude: '77.5946' } },
        });
        expect(classifyMessageType(event)).toBe(MESSAGE_TYPES.LOCATION);
    });

    it('should classify contact messages', () => {
        const event = makeEvent({
            eventType: EVENT_TYPES.MESSAGE,
            content: { text: null, media: null },
            metadata: { raw: { vCard: 'BEGIN:VCARD...' } },
        });
        expect(classifyMessageType(event)).toBe(MESSAGE_TYPES.CONTACT);
    });

    it('should classify interactive messages within message eventType', () => {
        const event = makeEvent({
            eventType: EVENT_TYPES.MESSAGE,
            content: { text: 'Yes', media: null },
            metadata: { raw: { ButtonText: 'Yes' } },
        });
        expect(classifyMessageType(event)).toBe(MESSAGE_TYPES.INTERACTIVE);
    });

    it('should return null for status events', () => {
        const event = makeEvent({ eventType: EVENT_TYPES.STATUS });
        expect(classifyMessageType(event)).toBeNull();
    });

    it('should return null for unknown events', () => {
        const event = makeEvent({ eventType: EVENT_TYPES.UNKNOWN });
        expect(classifyMessageType(event)).toBeNull();
    });

    it('should classify interactive.button for interactive eventType with ButtonText', () => {
        const event = makeEvent({
            eventType: EVENT_TYPES.INTERACTIVE,
            metadata: { raw: { ButtonText: 'Confirm' } },
        });
        expect(classifyMessageType(event)).toBe('button');
    });

    it('should classify interactive.list for interactive eventType with ListId', () => {
        const event = makeEvent({
            eventType: EVENT_TYPES.INTERACTIVE,
            metadata: { raw: { ListId: 'option_1' } },
        });
        expect(classifyMessageType(event)).toBe('list');
    });

    it('should fall back to unknown for empty message content', () => {
        const event = makeEvent({
            eventType: EVENT_TYPES.MESSAGE,
            content: { text: null, media: null },
            metadata: { raw: {} },
        });
        expect(classifyMessageType(event)).toBe(MESSAGE_TYPES.UNKNOWN);
    });
});
