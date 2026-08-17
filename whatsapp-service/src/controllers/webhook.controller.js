// GET  /webhook  → verification

const verifyWebhook = async (req, res) => {
    try {

        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        // 1. Check if Meta is requesting webhook verification
        if (mode !== "subscribe") {
            return res.sendStatus(403);
        }

        // 2. Check verify token
        if (token !== process.env.WHATSAPP_VERIFY_TOKEN) {
            return res.sendStatus(403);
        }

        // 3. Verification successful
        return res.status(200).send(challenge);

    } catch (error) {

        console.error("Webhook verification error:", error);

        return res.sendStatus(500);
    }
};


// POST /webhook  → actual events

const receiveWebhook = async (req, res) => {
    try {

        console.log("========== WHATSAPP WEBHOOK ==========");

        console.log(
            JSON.stringify(req.body, null, 2)
        );

        console.log("======================================");

        // Acknowledge Meta
        return res.sendStatus(200);

    } catch (error) {

        console.error(
            "WhatsApp webhook error:",
            error
        );

        return res.sendStatus(500);
    }
};

module.exports = {
    verifyWebhook,
    receiveWebhook
};


