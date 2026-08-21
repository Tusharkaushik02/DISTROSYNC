/**
 * Webhook controller — thin orchestrator for the inbound pipeline.
 *
 * Sequence: validate → normalize → classify (event + message) → dispatch
 *
 * Each step is a pure function call. The controller merely wires them together.
 */

const { validate } = require('../validation/webhook.validator');
const { normalize } = require('../adapters/twilio.adapter');
const { classifyEventType } = require('../classification/event.classifier');
const { classifyMessageType } = require('../classification/message.classifier');
const { dispatch } = require('../events/event.dispatcher');
const { ValidationError } = require('../errors/webhook.errors');

/**
 * POST handler — processes an incoming Twilio WhatsApp webhook.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
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

        // ── Stage 2: Normalization ────────────────────────────────────
        const canonicalEvent = normalize(validationResult.data);

        // ── Stage 3: Event Classification ─────────────────────────────
        canonicalEvent.eventType = classifyEventType(canonicalEvent);

        // ── Stage 4: Message Classification ───────────────────────────
        canonicalEvent.messageType = classifyMessageType(canonicalEvent);

        // ── Stage 5: Dispatch ─────────────────────────────────────────
        const result = dispatch(canonicalEvent);

        // Log the identified event
        console.log(`[Webhook] ${result.event} from ${canonicalEvent.sender.phone || 'unknown'}`);

        // Return the dispatch result
        // Twilio expects 200 to acknowledge receipt
        return res.status(200).json({
            success: true,
            ...result,
        });

    } catch (error) {
        next(error);
    }
}

module.exports = {
    handleWebhook,
};
