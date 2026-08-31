const { dispatch, handle, HANDLER_REGISTRY } = require('../../src/modules/whatsapp/application/events/event.dispatcher');
const { EVENT_TYPES, MESSAGE_TYPES } = require('../../src/modules/whatsapp/application/events/event.types');

function makeEvent(eventType, messageType, extras = {}) {
    return {
        id: 'SM123',
        provider: 'twilio',
        channel: 'whatsapp',
        eventType,
        messageType,
        sender: { phone: '+919876543210', name: 'Sourav' },
        recipient: { phone: '+14155238886' },
        timestamp: '2026-01-01T00:00:00.000Z',
        content: { text: 'Test message', media: null },
        metadata: { raw: {}, ...extras },
    };
}

describe('Dispatch → Handle Integration', () => {
    describe('dispatch() backward compatibility', () => {
        it('should still return { event, canonicalEvent }', () => {
            const event = makeEvent(EVENT_TYPES.MESSAGE, MESSAGE_TYPES.TEXT);
            const result = dispatch(event);

            expect(result).toHaveProperty('event', 'message.text');
            expect(result).toHaveProperty('canonicalEvent');
            expect(result.canonicalEvent).toBe(event);
        });
    });

    describe('HANDLER_REGISTRY completeness', () => {
        const expectedEvents = [
            'message.text', 'interactive.button', 'interactive.list',
            'message.image', 'message.audio', 'message.video',
            'message.document', 'message.location', 'message.sticker',
            'message.contact', 'status', 'unknown',
        ];

        it.each(expectedEvents)('should have handler for "%s"', (event) => {
            expect(HANDLER_REGISTRY[event]).toBeDefined();
            expect(typeof HANDLER_REGISTRY[event]).toBe('function');
        });
    });

    describe('Text message end-to-end', () => {
        it('should dispatch and handle text message', () => {
            const event = makeEvent(EVENT_TYPES.MESSAGE, MESSAGE_TYPES.TEXT);
            const dispatchResult = dispatch(event);
            const handlerResult = handle(dispatchResult);

            expect(handlerResult.handled).toBe(true);
            expect(handlerResult.event).toBe('message.text');
            expect(handlerResult.status).toBe('processed');
            expect(handlerResult.data.extracted.text).toBe('Test message');
        });
    });

    describe('Button event end-to-end', () => {
        it('should dispatch and handle button press', () => {
            const event = makeEvent(EVENT_TYPES.INTERACTIVE, 'button');
            event.metadata.raw = { ButtonText: 'Track Order' };
            const dispatchResult = dispatch(event);
            const handlerResult = handle(dispatchResult);

            expect(handlerResult.handled).toBe(true);
            expect(handlerResult.action).toBe('track_order');
            expect(handlerResult.status).toBe('pending_implementation');
        });
    });

    describe('Media event end-to-end', () => {
        it('should dispatch and reject image', () => {
            const event = makeEvent(EVENT_TYPES.MESSAGE, MESSAGE_TYPES.IMAGE);
            event.content.media = [{ url: 'https://example.com/img.jpg', contentType: 'image/jpeg', index: 0 }];
            const dispatchResult = dispatch(event);
            const handlerResult = handle(dispatchResult);

            expect(handlerResult.handled).toBe(false);
            expect(handlerResult.event).toBe('message.image');
            expect(handlerResult.error.code).toBe('MEDIA_NOT_SUPPORTED');
        });
    });

    describe('Unsupported event end-to-end', () => {
        it('should dispatch and reject status callback', () => {
            const event = makeEvent(EVENT_TYPES.STATUS, null);
            const dispatchResult = dispatch(event);
            const handlerResult = handle(dispatchResult);

            expect(handlerResult.handled).toBe(false);
            expect(handlerResult.error.code).toBe('UNSUPPORTED_EVENT');
        });

        it('should dispatch and reject unknown event', () => {
            const event = makeEvent(EVENT_TYPES.UNKNOWN, null);
            const dispatchResult = dispatch(event);
            const handlerResult = handle(dispatchResult);

            expect(handlerResult.handled).toBe(false);
            expect(handlerResult.error.code).toBe('UNSUPPORTED_EVENT');
        });
    });

    describe('Unregistered event fallback', () => {
        it('should fall back to unsupported handler for unregistered events', () => {
            const event = makeEvent('alien', 'probe');
            const dispatchResult = dispatch(event);
            const handlerResult = handle(dispatchResult);

            expect(handlerResult.handled).toBe(false);
            expect(handlerResult.error.code).toBe('UNSUPPORTED_EVENT');
        });
    });
});
