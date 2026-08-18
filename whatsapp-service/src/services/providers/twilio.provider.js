const twilio = require("twilio");
const { MessagingResponse } = require("twilio").twiml;

let client = null;

/**
 * Initialize the Twilio client.
 * Validates required env vars and creates the client singleton.
 */
const initClient = () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        throw new Error(
            "Missing Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env"
        );
    }

    if (!process.env.TWILIO_WHATSAPP_NUMBER) {
        throw new Error(
            "Missing TWILIO_WHATSAPP_NUMBER. Set it in .env (e.g. whatsapp:+14155238886)"
        );
    }

    client = twilio(accountSid, authToken);

    console.log("[Twilio] Client initialized successfully");

    return client;
};

/**
 * Get the Twilio client, initializing if needed.
 */
const getClient = () => {
    if (!client) {
        initClient();
    }
    return client;
};

/**
 * Send a WhatsApp text message via Twilio.
 *
 * @param {string} to - Recipient in Twilio format, e.g. "whatsapp:+919876543210"
 * @param {string} body - Message text
 * @returns {Promise<object>} Twilio message response
 */
const sendMessage = async (to, body, options = {}) => {
    if (!to) {
        throw new Error("Recipient 'to' is required");
    }

    if (!body && !options.contentSid) {
        throw new Error("Either message 'body' or 'contentSid' is required");
    }

    // Helper to sanitize phone number into E.164 with whatsapp: prefix
    const formatNumber = (num) => {
        let clean = num.replace(/^whatsapp:/i, '').trim();
        // Remove parentheses, spaces, dashes
        clean = clean.replace(/[\s\(\)\-]/g, '');
        if (!clean.startsWith('+')) {
            clean = `+${clean}`;
        }
        return `whatsapp:${clean}`;
    };

    const formattedTo = formatNumber(to);
    const formattedFrom = formatNumber(process.env.TWILIO_WHATSAPP_NUMBER);

    const twilioClient = getClient();

    try {
        const payload = {
            from: formattedFrom,
            to: formattedTo,
        };

        if (options.contentSid) {
            payload.contentSid = options.contentSid;
            if (options.contentVariables) {
                payload.contentVariables = typeof options.contentVariables === 'string'
                    ? options.contentVariables
                    : JSON.stringify(options.contentVariables);
            }
        } else {
            payload.body = body;
        }

        const message = await twilioClient.messages.create(payload);

        console.log(`[Twilio] Message sent — SID: ${message.sid}, To: ${formattedTo}`);

        return {
            sid: message.sid,
            to: message.to,
            from: message.from,
            body: message.body,
            status: message.status,
            dateCreated: message.dateCreated,
        };
    } catch (error) {
        console.error(`[Twilio] Send failed — Code: ${error.code}, Message: ${error.message}`);

        throw {
            provider: "twilio",
            code: error.code,
            message: error.message,
            status: error.status,
            moreInfo: error.moreInfo,
        };
    }
};

/**
 * Parse an incoming Twilio webhook payload into a standardized message object.
 *
 * Twilio sends form-encoded (application/x-www-form-urlencoded) POST data.
 * Express must have express.urlencoded({ extended: false }) middleware active.
 *
 * @param {object} body - req.body from the Express request
 * @returns {object} Standardized message fields
 */
const parseIncomingMessage = (body) => {
    const payload = body || {};

    return {
        from: payload.From || null,
        to: payload.To || null,
        body: payload.Body || "",
        messageSid: payload.MessageSid || null,
        profileName: payload.ProfileName || null,
        accountSid: payload.AccountSid || null,
        numMedia: parseInt(payload.NumMedia, 10) || 0,
        numSegments: parseInt(payload.NumSegments, 10) || 0,
        waId: payload.WaId || null,
        smsStatus: payload.SmsStatus || null,
        apiVersion: payload.ApiVersion || null,
    };
};

/**
 * Create a TwiML MessagingResponse XML string.
 *
 * @param {string} text - Reply message text
 * @returns {string} TwiML XML string
 */
const createTwimlResponse = (text) => {
    const twiml = new MessagingResponse();

    twiml.message(text);

    return twiml.toString();
};

module.exports = {
    initClient,
    getClient,
    sendMessage,
    parseIncomingMessage,
    createTwimlResponse,
};
