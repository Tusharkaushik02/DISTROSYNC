// Centralized webhook error handling middleware
const { WebhookError } = require('../errors/webhook.errors');

function webhookErrorHandler(err, req, res, next) {
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
