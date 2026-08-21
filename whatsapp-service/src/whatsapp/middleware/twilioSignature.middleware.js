// Twilio HMAC-SHA1 signature authentication middleware
const twilio = require('twilio');
const { AuthenticationError } = require('../errors/webhook.errors');

// Build the request URL used for signature verification
function buildWebhookUrl(req) {
    if (process.env.TWILIO_WEBHOOK_URL && !process.env.TWILIO_WEBHOOK_URL.includes('your-ngrok-url')) {
        return process.env.TWILIO_WEBHOOK_URL;
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const path = req.originalUrl;

    return `${protocol}://${host}${path}`;
}

// Validate Twilio signature from X-Twilio-Signature header
function twilioSignatureMiddleware(req, res, next) {
    const signature = req.headers['x-twilio-signature'];

    if (!signature) {
        return next(new AuthenticationError('Missing X-Twilio-Signature header', 401));
    }

    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken || authToken === 'your_twilio_auth_token') {
        console.error('[TwilioSignature] TWILIO_AUTH_TOKEN is not set or is still placeholder in .env');
        return next(new AuthenticationError('Server configuration error: TWILIO_AUTH_TOKEN missing in .env', 500));
    }

    const url = buildWebhookUrl(req);

    const isValid = twilio.validateRequest(
        authToken,
        signature,
        url,
        req.body || {}
    );

    if (!isValid) {
        console.warn(`[TwilioSignature] Validation failed (403 Forbidden)!`);
        console.warn(`  Evaluated URL: ${url}`);
        console.warn(`  Received Signature: ${signature}`);
        console.warn(`  TWILIO_AUTH_TOKEN length: ${authToken ? authToken.length : 0}`);
        return next(new AuthenticationError('Invalid Twilio signature', 403));
    }

    next();
}

module.exports = {
    twilioSignatureMiddleware,
    buildWebhookUrl,
};
