const { textHandler, extractText, buildTextContext } = require('../../src/modules/whatsapp/application/handlers/text.handler');
const { EVENT_TYPES, MESSAGE_TYPES } = require('../../src/modules/whatsapp/application/events/event.types');

function makeTextEvent(body) {
    return {
        id: 'SM123',
        provider: 'twilio',
        channel: 'whatsapp',
        eventType: EVENT_TYPES.MESSAGE,
        messageType: MESSAGE_TYPES.TEXT,
        sender: { phone: '+919876543210', name: 'Sourav', waId: '919876543210' },
        recipient: { phone: '+14155238886' },
        timestamp: '2026-01-01T00:00:00.000Z',
        content: { text: body, media: null },
        metadata: { raw: {} },
    };
}

describe('Text Handler', () => {
    describe('extractText', () => {
        it('should extract text and sender', () => {
            const result = extractText(makeTextEvent('Hello'));
            expect(result.text).toBe('Hello');
            expect(result.length).toBe(5);
            expect(result.sender).toBe('+919876543210');
        });

        it('should trim whitespace', () => {
            const result = extractText(makeTextEvent('  spaced  '));
            expect(result.text).toBe('spaced');
            expect(result.length).toBe(6);
        });

        it('should return empty string for null content', () => {
            const event = makeTextEvent(null);
            event.content.text = null;
            const result = extractText(event);
            expect(result.text).toBe('');
            expect(result.length).toBe(0);
        });
    });

    describe('buildTextContext', () => {
        it('should build full context object', () => {
            const event = makeTextEvent('Hello');
            const extracted = extractText(event);
            const context = buildTextContext(event, extracted);

            expect(context.text).toBe('Hello');
            expect(context.sender).toBe('+919876543210');
            expect(context.senderName).toBe('Sourav');
            expect(context.channel).toBe('whatsapp');
            expect(context.messageId).toBe('SM123');
        });
    });

    describe('textHandler', () => {
        it('should process valid text message', () => {
            const result = textHandler(makeTextEvent('I want to order rice'), 'message.text');

            expect(result.handled).toBe(true);
            expect(result.event).toBe('message.text');
            expect(result.status).toBe('processed');
            expect(result.data.extracted.text).toBe('I want to order rice');
            expect(result.data.context.sender).toBe('+919876543210');
        });

        it('should include stub pipeline stages', () => {
            const result = textHandler(makeTextEvent('Hello'), 'message.text');
            const { pipeline } = result.data;

            expect(pipeline.intent.implemented).toBe(false);
            expect(pipeline.entities.implemented).toBe(false);
            expect(pipeline.action.implemented).toBe(false);
            expect(pipeline.response.implemented).toBe(false);
        });

        it('should reject empty text', () => {
            const result = textHandler(makeTextEvent(''), 'message.text');

            expect(result.handled).toBe(false);
            expect(result.status).toBe('rejected');
            expect(result.error.code).toBe('EMPTY_TEXT');
        });

        it('should reject whitespace-only text', () => {
            const result = textHandler(makeTextEvent('   '), 'message.text');

            expect(result.handled).toBe(false);
            expect(result.error.code).toBe('EMPTY_TEXT');
        });

        it('should reject null text', () => {
            const event = makeTextEvent(null);
            event.content.text = null;
            const result = textHandler(event, 'message.text');

            expect(result.handled).toBe(false);
            expect(result.error.code).toBe('EMPTY_TEXT');
        });
    });
});
