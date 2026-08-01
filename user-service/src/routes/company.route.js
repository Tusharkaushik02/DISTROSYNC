const express = require("express");
const router = express.Router();

const {
    createCompany,
    getCompany,
    updateCompany,
    deleteCompany
} = require("../controllers/company.controller");

const authMiddleware = require("../middlewares/auth.middleware");


// Create Company
router.post("/", authMiddleware, createCompany);

// Get Logged-in User's Company
router.get("/", authMiddleware, getCompany);

// Update Company
router.put("/", authMiddleware, updateCompany);

// Delete Company
router.delete("/", authMiddleware, deleteCompany);

module.exports = router;