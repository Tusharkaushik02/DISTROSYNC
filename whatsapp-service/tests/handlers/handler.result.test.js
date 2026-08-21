const { createHandlerResult } = require('../../src/whatsapp/handlers/handler.result');

describe('Handler Result Factory', () => {
    it('should create result with all required fields', () => {
        const result = createHandlerResult({
            handled: true,
            event: 'message.text',
            status: 'processed',
        });

        expect(result).toEqual({
            handled: true,
            event: 'message.text',
            action: null,
            status: 'processed',
            data: {},
            error: null,
        });
    });

    it('should include action when provided', () => {
        const result = createHandlerResult({
            handled: true,
            event: 'interactive.button',
            action: 'track_order',
            status: 'pending_implementation',
        });

        expect(result.action).toBe('track_order');
    });

    it('should include data when provided', () => {
        const result = createHandlerResult({
            handled: true,
            event: 'message.text',
            status: 'processed',
            data: { text: 'hello' },
        });

        expect(result.data).toEqual({ text: 'hello' });
    });

    it('should include error when provided', () => {
        const result = createHandlerResult({
            handled: false,
            event: 'unknown',
            status: 'rejected',
            error: { code: 'UNSUPPORTED_EVENT', message: 'Not supported' },
        });

        expect(result.error).toEqual({ code: 'UNSUPPORTED_EVENT', message: 'Not supported' });
    });

    it('should coerce handled to boolean', () => {
        const result = createHandlerResult({
            handled: 1,
            event: 'message.text',
            status: 'processed',
        });

        expect(result.handled).toBe(true);
    });

    it('should default event to unknown when missing', () => {
        const result = createHandlerResult({
            handled: false,
            status: 'rejected',
        });

        expect(result.event).toBe('unknown');
    });
});
