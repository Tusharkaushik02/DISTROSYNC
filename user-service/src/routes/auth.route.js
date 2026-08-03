const express = require('express');
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
router.post('/logout', logout);
router.get('/me', getCurrentUser);

module.exports = router;