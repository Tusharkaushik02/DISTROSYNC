const express = require('express');
const router = express.Router();
const {
    sendOtp,
    verifyOtp,
    login,
    refresh,
    logout,
    logoutAll
} = require('../controllers/auth/auth.controller');

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/logout-all', logoutAll);

module.exports = router;