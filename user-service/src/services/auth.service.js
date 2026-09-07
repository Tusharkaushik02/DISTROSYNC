const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");

const {
    generateAndStoreOtp,
    verifyOtp
} = require("../utils/otp");

const {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken
} = require("../utils/auth");

const { redis } = require("../config/redis");

// const notificationProducer = require("../kafka/producer/notification.producer");

const REFRESH_TOKEN_TTL =
    parseInt(process.env.REFRESH_TOKEN_TTL_SEC) || 604800;

const USER_CACHE_TTL = 3600;

/**
 * Remove sensitive fields before returning user
 */
const sanitizeUser = (user) => {

    if (!user) return null;

    const { passwordHash, ...safeUser } = user;

    return safeUser;
};

/**
 * Cache user
 */
const cacheUser = async (user) => {

    await redis.set(
        `auth:user:${user.id}`,
        JSON.stringify(user),
        "EX",
        USER_CACHE_TTL
    );

};

/**
 * Get cached user
 */
const getCachedUser = async (userId) => {

    const cached = await redis.get(
        `auth:user:${userId}`
    );

    if (!cached) {
        return null;
    }

    return JSON.parse(cached);

};

/**
 * Store Refresh Session
 */
const storeRefreshSession = async (
    userId,
    deviceId,
    jti
) => {

    await redis.set(
        `auth:refresh:${userId}:${deviceId}`,
        jti,
        "EX",
        REFRESH_TOKEN_TTL
    );

};

/**
 * Delete Refresh Session
 */
const deleteRefreshSession = async (
    userId,
    deviceId
) => {

    await redis.del(
        `auth:refresh:${userId}:${deviceId}`
    );

};

/**
 * Send OTP
 */
const sendOTP = async (userData) => {

    const { name, email, phone, password } = userData;

    // 1. Check User Exists
    const existingUser = await prisma.user.findUnique({
        where: {
            email
        }
    });

    if (existingUser) {
        throw new Error("User already exists.");
    }

    // 2. Hash Password
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Generate OTP
    const { otp, otpSessionId } = await generateAndStoreOtp(
        email,
        {
            name,
            phone,
            passwordHash
        }
    );

    // 4. Send Notification
    // await notificationProducer.sendOtpEmail(
    //     email,
    //     otp,
    //     Math.floor(process.env.OTP_TTL / 60)
    // );

    // Development Only
    if (process.env.NODE_ENV !== "production") {
        console.log(`OTP for ${email}: ${otp}`);
    }

    // 5. Return OTP Session
    return {
        otpSessionId
    };
};


/**
 * Verify OTP
 */
const verifyOTP = async ({ otp, otpSessionId }) => {

    // 1. Verify OTP
    const verification = await verifyOtp({
        otp,
        otpSessionId
    });

    if (!verification) {
        throw new Error("Invalid or expired OTP.");
    }

    const { email, meta } = verification;

    // 2. Check user again (Race Condition Protection)
    const existingUser = await prisma.user.findUnique({
        where: {
            email
        }
    });

    if (existingUser) {
        throw new Error("User already exists.");
    }

    // 3. Create User inside Transaction
    const user = await prisma.$transaction(async (tx) => {

        const newUser = await tx.user.create({
            data: {
                name: meta.name,
                email,
                phone: meta.phone,
                passwordHash: meta.passwordHash,
                emailVerified: true
            }
        });

        return newUser;
    });

    // 4. Remove Sensitive Data
    const safeUser = sanitizeUser(user);

    // 5. Cache User
    await cacheUser(safeUser);

    // 6. Return User
    return safeUser;
};


/**
 * Login
 */
const login = async ({ email, password, deviceId }) => {

    // 1. Find User
    const user = await prisma.user.findUnique({
        where: {
            email
        }
    });

    if (!user) {
        throw new Error("Invalid email or password.");
    }

    // 2. Check Account Status
    if (user.status !== "ACTIVE") {
        throw new Error("Your account is not active.");
    }

    // 3. Check Email Verification
    if (!user.emailVerified) {
        throw new Error("Please verify your email first.");
    }

    // 4. Verify Password
    const isPasswordValid = await bcrypt.compare(
        password,
        user.passwordHash
    );

    if (!isPasswordValid) {
        throw new Error("Invalid email or password.");
    }

    // 5. Generate Access Token
    const {
    token: accessToken,
    jti: accessJti
} = generateAccessToken(user.id);
// 6. Generate Refresh Token
const {
    token: refreshToken,
    jti: refreshJti
} = generateRefreshToken(user.id);

    // 7. Store Refresh Session
   await storeRefreshSession(
    user.id,
    deviceId,
    refreshJti
);

    // 8. Remove Sensitive Data
    const safeUser = sanitizeUser(user);

    // 9. Cache User
    await cacheUser(safeUser);

    // 10. Return Response
    return {
        accessToken,
        refreshToken,
        user: safeUser
    };

};

/**
 * Logout
 */
const logout = async ({ userId, deviceId }) => {

    // 1. Delete Refresh Session
    await deleteRefreshSession(
        userId,
        deviceId
    );

    // 2. Remove User Cache
    await redis.del(
        `auth:user:${userId}`
    );

    return {
        message: "Logout successful."
    };
};


/**
 * Refresh Token
 */
const refreshToken = async ({ refreshToken, deviceId }) => {

    // 1. Verify Refresh Token
    const payload = verifyRefreshToken(refreshToken);

    if (!payload) {
        throw new Error("Invalid refresh token.");
    }

    // 2. Check Refresh Session
    const storedJti = await redis.get(
        `auth:refresh:${payload.sub}:${deviceId}`
    );

    if (!storedJti || storedJti !== payload.jti) {

        await deleteRefreshSession(
            payload.sub,
            deviceId
        );

        throw new Error("Refresh session expired.");
    }

    // 3. Generate New Access Token
    const {
        token: newAccessToken
    } = generateAccessToken(payload.sub);

    // 4. Generate New Refresh Token
    const {
        token: newRefreshToken,
        jti: newRefreshJti
    } = generateRefreshToken(payload.sub);

    // 5. Store New Refresh Session
    await storeRefreshSession(
        payload.sub,
        deviceId,
        newRefreshJti
    );

    // 6. Check Cache
    let user = await getCachedUser(payload.sub);

    // 7. If Cache Miss → Database
    if (!user) {

        const existingUser = await prisma.user.findUnique({
            where: {
                id: payload.sub
            }
        });

        if (!existingUser) {
            throw new Error("User not found.");
        }

        user = sanitizeUser(existingUser);

        await cacheUser(user);
    }

    // 8. Return Response
    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user
    };
};
const getCurrentUser = async (userId) => {

    let user = await getCachedUser(userId);

    if (!user) {

        const existingUser = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });

        if (!existingUser) {
            throw new Error("User not found.");
        }

        user = sanitizeUser(existingUser);

        await cacheUser(user);
    }

    return user;
};



module.exports = {
    sendOTP,
    verifyOTP,
    login,
    refreshToken,
    logout,
    getCurrentUser
};