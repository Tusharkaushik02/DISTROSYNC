const twilio = require("twilio");

const authToken = process.env.TWILIO_AUTH_TOKEN;

function validateTwilioRequest(req, res, next) {
    const signature = req.headers["x-twilio-signature"];

    if (!signature) {
        return res.status(401).json({
            error: "Missing Twilio signature"
        });
    }

    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const isValid = twilio.validateRequest(
        authToken,
        signature,
        url,
        req.body
    );

    if (!isValid) {
        return res.status(403).json({
            error: "Invalid Twilio signature"
        });
    }

    next();
}

module.exports = validateTwilioRequest;