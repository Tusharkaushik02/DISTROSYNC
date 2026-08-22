/**
 * Tests for the Twilio signature validation middleware.
 */

const { twilioSignatureMiddleware, buildWebhookUrl } = require('../../src/modules/whatsapp/presentation/middleware/twilioSignature.middleware');
const { AuthenticationError } = require('../../src/modules/whatsapp/domain/errors/webhook.errors');

// Mock twilio module
jest.mock('twilio', () => {
    const mock = {
        validateRequest: jest.fn(),
    };
    return mock;
});

const twilio = require('twilio');

describe('Twilio Signature Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            headers: {},
            body: { MessageSid: 'SM123', Body: 'Hello' },
            protocol: 'https',
            originalUrl: '/api/v2/whatsapp/webhook',
            get: jest.fn((header) => {
                if (header === 'host') return 'example.com';
                return null;
            }),
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();

        // Reset env
        delete process.env.TWILIO_WEBHOOK_URL;
        process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';

        // Reset mock
        twilio.validateRequest.mockReset();
    });

    afterEach(() => {
        delete process.env.TWILIO_AUTH_TOKEN;
        delete process.env.TWILIO_WEBHOOK_URL;
    });

    describe('Missing signature', () => {
        it('should call next with AuthenticationError (401) when signature header is missing', () => {
            twilioSignatureMiddleware(req, res, next);

            expect(next).toHaveBeenCalledTimes(1);
            const err = next.mock.calls[0][0];
            expect(err).toBeInstanceOf(AuthenticationError);
            expect(err.statusCode).toBe(401);
        });
    });

    describe('Invalid signature', () => {
        it('should call next with AuthenticationError (403) when signature is invalid', () => {
            req.headers['x-twilio-signature'] = 'invalid_signature';
            twilio.validateRequest.mockReturnValue(false);

            twilioSignatureMiddleware(req, res, next);

            expect(twilio.validateRequest).toHaveBeenCalledWith(
                'test_auth_token',
                'invalid_signature',
                'https://example.com/api/v2/whatsapp/webhook',
                req.body
            );
            expect(next).toHaveBeenCalledTimes(1);
            const err = next.mock.calls[0][0];
            expect(err).toBeInstanceOf(AuthenticationError);
            expect(err.statusCode).toBe(403);
        });
    });

    describe('Valid signature', () => {
        it('should call next() without error when signature is valid', () => {
            req.headers['x-twilio-signature'] = 'valid_signature';
            twilio.validateRequest.mockReturnValue(true);

            twilioSignatureMiddleware(req, res, next);

            expect(next).toHaveBeenCalledWith();
        });
    });

    describe('URL construction', () => {
        it('should use TWILIO_WEBHOOK_URL env var when set', () => {
            process.env.TWILIO_WEBHOOK_URL = 'https://prod.example.com/webhook';
            req.headers['x-twilio-signature'] = 'sig';
            twilio.validateRequest.mockReturnValue(true);

            twilioSignatureMiddleware(req, res, next);

            expect(twilio.validateRequest).toHaveBeenCalledWith(
                'test_auth_token',
                'sig',
                'https://prod.example.com/webhook',
                req.body
            );
        });

        it('should use X-Forwarded-Proto behind proxy', () => {
            req.headers['x-twilio-signature'] = 'sig';
            req.headers['x-forwarded-proto'] = 'https';
            req.protocol = 'http'; // TLS terminated upstream
            twilio.validateRequest.mockReturnValue(true);

            twilioSignatureMiddleware(req, res, next);

            expect(twilio.validateRequest).toHaveBeenCalledWith(
                'test_auth_token',
                'sig',
                'https://example.com/api/v2/whatsapp/webhook',
                req.body
            );
        });

        it('should fall back to req.protocol for direct connections', () => {
            req.headers['x-twilio-signature'] = 'sig';
            req.protocol = 'http';
            twilio.validateRequest.mockReturnValue(true);

            twilioSignatureMiddleware(req, res, next);

            expect(twilio.validateRequest).toHaveBeenCalledWith(
                'test_auth_token',
                'sig',
                'http://example.com/api/v2/whatsapp/webhook',
                req.body
            );
        });
    });

    describe('buildWebhookUrl', () => {
        it('should prefer TWILIO_WEBHOOK_URL', () => {
            process.env.TWILIO_WEBHOOK_URL = 'https://override.com/hook';
            expect(buildWebhookUrl(req)).toBe('https://override.com/hook');
        });

        it('should construct URL from request when no env override', () => {
            req.protocol = 'https';
            expect(buildWebhookUrl(req)).toBe('https://example.com/api/v2/whatsapp/webhook');
        });
    });
});
