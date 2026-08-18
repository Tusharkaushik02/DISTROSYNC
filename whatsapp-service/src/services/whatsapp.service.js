const twilioProvider = require("./providers/twilio.provider");

// Currently using Twilio for development.
// Swap to metaProvider when switching to Meta Cloud API for production.
const provider = twilioProvider;

/**
 * Send a WhatsApp message through the active provider.
 *
 * @param {string} to - Recipient (e.g. "whatsapp:+919876543210")
 * @param {string} body - Message text
 * @returns {Promise<object>} Provider response
 */
const sendMessage = async (to, body, options = {}) => {
    return provider.sendMessage(to, body, options);
};

/**
 * Parse an incoming webhook payload into standardized fields.
 *
 * @param {object} reqBody - req.body from Express
 * @returns {object} Standardized message object
 */
const parseIncomingMessage = (reqBody) => {
    return provider.parseIncomingMessage(reqBody);
};

/**
 * Create a provider-appropriate reply response.
 *
 * @param {string} text - Reply text
 * @returns {string} Formatted response (TwiML for Twilio, JSON for Meta)
 */
const createReply = (text) => {
    return provider.createTwimlResponse(text);
};

module.exports = {
    sendMessage,
    parseIncomingMessage,
    createReply,
};
