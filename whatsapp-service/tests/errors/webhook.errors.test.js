/**
 * Tests for the webhook error class hierarchy.
 */

const {
    WebhookError,
    AuthenticationError,
    ValidationError,
    NormalizationError,
    ClassificationError,
} = require('../../src/whatsapp/errors/webhook.errors');

describe('WebhookError hierarchy', () => {

    describe('WebhookError (base)', () => {
        it('should be an instance of Error', () => {
            const err = new WebhookError('test', 500, 'TEST_ERROR');
            expect(err).toBeInstanceOf(Error);
            expect(err).toBeInstanceOf(WebhookError);
        });

        it('should carry statusCode, code, and details', () => {
            const err = new WebhookError('oops', 418, 'TEAPOT', { extra: true });
            expect(err.message).toBe('oops');
            expect(err.statusCode).toBe(418);
            expect(err.code).toBe('TEAPOT');
            expect(err.details).toEqual({ extra: true });
        });

        it('should have a name matching the class', () => {
            const err = new WebhookError('test', 500, 'X');
            expect(err.name).toBe('WebhookError');
        });

        it('should serialize to safe JSON without stack traces', () => {
            const err = new WebhookError('test', 500, 'X', { a: 1 });
            const json = err.toJSON();
            expect(json).toEqual({
                error: true,
                type: 'WebhookError',
                code: 'X',
                message: 'test',
                details: { a: 1 },
            });
            expect(json.stack).toBeUndefined();
        });

        it('should omit details key when details is null', () => {
            const err = new WebhookError('test', 500, 'X');
            const json = err.toJSON();
            expect(json.details).toBeUndefined();
        });
    });

    describe('AuthenticationError', () => {
        it('should default to 403', () => {
            const err = new AuthenticationError();
            expect(err.statusCode).toBe(403);
            expect(err.code).toBe('AUTHENTICATION_ERROR');
        });

        it('should accept 401 for missing signature', () => {
            const err = new AuthenticationError('Missing signature', 401);
            expect(err.statusCode).toBe(401);
        });

        it('should extend WebhookError', () => {
            const err = new AuthenticationError();
            expect(err).toBeInstanceOf(WebhookError);
            expect(err.name).toBe('AuthenticationError');
        });
    });

    describe('ValidationError', () => {
        it('should be 400 with field errors', () => {
            const fieldErrors = [
                { field: 'From', code: 'MISSING_FIELD', message: 'Required' },
            ];
            const err = new ValidationError('Bad input', fieldErrors);
            expect(err.statusCode).toBe(400);
            expect(err.code).toBe('VALIDATION_ERROR');
            expect(err.details).toEqual(fieldErrors);
        });

        it('should default to empty field errors', () => {
            const err = new ValidationError();
            expect(err.details).toEqual([]);
        });
    });

    describe('NormalizationError', () => {
        it('should be 500', () => {
            const err = new NormalizationError('Transform failed');
            expect(err.statusCode).toBe(500);
            expect(err.code).toBe('NORMALIZATION_ERROR');
        });
    });

    describe('ClassificationError', () => {
        it('should be 500', () => {
            const err = new ClassificationError('Classify failed');
            expect(err.statusCode).toBe(500);
            expect(err.code).toBe('CLASSIFICATION_ERROR');
        });
    });

    describe('instanceof checks across hierarchy', () => {
        it('all subtypes should be instances of WebhookError and Error', () => {
            const errors = [
                new AuthenticationError(),
                new ValidationError(),
                new NormalizationError(),
                new ClassificationError(),
            ];

            errors.forEach((err) => {
                expect(err).toBeInstanceOf(WebhookError);
                expect(err).toBeInstanceOf(Error);
            });
        });

        it('subtypes should NOT be instances of each other', () => {
            const auth = new AuthenticationError();
            const validation = new ValidationError();

            expect(auth).not.toBeInstanceOf(ValidationError);
            expect(validation).not.toBeInstanceOf(AuthenticationError);
        });
    });
});
