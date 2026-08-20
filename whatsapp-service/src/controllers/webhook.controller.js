const whatsappService = require("../services/whatsapp.service");

// GET /webhook — Meta verification
const verifyWebhook = async (req, res) => {
    try {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        if (mode !== "subscribe") {
            return res.sendStatus(403);
        }

        if (token !== process.env.WHATSAPP_VERIFY_TOKEN) {
            return res.sendStatus(403);
        }

        return res.status(200).send(challenge);

    } catch (error) {
        console.error("Webhook verification error:", error);
        return res.sendStatus(500);
    }
};

// POST /webhook — Handle incoming WhatsApp webhook
const receiveWebhook = async (req, res) => {
    try {
        const message = whatsappService.parseIncomingMessage(req.body);

        console.log("========== WHATSAPP MESSAGE ==========");
        console.log("From:", message.from || req.body.From);
        console.log("To:", message.to || req.body.To);
        console.log("Body:", message.body || req.body.Body);
        console.log("MessageSid:", message.messageSid || req.body.MessageSid);
        if (message.profileName) console.log("ProfileName:", message.profileName);
        console.log("======================================");

        const twiml = whatsappService.createReply("Got your message! 🚀");

        return res.type("text/xml").status(200).send(twiml);

    } catch (error) {
        console.error("WhatsApp webhook error:", error);
        return res.sendStatus(500);
    }
};

// POST /send — Send outgoing WhatsApp message
const sendMessage = async (req, res) => {
    try {
        const { to, message, body, contentSid, contentVariables } = req.body;
        const messageText = message || body;

        if (!to) {
            return res.status(400).json({
                success: false,
                error: "Missing required field: 'to' (e.g. whatsapp:+919876543210)",
            });
        }

        if (!messageText && !contentSid) {
            return res.status(400).json({
                success: false,
                error: "Missing required field: 'message' or 'contentSid'",
            });
        }

        console.log(`\n[${new Date().toISOString()}] ========== OUTGOING WHATSAPP MESSAGE ==========`);
        console.log(`  To:      ${to}`);
        if (messageText) console.log(`  Message: ${messageText}`);
        if (contentSid) console.log(`  ContentSid: ${contentSid}`);

        const result = await whatsappService.sendMessage(to, messageText, {
            contentSid,
            contentVariables,
        });

        console.log(`  SID:     ${result.sid}`);
        console.log(`  Status:  ${result.status}`);
        console.log(`================================================\n`);

        return res.status(200).json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error("WhatsApp send error:", error);

        const statusCode = error.status || 500;

        return res.status(statusCode).json({
            success: false,
            error: error.message || "Failed to send message",
            code: error.code,
        });
    }
};

module.exports = {
    verifyWebhook,
    receiveWebhook,
    sendMessage,
};
