// Webhook controller — orchestrates validate, normalize, classify, dispatch, and handle
const { validate } = require('../../validation/webhook.validator');
const { normalize } = require('../../infrastructure/providers/twilio/twilio.adapter');
const { classifyEventType } = require('../../domain/classification/event.classifier');
const { classifyMessageType } = require('../../domain/classification/message.classifier');
const { dispatch, handle } = require('../../application/events/event.dispatcher');
const { ValidationError } = require('../../domain/errors/webhook.errors');

// Inbound webhook request handler
async function handleWebhook(req, res, next) {
    try {
        // ── Stage 1: Schema Validation ────────────────────────────────
        const validationResult = validate(req.body);

        if (!validationResult.valid) {
            throw new ValidationError(
                'Webhook payload validation failed',
                validationResult.errors
            );
        }
        console.log(`[Webhook] Received event: ${validationResult.data.event} from ${validationResult.data.sender.phone || 'unknown'}`);

        // ── Stage 2: Normalization ────────────────────────────────────
        const canonicalEvent = normalize(validationResult.data);

        // ── Stage 3: Event Classification ─────────────────────────────
        canonicalEvent.eventType = classifyEventType(canonicalEvent);

        // ── Stage 4: Message Classification ───────────────────────────
        canonicalEvent.messageType = classifyMessageType(canonicalEvent);

        // ── Stage 5: Dispatch ─────────────────────────────────────────
        const result = dispatch(canonicalEvent);

        // ── Stage 6: Handle ───────────────────────────────────────────
        const handlerResult = await handle(result);

        console.log(`[Webhook] ${result.event} → ${handlerResult.status} from ${canonicalEvent.sender.phone || 'unknown'}`);

        // Twilio expects 200 to acknowledge receipt
        return res.status(200).json({
            success: true,
            event: result.event,
            ...handlerResult,
        });

    } catch (error) {
        next(error);
    }
}

module.exports = {
    handleWebhook,
};
