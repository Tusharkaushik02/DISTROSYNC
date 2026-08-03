const crypto = require("crypto");

/**
 * Generate a stable device fingerprint
 */
const getDeviceInfo = (req) => {

    const userAgent = req.get("user-agent") || "";
    const platform = req.get("sec-ch-ua-platform") || "";
    const browser = req.get("sec-ch-ua") || "";
    const language = req.get("accept-language") || "";

    const fingerprint = `${userAgent}|${platform}|${browser}|${language}`;

    const deviceId = crypto
        .createHash("sha256")
        .update(fingerprint)
        .digest("hex");

    return {
        deviceId,
        ip: req.ip,
        userAgent,
        platform,
        browser
    };
};

module.exports = {
    getDeviceInfo
};