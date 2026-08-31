// Webhook route with Twilio signature authentication and error handling
const express = require('express');
const { twilioSignatureMiddleware } = require('../middleware/twilioSignature.middleware');
const { webhookErrorHandler } = require('../middleware/errorHandler.middleware');
const { handleWebhook } = require('../controllers/webhook.controller');

const router = express.Router();

// POST webhook endpoint
router.post(
    '/',
    express.urlencoded({ extended: false }),
    twilioSignatureMiddleware,
    handleWebhook
);

// Centralized error handler
router.use(webhookErrorHandler);

module.exports = router;
