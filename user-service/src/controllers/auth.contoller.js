const authService = require("../services/auth.service");
const { getDeviceInfo } = require("../utils/device");

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
};

/**
 * Send OTP
 */
const sendOTP = async (req, res) => {
    try {

        // 1. Get Request Data
        const { name, email, phone, password } = req.body;

        // 2. Basic Validation
        if (!name || !email || !password) {
            throw new Error("Name, email and password are required.");
        }

        // 3. Call Service
        const result = await authService.sendOTP({
            name,
            email,
            phone,
            password
        });

        // 4. Store OTP Session
        res.cookie("otpSessionId", result.otpSessionId, {
            ...COOKIE_OPTIONS,
            maxAge: 5 * 60 * 1000
        });

        // 5. Response
        return res.status(200).json({
            success: true,
            message: "OTP sent successfully."
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

/**
 * Verify OTP
 */
const verifyOTP = async (req, res) => {
    try {

        // 1. Get Request Data
        const { otp } = req.body;

        // 2. Check OTP
        if (!otp) {
            throw new Error("OTP is required.");
        }

        // 3. Check OTP Session
        const otpSessionId = req.cookies.otpSessionId;

        if (!otpSessionId) {
            throw new Error("OTP session not found.");
        }

        // 4. Call Service
        const user = await authService.verifyOTP({
            otp,
            otpSessionId
        });

        // 5. Clear OTP Cookie
        res.clearCookie("otpSessionId", COOKIE_OPTIONS);

        // 6. Response
        return res.status(201).json({
            success: true,
            message: "Account created successfully.",
            data: user
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


/**
 * Login
 */
const login = async (req, res) => {
    try {

        // 1. Get Request Data
        const { email, password } = req.body;

        // 2. Basic Validation
        if (!email || !password) {
            throw new Error("Email and password are required.");
        }

        // 3. Get Device Information
        const device = getDeviceInfo(req);

        // 4. Call Service
        const result = await authService.login({
            email,
            password,
            deviceId: device.deviceId
        });

        // 5. Store Access Token
        res.cookie("accessToken", result.accessToken, {
            ...COOKIE_OPTIONS,
            maxAge: 15 * 60 * 1000
        });

        // 6. Store Refresh Token
        res.cookie("refreshToken", result.refreshToken, {
            ...COOKIE_OPTIONS,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // 7. Response
        return res.status(200).json({
            success: true,
            message: "Login successful.",
            data: result.user
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


/**
 * Refresh Token
 */
const refreshToken = async (req, res) => {
    try {

        // 1. Read Refresh Token
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            throw new Error("Refresh token is missing.");
        }

        // 2. Get Device Information
        const device = getDeviceInfo(req);

        // 3. Call Service
        const result = await authService.refreshToken({
            refreshToken,
            deviceId: device.deviceId
        });

        // 4. Update Access Token
        res.cookie("accessToken", result.accessToken, {
            ...COOKIE_OPTIONS,
            maxAge: 15 * 60 * 1000
        });

        // 5. Update Refresh Token
        res.cookie("refreshToken", result.refreshToken, {
            ...COOKIE_OPTIONS,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // 6. Response
        return res.status(200).json({
            success: true,
            message: "Token refreshed successfully.",
            data: result.user
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


/**
 * Logout
 */
const logout = async (req, res) => {
    try {

        // 1. Get Current User
        const userId = req.user.id;

        // 2. Get Device Information
        const device = getDeviceInfo(req);

        // 3. Call Service
        await authService.logout({
            userId,
            deviceId: device.deviceId
        });

        // 4. Clear Cookies
        res.clearCookie("accessToken", COOKIE_OPTIONS);
        res.clearCookie("refreshToken", COOKIE_OPTIONS);

        // 5. Response
        return res.status(200).json({
            success: true,
            message: "Logout successful."
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


/**
 * Get Current User
 */
const getCurrentUser = async (req, res) => {
    try {

        // 1. Get User Id
        const userId = req.user.id;

        // 2. Call Service
        const user = await authService.getCurrentUser(userId);

        // 3. Response
        return res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


module.exports = {
    sendOTP,
    verifyOTP,
    login,
    refreshToken,
    logout,
    getCurrentUser
};