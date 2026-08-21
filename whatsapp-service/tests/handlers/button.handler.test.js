const { buttonHandler } = require('../../src/whatsapp/handlers/button.handler');
const { BUTTON_ACTIONS, resolveButtonAction } = require('../../src/whatsapp/handlers/button/button.registry');
const { EVENT_TYPES } = require('../../src/whatsapp/events/event.types');

function makeButtonEvent(buttonText, listId) {
    return {
        id: 'SM123',
        provider: 'twilio',
        channel: 'whatsapp',
        eventType: EVENT_TYPES.INTERACTIVE,
        messageType: buttonText ? 'button' : 'list',
        sender: { phone: '+919876543210', name: 'Sourav' },
        recipient: { phone: '+14155238886' },
        timestamp: '2026-01-01T00:00:00.000Z',
        content: { text: buttonText || listId || '' },
        metadata: {
            raw: {
                ...(buttonText ? { ButtonText: buttonText } : {}),
                ...(listId ? { ListId: listId } : {}),
            },
        },
    };
}

describe('Button Registry', () => {
    it('should have all four required actions', () => {
        expect(BUTTON_ACTIONS).toHaveProperty('track_order');
        expect(BUTTON_ACTIONS).toHaveProperty('talk_to_human_sales');
        expect(BUTTON_ACTIONS).toHaveProperty('cancel_order');
        expect(BUTTON_ACTIONS).toHaveProperty('check_stock');
    });

    it('should resolve button label to action (case-insensitive)', () => {
        const action = resolveButtonAction('Track Order', null);
        expect(action).not.toBeNull();
        expect(action.id).toBe('track_order');
    });

    it('should resolve list ID directly', () => {
        const action = resolveButtonAction(null, 'cancel_order');
        expect(action).not.toBeNull();
        expect(action.id).toBe('cancel_order');
    });

    it('should return null for unknown label', () => {
        const action = resolveButtonAction('Random Button', null);
        expect(action).toBeNull();
    });

    it('should return null for unknown list ID', () => {
        const action = resolveButtonAction(null, 'nonexistent_action');
        expect(action).toBeNull();
    });
});

describe('Button Handler', () => {
    describe('Registered button actions', () => {
        it('should handle Track Order button', () => {
            const result = buttonHandler(makeButtonEvent('Track Order', null), 'interactive.button');

            expect(result.handled).toBe(true);
            expect(result.action).toBe('track_order');
            expect(result.status).toBe('pending_implementation');
        });

        it('should handle Talk to Human / Sales button', () => {
            const result = buttonHandler(makeButtonEvent('Talk to Human / Sales', null), 'interactive.button');

            expect(result.handled).toBe(true);
            expect(result.action).toBe('talk_to_human_sales');
            expect(result.status).toBe('pending_implementation');
        });

        it('should handle Cancel Order button', () => {
            const result = buttonHandler(makeButtonEvent('Cancel Order', null), 'interactive.button');

            expect(result.handled).toBe(true);
            expect(result.action).toBe('cancel_order');
        });

        it('should handle Check Stock button', () => {
            const result = buttonHandler(makeButtonEvent('Check Stock', null), 'interactive.button');

            expect(result.handled).toBe(true);
            expect(result.action).toBe('check_stock');
        });
    });

    describe('List selections via ListId', () => {
        it('should handle list selection by action ID', () => {
            const result = buttonHandler(makeButtonEvent(null, 'track_order'), 'interactive.list');

            expect(result.handled).toBe(true);
            expect(result.action).toBe('track_order');
        });
    });

    describe('Case insensitivity', () => {
        it('should resolve button text case-insensitively', () => {
            const result = buttonHandler(makeButtonEvent('track order', null), 'interactive.button');

            expect(result.handled).toBe(true);
            expect(result.action).toBe('track_order');
        });
    });

    describe('Rejection cases', () => {
        it('should reject unrecognized button text', () => {
            const result = buttonHandler(makeButtonEvent('Random Button', null), 'interactive.button');

            expect(result.handled).toBe(false);
            expect(result.status).toBe('rejected');
            expect(result.error.code).toBe('UNSUPPORTED_BUTTON');
        });

        it('should reject unrecognized list ID', () => {
            const result = buttonHandler(makeButtonEvent(null, 'nonexistent'), 'interactive.list');

            expect(result.handled).toBe(false);
            expect(result.error.code).toBe('UNSUPPORTED_BUTTON');
        });

        it('should reject when no button text or list ID', () => {
            const event = makeButtonEvent(null, null);
            event.metadata.raw = {};
            const result = buttonHandler(event, 'interactive.button');

            expect(result.handled).toBe(false);
            expect(result.error.code).toBe('UNSUPPORTED_BUTTON');
        });
    });
});
