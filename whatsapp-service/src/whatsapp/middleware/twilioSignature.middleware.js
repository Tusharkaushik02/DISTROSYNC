/**
 * Twilio signature validation middleware.
 *
 * Authenticates that the incoming request genuinely originated from Twilio
 * using HMAC-SHA1 verification of the X-Twilio-Signature header.
 *
 * URL construction handles reverse proxy scenarios:
 *   1. TWILIO_WEBHOOK_URL env var override (recommended for production)
 *   2. X-Forwarded-Proto header (behind proxy/LB)
 *   3. req.protocol fallback (direct connection)
 */

const twilio = require('twilio');
const { AuthenticationError } = require('../errors/webhook.errors');

/**
 * Build the full URL that Twilio used when computing its HMAC signature.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function buildWebhookUrl(req) {
    // Preferred: explicit env var avoids all proxy ambiguity
    if (process.env.TWILIO_WEBHOOK_URL) {
        return process.env.TWILIO_WEBHOOK_URL;
    }

    // Behind reverse proxy: trust X-Forwarded-Proto
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host');
    const path = req.originalUrl;

    return `${protocol}://${host}${path}`;
}

/**
 * Express middleware — validates Twilio signature.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function twilioSignatureMiddleware(req, res, next) {
    const signature = req.headers['x-twilio-signature'];

    if (!signature) {
        return next(new AuthenticationError('Missing X-Twilio-Signature header', 401));
    }

    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
        console.error('[TwilioSignature] TWILIO_AUTH_TOKEN is not set');
        return next(new AuthenticationError('Server configuration error', 500));
    }

    const url = buildWebhookUrl(req);

    const isValid = twilio.validateRequest(
        authToken,
        signature,
        url,
        req.body || {}
    );

    if (!isValid) {
        return next(new AuthenticationError('Invalid Twilio signature', 403));
    }

    next();
}

module.exports = {
    twilioSignatureMiddleware,
    buildWebhookUrl,
};
