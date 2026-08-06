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

// Get Company
router.get("/:companyId", authMiddleware, getCompany);

// Update Company
router.patch("/:companyId", authMiddleware, updateCompany);

// Delete Company
router.delete("/:companyId", authMiddleware, deleteCompany);

module.exports = router;