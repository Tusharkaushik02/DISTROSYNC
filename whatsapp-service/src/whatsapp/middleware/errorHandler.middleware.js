/**
 * Centralized error-handling middleware for the webhook pipeline.
 *
 * Catches all WebhookError subtypes and returns safe, structured JSON
 * without exposing stack traces or internal implementation details.
 */

const { WebhookError } = require('../errors/webhook.errors');

/**
 * Express error-handling middleware (4-argument signature).
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function webhookErrorHandler(err, req, res, next) {
    // Known webhook errors — safe to expose
    if (err instanceof WebhookError) {
        return res.status(err.statusCode).json(err.toJSON());
    }

    // Unknown errors — log internally, return generic message
    console.error('[WebhookErrorHandler] Unexpected error:', err);

    return res.status(500).json({
        error: true,
        type: 'InternalError',
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
    });
}

module.exports = {
    webhookErrorHandler,
};
