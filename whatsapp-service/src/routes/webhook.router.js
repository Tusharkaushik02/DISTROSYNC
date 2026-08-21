const express = require("express");
const validateTwilioRequest = require("../middleware/twiliio.middleware");

const {
    verifyWebhook,
    receiveWebhook,
    sendMessage,
} = require("../controllers/webhook.controller");

const router = express.Router();

router.get("/webhook", verifyWebhook);
router.post("/webhook", express.urlencoded({ extended: false }), validateTwilioRequest, receiveWebhook);
router.post("/whatsapp", express.urlencoded({ extended: false }), validateTwilioRequest, receiveWebhook);
router.post("/", express.urlencoded({ extended: false }), validateTwilioRequest, receiveWebhook);

module.exports = router;