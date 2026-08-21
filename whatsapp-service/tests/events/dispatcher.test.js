/**
 * Tests for the event dispatcher.
 */

const { dispatch } = require('../../src/whatsapp/events/event.dispatcher');
const { EVENT_TYPES, MESSAGE_TYPES } = require('../../src/whatsapp/events/event.types');

function makeEvent(eventType, messageType) {
    return {
        id: 'SM123',
        provider: 'twilio',
        channel: 'whatsapp',
        eventType,
        messageType,
        sender: { phone: '+919876543210' },
        recipient: { phone: '+14155238886' },
        timestamp: new Date().toISOString(),
        content: {},
        metadata: { raw: {} },
    };
}

describe('Event Dispatcher', () => {

    describe('Message events', () => {
        const messageTypes = [
            [MESSAGE_TYPES.TEXT, 'message.text'],
            [MESSAGE_TYPES.IMAGE, 'message.image'],
            [MESSAGE_TYPES.AUDIO, 'message.audio'],
            [MESSAGE_TYPES.VIDEO, 'message.video'],
            [MESSAGE_TYPES.DOCUMENT, 'message.document'],
            [MESSAGE_TYPES.LOCATION, 'message.location'],
            [MESSAGE_TYPES.CONTACT, 'message.contact'],
            [MESSAGE_TYPES.STICKER, 'message.sticker'],
            [MESSAGE_TYPES.INTERACTIVE, 'message.interactive'],
        ];

        it.each(messageTypes)(
            'should dispatch message.%s → "%s"',
            (messageType, expectedEvent) => {
                const event = makeEvent(EVENT_TYPES.MESSAGE, messageType);
                const result = dispatch(event);
                expect(result.event).toBe(expectedEvent);
                expect(result.canonicalEvent).toBe(event);
            }
        );
    });

    describe('Interactive events', () => {
        it('should dispatch interactive.button', () => {
            const event = makeEvent(EVENT_TYPES.INTERACTIVE, 'button');
            const result = dispatch(event);
            expect(result.event).toBe('interactive.button');
        });

        it('should dispatch interactive.list', () => {
            const event = makeEvent(EVENT_TYPES.INTERACTIVE, 'list');
            const result = dispatch(event);
            expect(result.event).toBe('interactive.list');
        });
    });

    describe('Status events', () => {
        it('should dispatch status', () => {
            const event = makeEvent(EVENT_TYPES.STATUS, null);
            const result = dispatch(event);
            expect(result.event).toBe('status');
        });
    });

    describe('Unknown events', () => {
        it('should dispatch unknown for unrecognized type', () => {
            const event = makeEvent(EVENT_TYPES.UNKNOWN, null);
            const result = dispatch(event);
            expect(result.event).toBe('unknown');
        });

        it('should fall back to unknown for unregistered combinations', () => {
            const event = makeEvent('nonexistent', 'bizarre');
            const result = dispatch(event);
            expect(result.event).toBe('unknown');
        });
    });

    describe('Return structure', () => {
        it('should return { event, canonicalEvent }', () => {
            const event = makeEvent(EVENT_TYPES.MESSAGE, MESSAGE_TYPES.TEXT);
            const result = dispatch(event);
            expect(result).toHaveProperty('event');
            expect(result).toHaveProperty('canonicalEvent');
            expect(result.canonicalEvent).toBe(event);
        });
    });
});
