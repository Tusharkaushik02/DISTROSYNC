const express = require('express');
const router = express.Router();
const inventoryController = require('./inventory.controller');
const { authMiddleware } = require('../../shared/middleware/auth.middleware');

// All inventory routes require authentication and tenant context
router.use(authMiddleware);

router.get('/:productId', inventoryController.getByProductId.bind(inventoryController));

module.exports = router;
