const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp } = require('../controllers/auth/otp.controller');
const { login } = require('../controllers/auth/login.controller');
const { refresh, logout, logoutAll } = require('../controllers/auth/session.controller');

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/logout-all', logoutAll);

module.exports = router;