const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const router = express.Router();
const {
    sendOTP,
    verifyOTP,
    login,
    refreshToken,
    logout,
    getCurrentUser
} = require('../controllers/auth.controller');

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getCurrentUser);

module.exports = router;