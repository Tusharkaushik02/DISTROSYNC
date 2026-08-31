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

// Format a WhatsApp address without exposing message content or credentials.
const formatWhatsAppAddress = (value, fieldName) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${fieldName} is required`);
    }

    let clean = value.replace(/^whatsapp:/i, '').trim();
    clean = clean.replace(/[\s\(\)\-]/g, '');

    if (!clean.startsWith('+')) {
        clean = `+${clean}`;
    }

    return `whatsapp:${clean}`;
};

// Build the standard text-message payload used by the conversational reply path.
// Content API fields intentionally do not belong in this payload.
const buildTextMessagePayload = (to, body) => {
    if (!to) {
        throw new Error("Recipient 'to' is required");
    }

    const text = typeof body === 'string' ? body.trim() : '';

    if (!text) {
        throw new Error("Message 'body' is required");
    }

    return {
        from: formatWhatsAppAddress(
            process.env.TWILIO_WHATSAPP_NUMBER,
            'TWILIO_WHATSAPP_NUMBER'
        ),
        to: formatWhatsAppAddress(to, "Recipient 'to'"),
        body: text,
    };
};

// Send a normal WhatsApp text message via Twilio.
const sendMessage = async (to, body) => {
    const payload = buildTextMessagePayload(to, body);

    try {
        const twilioClient = getClient();

        console.log('[WhatsApp] Sending AI response');
        console.log(`[WhatsApp] from: ${payload.from}`);
        console.log(`[WhatsApp] to: ${payload.to}`);
        console.log(`[WhatsApp] bodyLength: ${payload.body.length}`);

        const message = await twilioClient.messages.create(payload);
        console.log(`[Twilio] Message sent: ${message.sid}`);

        return {
            sid: message.sid,
            to: message.to,
            from: message.from,
            body: message.body,
            status: message.status,
            dateCreated: message.dateCreated,
        };
    } catch (error) {
        const code = error && error.code ? error.code : 'UNKNOWN';
        const message = error && error.message
            ? error.message
            : 'Twilio message send failed';

        console.error(`[Twilio] Send failed — Code: ${code}, Message: ${message}`);

        const providerError = new Error(message);
        Object.assign(providerError, {
            provider: "twilio",
            code,
            status: error && error.status,
            moreInfo: error && error.moreInfo,
        });

        throw providerError;
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
    buildTextMessagePayload,
    sendMessage,
    parseIncomingMessage,
    createTwimlResponse,
};
