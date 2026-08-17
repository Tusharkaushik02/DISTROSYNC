const express = require("express");

const {
    verifyWebhook
} = require("../controllers/webhook.controller");

const router = express.Router();

router.get("/webhook", verifyWebhook);

module.exports = router;