const createMock = jest.fn();
const twilioFactory = jest.fn(() => ({
    messages: {
        create: createMock,
    },
}));

twilioFactory.twiml = {
    MessagingResponse: class {
        message() {}
        toString() {
            return '<Response></Response>';
        }
    },
};

jest.mock('twilio', () => twilioFactory);

describe('Twilio provider sendMessage', () => {
    let sendMessage;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        process.env.TWILIO_ACCOUNT_SID = 'ACtest';
        process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
        process.env.TWILIO_WHATSAPP_NUMBER = 'whatsapp:+14155238886';
        ({ sendMessage } = require('../../src/modules/whatsapp/infrastructure/providers/twilio/twilio.provider'));
    });

    it('should send normal WhatsApp text with body and no content template fields', async () => {
        createMock.mockResolvedValue({
            sid: 'SMout123',
            to: 'whatsapp:+919876543210',
            from: 'whatsapp:+14155238886',
            body: 'Hello! How can I help you today?',
            status: 'queued',
            dateCreated: new Date('2026-01-01T00:00:00.000Z'),
        });

        await sendMessage('+919876543210', 'Hello! How can I help you today?');

        expect(createMock).toHaveBeenCalledWith({
            from: 'whatsapp:+14155238886',
            to: 'whatsapp:+919876543210',
            body: 'Hello! How can I help you today?',
        });
        expect(createMock.mock.calls[0][0]).not.toHaveProperty('contentSid');
        expect(createMock.mock.calls[0][0]).not.toHaveProperty('contentVariables');
    });

    it('should reject empty message body', async () => {
        await expect(sendMessage('+919876543210', '   ')).rejects.toThrow("Message 'body' is required");
        expect(createMock).not.toHaveBeenCalled();
    });
});
