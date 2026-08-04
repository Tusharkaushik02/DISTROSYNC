const jwt = require("jsonwebtoken");

const generateJti = () => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}-${Math.random().toString(36).substring(2, 11)}`;
};

const generateAccessToken = (userId) => {
    const jti = generateJti();

    const token = jwt.sign(
        {
            sub: userId,
            jti,
            type: "access"
        },
        process.env.JWT_ACCESS_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN
        }
    );

    return {
        token,
        jti
    };
};

const generateRefreshToken = (userId) => {
    const jti = generateJti();

    const token = jwt.sign(
        {
            sub: userId,
            jti,
            type: "refresh"
        },
        process.env.JWT_REFRESH_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN
        }
    );

    return {
        token,
        jti
    };
};

const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (error) {
        return null;
    }
};

const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
        return null;
    }
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
};