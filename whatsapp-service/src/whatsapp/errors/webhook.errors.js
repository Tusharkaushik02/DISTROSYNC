/**
 * Custom error classes for the WhatsApp webhook inbound pipeline.
 *
 * Hierarchy:
 *   WebhookError (base)
 *   ├── AuthenticationError  (401/403)
 *   ├── ValidationError      (400)
 *   ├── NormalizationError   (500)
 *   └── ClassificationError  (500)
 */

class WebhookError extends Error {
    /**
     * @param {string} message  — Human-readable description
     * @param {number} statusCode — HTTP status to return
     * @param {string} code — Machine-readable error code (e.g. "AUTHENTICATION_ERROR")
     * @param {*} [details] — Optional structured details (field errors, raw data, etc.)
     */
    constructor(message, statusCode, code, details = null) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;

        // Capture stack trace but exclude constructor
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Safe JSON representation — never exposes stack traces.
     */
    toJSON() {
        return {
            error: true,
            type: this.name,
            code: this.code,
            message: this.message,
            ...(this.details ? { details: this.details } : {}),
        };
    }
}

class AuthenticationError extends WebhookError {
    /**
     * @param {string} message
     * @param {number} [statusCode=403] — 401 for missing, 403 for invalid
     */
    constructor(message = 'Authentication failed', statusCode = 403) {
        super(message, statusCode, 'AUTHENTICATION_ERROR');
    }
}

class ValidationError extends WebhookError {
    /**
     * @param {string} message
     * @param {Array<{field: string, code: string, message: string}>} [fieldErrors]
     */
    constructor(message = 'Validation failed', fieldErrors = []) {
        super(message, 400, 'VALIDATION_ERROR', fieldErrors);
    }
}

class NormalizationError extends WebhookError {
    /**
     * @param {string} message
     * @param {*} [details]
     */
    constructor(message = 'Normalization failed', details = null) {
        super(message, 500, 'NORMALIZATION_ERROR', details);
    }
}

class ClassificationError extends WebhookError {
    /**
     * @param {string} message
     * @param {*} [details]
     */
    constructor(message = 'Classification failed', details = null) {
        super(message, 500, 'CLASSIFICATION_ERROR', details);
    }
}

module.exports = {
    WebhookError,
    AuthenticationError,
    ValidationError,
    NormalizationError,
    ClassificationError,
};
