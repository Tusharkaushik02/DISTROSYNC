const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");

const {
    createWhatsAppConfig,
    getWhatsAppConfig,
    updateWhatsAppConfig,
    deleteWhatsAppConfig
} = require("../controllers/whatsapp.controller");

router
    .route("/")
    .post(authMiddleware, createWhatsAppConfig)
    .get(authMiddleware, getWhatsAppConfig)
    .put(authMiddleware, updateWhatsAppConfig)
    .delete(authMiddleware, deleteWhatsAppConfig);

module.exports = router;