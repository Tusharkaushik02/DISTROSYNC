// Custom webhook error classes
class WebhookError extends Error {
    constructor(message, statusCode, code, details = null) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }

    // Safe JSON serialization
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

// Authentication error (401/403)
class AuthenticationError extends WebhookError {
    constructor(message = 'Authentication failed', statusCode = 403) {
        super(message, statusCode, 'AUTHENTICATION_ERROR');
    }
}

// Schema validation error (400)
class ValidationError extends WebhookError {
    constructor(message = 'Validation failed', fieldErrors = []) {
        super(message, 400, 'VALIDATION_ERROR', fieldErrors);
    }
}

// Normalization error (500)
class NormalizationError extends WebhookError {
    constructor(message = 'Normalization failed', details = null) {
        super(message, 500, 'NORMALIZATION_ERROR', details);
    }
}

// Classification error (500)
class ClassificationError extends WebhookError {
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
