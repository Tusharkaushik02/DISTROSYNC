const twilioProvider = require("../../infrastructure/providers/twilio/twilio.provider");

// Active WhatsApp provider (Twilio)
const provider = twilioProvider;

// Send WhatsApp message via provider
const sendMessage = async (to, body) => {
    return provider.sendMessage(to, body);
};

// Parse incoming webhook payload
const parseIncomingMessage = (reqBody) => {
    return provider.parseIncomingMessage(reqBody);
};

// Create reply response
const createReply = (text) => {
    return provider.createTwimlResponse(text);
};

module.exports = {
    sendMessage,
    parseIncomingMessage,
    createReply,
};
