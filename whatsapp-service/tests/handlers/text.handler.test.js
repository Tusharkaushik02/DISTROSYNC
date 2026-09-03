jest.mock('../../src/modules/whatsapp/application/services/ai.service', () => ({
    generateAIResponse: jest.fn(),
}));

jest.mock('../../src/modules/whatsapp/application/services/whatsapp.service', () => ({
    sendMessage: jest.fn(),
}));

const { textHandler, extractText, buildTextContext } = require('../../src/modules/whatsapp/application/handlers/text.handler');
const { generateAIResponse } = require('../../src/modules/whatsapp/application/services/ai.service');
const { sendMessage } = require('../../src/modules/whatsapp/application/services/whatsapp.service');
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
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.WHATSAPP_TENANT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
        generateAIResponse.mockResolvedValue('Hi! How can I help you today?');
        sendMessage.mockResolvedValue({
            sid: 'SMout123',
            to: 'whatsapp:+919876543210',
            status: 'queued',
        });
    });

    afterEach(() => {
        delete process.env.WHATSAPP_TENANT_ID;
    });

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
        it('should send valid text to AI service and reply on WhatsApp', async () => {
            const result = await textHandler(makeTextEvent('Hello'), 'message.text');

            expect(generateAIResponse).toHaveBeenCalledWith(
                'Hello',
                '919876543210',
                'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            );
            expect(sendMessage).toHaveBeenCalledWith('+919876543210', 'Hi! How can I help you today?');
            expect(result.handled).toBe(true);
            expect(result.event).toBe('message.text');
            expect(result.action).toBe('ai_response_sent');
            expect(result.status).toBe('processed');
            expect(result.data.extracted.text).toBe('Hello');
            expect(result.data.aiResponse).toBe('Hi! How can I help you today?');
        });

        it('should reject empty text without calling AI service', async () => {
            const result = await textHandler(makeTextEvent(''), 'message.text');

            expect(generateAIResponse).not.toHaveBeenCalled();
            expect(sendMessage).not.toHaveBeenCalled();
            expect(result.handled).toBe(false);
            expect(result.status).toBe('rejected');
            expect(result.error.code).toBe('EMPTY_TEXT');
        });

        it('should handle AI service failures without throwing', async () => {
            generateAIResponse.mockRejectedValue(new Error('AI unavailable'));

            const result = await textHandler(makeTextEvent('Hello'), 'message.text');

            expect(sendMessage).not.toHaveBeenCalled();
            expect(result.handled).toBe(false);
            expect(result.status).toBe('failed');
            expect(result.action).toBe('ai_response_failed');
            expect(result.error.code).toBe('AI_RESPONSE_FAILED');
        });
    });
});
