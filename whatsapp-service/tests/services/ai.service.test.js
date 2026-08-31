const {
    AIServiceError,
    generateAIResponse,
    getConversationUrl,
} = require('../../src/modules/whatsapp/application/services/ai.service');

describe('AI service client', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
        delete process.env.AI_SERVICE_URL;
        delete process.env.AI_SERVICE_TIMEOUT_MS;
    });

    afterEach(() => {
        delete global.fetch;
    });

    it('should build the configured conversation URL', () => {
        process.env.AI_SERVICE_URL = 'http://localhost:8000/';
        expect(getConversationUrl()).toBe('http://localhost:8000/api/v1/conversation');
    });

    it('should send message and return AI response text', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ response: 'Hello from AI' }),
        });

        const result = await generateAIResponse('Hello');

        expect(result).toBe('Hello from AI');
        expect(global.fetch).toHaveBeenCalledWith(
            'http://localhost:8000/api/v1/conversation',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Hello' }),
            })
        );
    });

    it('should reject empty messages before calling fetch', async () => {
        await expect(generateAIResponse('   ')).rejects.toBeInstanceOf(AIServiceError);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle non-2xx AI responses', async () => {
        global.fetch.mockResolvedValue({ ok: false, status: 503 });

        await expect(generateAIResponse('Hello')).rejects.toMatchObject({
            name: 'AIServiceError',
            statusCode: 503,
        });
    });

    it('should handle empty AI responses', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ response: '   ' }),
        });

        await expect(generateAIResponse('Hello')).rejects.toMatchObject({
            name: 'AIServiceError',
        });
    });
});
