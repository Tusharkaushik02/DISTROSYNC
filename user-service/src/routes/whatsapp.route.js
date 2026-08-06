const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");

const {
    createWhatsAppConfig,
    getWhatsAppConfig,
    updateWhatsAppConfig,
    deleteWhatsAppConfig
} = require("../controllers/whatsapp.controller");

// Create WhatsApp Config
router.post("/", authMiddleware, createWhatsAppConfig);

// Get WhatsApp Config
router.get("/", authMiddleware, getWhatsAppConfig);

// Update WhatsApp Config
router.patch("/", authMiddleware, updateWhatsAppConfig);

// Delete WhatsApp Config
router.delete("/", authMiddleware, deleteWhatsAppConfig);

module.exports = router;