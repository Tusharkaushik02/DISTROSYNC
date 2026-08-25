const { AppError } = require('../errors/app.error');

/**
 * Centralized Error Handling Middleware
 * Ensures clean, controlled error payloads and never leaks internal exceptions or traces.
 */
function errorHandler(err, req, res, next) {
    // 1. Handled AppError
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.toJSON()
        });
    }

    // 2. Zod Validation Error
    if (err.name === 'ZodError' || (err.issues && Array.isArray(err.issues))) {
        const issues = err.issues || [];
        const details = issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message
        }));

        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request payload',
                details
            }
        });
    }

    // 3. Multer / File Upload Errors
    if (err.name === 'MulterError') {
        let code = 'FILE_UPLOAD_ERROR';
        let message = err.message;
        let statusCode = 400;

        if (err.code === 'LIMIT_FILE_SIZE') {
            code = 'FILE_TOO_LARGE';
            message = 'File size exceeds the allowed limit';
        }

        return res.status(statusCode).json({
            success: false,
            error: {
                code,
                message
            }
        });
    }

    // 4. JSON parse error
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_JSON',
                message: 'Malformed JSON in request body'
            }
        });
    }

    // 5. Unhandled / Internal Errors (Log internally, mask from client)
    console.error('[ERP ErrorHandler] Unhandled exception:', {
        message: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });

    return res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An internal server error occurred'
        }
    });
}

module.exports = {
    errorHandler
};
