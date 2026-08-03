const otpGenerator = require("otp-generator");
const crypto = require("crypto");
const { redis } = require("../config/redis");

const OTP_TTL = parseInt(process.env.OTP_TTL) || 300;
const OTP_RATE_LIMIT = parseInt(process.env.OTP_RATE_LIMIT) || 5;
const ATTEMPT_MAX = parseInt(process.env.ATTEMPT_MAX) || 5;
const OTP_RATE_WINDOW = 3600;

/**
 * Hash OTP using HMAC SHA256
 */
function hashOtp(otp, email) {
    return crypto
        .createHmac("sha256", process.env.HMAC_SECRET)
        .update(`${email}:${otp}`)
        .digest("hex");
}

/**
 * Generate OTP and Store Session
 */
const generateAndStoreOtp = async (email, meta) => {

    // 1. Rate Limit Key
    const rateKey = `otp:rate:${email}`;

    // 2. Check Rate Limit
    const sentCount = parseInt(await redis.get(rateKey)) || 0;

    if (sentCount >= OTP_RATE_LIMIT) {
        throw new Error("OTP rate limit exceeded. Please try again later.");
    }

    // 3. Generate OTP
    const otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
        digits: true
    });

    // 4. Generate OTP Session ID
    const otpSessionId = crypto.randomUUID();

    // 5. Hash OTP
    const hashedOtp = hashOtp(otp, email);

    // 6. Store Session
    const sessionKey = `otp:session:${otpSessionId}`;

    await redis.set(
        sessionKey,
        JSON.stringify({
            email,
            hashedOtp,
            meta
        }),
        "EX",
        OTP_TTL
    );

    // 7. Increment Rate Limit
    await redis
        .multi()
        .incr(rateKey)
        .expire(rateKey, OTP_RATE_WINDOW)
        .exec();



    // 9. Return Session ID
    return {
        otp,
        otpSessionId
    };
};

/**
 * Verify OTP
 */
const verifyOtp = async ({ otp, otpSessionId }) => {

    // 1. Session Key
    const sessionKey = `otp:session:${otpSessionId}`;

    // 2. Check Session Exists
    const rawSession = await redis.get(sessionKey);

    if (!rawSession) {
        throw new Error("OTP session expired.");
    }

    // 3. Parse Session
    const { email, hashedOtp, meta } = JSON.parse(rawSession);

    // 4. Attempts Key
    const attemptsKey = `otp:attempt:${otpSessionId}`;

    // 5. Check Attempts
    const attempts = parseInt(await redis.get(attemptsKey)) || 0;

    if (attempts >= ATTEMPT_MAX) {
        await redis.del(sessionKey);
        throw new Error("Maximum OTP attempts exceeded.");
    }

    // 6. Hash Incoming OTP
    const currentOtpHash = hashOtp(otp, email);

    // 7. Compare Securely
    const currentBuffer = Buffer.from(currentOtpHash, "hex");
    const storedBuffer = Buffer.from(hashedOtp, "hex");

    const isMatch =
        currentBuffer.length === storedBuffer.length &&
        crypto.timingSafeEqual(currentBuffer, storedBuffer);

    // 8. Wrong OTP
    if (!isMatch) {

        await redis
            .multi()
            .incr(attemptsKey)
            .expire(attemptsKey, OTP_TTL)
            .exec();

        throw new Error("Invalid OTP.");
    }

    // 9. Cleanup
    await redis.del(
        sessionKey,
        attemptsKey,
        `otp:rate:${email}`
    );

    // 10. Return Registration Data
    return {
        email,
        meta
    };
};

module.exports = {
    generateAndStoreOtp,
    verifyOtp
};