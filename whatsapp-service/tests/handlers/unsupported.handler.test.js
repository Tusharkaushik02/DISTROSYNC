const { unsupportedHandler } = require('../../src/modules/whatsapp/application/handlers/unsupported.handler');
const { EVENT_TYPES } = require('../../src/modules/whatsapp/application/events/event.types');

describe('Unsupported Handler', () => {
    it('should reject status events', () => {
        const event = {
            eventType: EVENT_TYPES.STATUS,
            messageType: null,
            sender: { phone: '+919876543210' },
            content: { status: 'delivered' },
        };

        const result = unsupportedHandler(event, 'status');

        expect(result.handled).toBe(false);
        expect(result.status).toBe('rejected');
        expect(result.event).toBe('status');
        expect(result.error.code).toBe('UNSUPPORTED_EVENT');
        expect(result.data.eventType).toBe('status');
    });

    it('should reject unknown events', () => {
        const event = {
            eventType: EVENT_TYPES.UNKNOWN,
            messageType: null,
            sender: { phone: '+919876543210' },
        };

        const result = unsupportedHandler(event, 'unknown');

        expect(result.handled).toBe(false);
        expect(result.error.code).toBe('UNSUPPORTED_EVENT');
    });

    it('should reject unregistered event types', () => {
        const event = {
            eventType: 'custom_webhook',
            messageType: 'something',
        };

        const result = unsupportedHandler(event, 'custom_webhook.something');

        expect(result.handled).toBe(false);
        expect(result.event).toBe('custom_webhook.something');
        expect(result.data.eventType).toBe('custom_webhook');
        expect(result.data.messageType).toBe('something');
    });
});
