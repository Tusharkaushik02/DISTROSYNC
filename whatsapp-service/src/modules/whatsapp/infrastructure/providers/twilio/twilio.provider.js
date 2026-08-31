const twilio = require("twilio");
const { MessagingResponse } = require("twilio").twiml;

let client = null;

// Initialize Twilio client singleton
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

// Get or initialize Twilio client
const getClient = () => {
    if (!client) {
        initClient();
    }
    return client;
};

// Send WhatsApp text message via Twilio
const sendMessage = async (to, body) => {
    if (!to) {
        throw new Error("Recipient 'to' is required");
    }

    const text = typeof body === 'string' ? body.trim() : '';

    if (!text) {
        throw new Error("Message 'body' is required");
    }

    // Format phone number with whatsapp: prefix
    const formatNumber = (num) => {
        let clean = num.replace(/^whatsapp:/i, '').trim();
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
            body: text,
        };
        console.log(payload)
        const message = await twilioClient.messages.create(payload);
        console.log(message)
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

// Parse incoming Twilio webhook payload
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

// Generate TwiML XML response string
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
