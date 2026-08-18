const express = require("express");

const {
    verifyWebhook,
    receiveWebhook,
    sendMessage,
} = require("../controllers/webhook.controller");

const router = express.Router();

router.get("/webhook", verifyWebhook);
router.post("/webhook", receiveWebhook);
router.post("/whatsapp", receiveWebhook);
router.post("/", receiveWebhook);
router.post("/send", sendMessage);

module.exports = router;