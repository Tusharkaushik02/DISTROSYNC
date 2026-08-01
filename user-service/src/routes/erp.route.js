const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");

const {
    createERPConfig,
    getERPConfig,
    updateERPConfig,
    deleteERPConfig
} = require("../controllers/erp.controller");

router
    .route("/")
    .post(authMiddleware, createERPConfig)
    .get(authMiddleware, getERPConfig)
    .put(authMiddleware, updateERPConfig)
    .delete(authMiddleware, deleteERPConfig);

module.exports = router;