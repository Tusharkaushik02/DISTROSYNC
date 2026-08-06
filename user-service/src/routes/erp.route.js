const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");

const {
    createERPConfig,
    getERPConfig,
    updateERPConfig,
    deleteERPConfig
} = require("../controllers/erp.controller");

// Create ERP Config
router.post("/", authMiddleware, createERPConfig);

// Get ERP Config
router.get("/", authMiddleware, getERPConfig);

// Update ERP Config
router.patch("/", authMiddleware, updateERPConfig);

// Delete ERP Config
router.delete("/", authMiddleware, deleteERPConfig);

module.exports = router;