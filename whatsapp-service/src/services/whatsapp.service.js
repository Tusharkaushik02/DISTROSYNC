const twilioProvider = require("./providers/twilio.provider");

// Active WhatsApp provider (Twilio)
const provider = twilioProvider;

// Send WhatsApp message via provider
const sendMessage = async (to, body, options = {}) => {
    return provider.sendMessage(to, body, options);
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
