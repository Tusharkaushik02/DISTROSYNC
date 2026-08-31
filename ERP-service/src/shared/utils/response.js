/**
 * Standard API Response utilities for ERP Service.
 * Formats success and error responses consistently across all modules.
 */

const successResponse = (res, data = null, message = null, statusCode = 200) => {
    const payload = {
        success: true
    };

    if (message) {
        payload.message = message;
    }

    if (data !== null) {
        payload.data = data;
    }

    return res.status(statusCode).json(payload);
};

const errorResponse = (res, error, statusCode = 500) => {
    let responsePayload = {
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred'
        }
    };

    if (typeof error === 'string') {
        responsePayload.error.message = error;
    } else if (error && typeof error === 'object') {
        responsePayload.error = {
            code: error.code || 'INTERNAL_SERVER_ERROR',
            message: error.message || 'An unexpected error occurred',
            ...(error.details ? { details: error.details } : {})
        };
    }

    return res.status(statusCode).json(responsePayload);
};

module.exports = {
    successResponse,
    errorResponse
};
