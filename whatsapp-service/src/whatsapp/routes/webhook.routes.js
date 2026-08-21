/**
 * Webhook routes for the v2 inbound pipeline.
 *
 * Middleware chain: urlencoded parsing → Twilio signature → controller → error handler
 *
 * Mounted at /api/v2/whatsapp/webhook from app.js
 */

const express = require('express');
const { twilioSignatureMiddleware } = require('../middleware/twilioSignature.middleware');
const { webhookErrorHandler } = require('../middleware/errorHandler.middleware');
const { handleWebhook } = require('../controllers/webhook.controller');

const router = express.Router();

// POST /  (mounted at /api/v2/whatsapp/webhook)
// The urlencoded parser is applied at the route level to match Twilio's content-type
router.post(
    '/',
    express.urlencoded({ extended: false }),
    twilioSignatureMiddleware,
    handleWebhook
);

// Attach the error handler as the last middleware on this router
router.use(webhookErrorHandler);

module.exports = router;
