jest.mock('twilio', () => {
    const mockCreate = jest.fn();
    class MockMessagingResponse {
        constructor() {
            this.messages = [];
        }

        message(text) {
            this.messages.push(text);
        }

        toString() {
            return '<Response>' + this.messages.map((text) => `<Message>${text}</Message>`).join('') + '</Response>';
        }
    }

    const mockTwilio = jest.fn(() => ({
        messages: { create: mockCreate },
    }));

    mockTwilio.twiml = {
        MessagingResponse: MockMessagingResponse,
    };
    mockTwilio.__mockCreate = mockCreate;

    return mockTwilio;
});

const twilio = require('twilio');
const { sendMessage } = require('../../src/modules/whatsapp/infrastructure/providers/twilio/twilio.provider');

describe('Twilio provider sendMessage', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env.TWILIO_ACCOUNT_SID = 'AC123';
        process.env.TWILIO_AUTH_TOKEN = 'token';
        process.env.TWILIO_WHATSAPP_NUMBER = '+14155238886';
        twilio.__mockCreate.mockReset();
        twilio.__mockCreate.mockResolvedValue({
            sid: 'SM123',
            to: 'whatsapp:+15551234567',
            from: 'whatsapp:+14155238886',
            body: 'hello',
            status: 'queued',
        });
    });

    afterAll(() => {
        process.env = { ...originalEnv };
    });

    it('allows sending a normal text message without a contentSid', async () => {
        await sendMessage('+15551234567', 'hello');

        expect(twilio.__mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'whatsapp:+14155238886',
                to: 'whatsapp:+15551234567',
                body: 'hello',
            })
        );
    });

    it('allows sending a template message when contentSid is supplied without a body', async () => {
        await sendMessage('+15551234567', undefined, {
            contentSid: 'HX123',
            contentVariables: { first: 'Jane' },
        });

        expect(twilio.__mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'whatsapp:+14155238886',
                to: 'whatsapp:+15551234567',
                contentSid: 'HX123',
                contentVariables: { first: 'Jane' },
            })
        );
    });
});
