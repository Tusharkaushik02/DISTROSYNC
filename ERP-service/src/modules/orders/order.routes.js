const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const { authMiddleware } = require('../../shared/middleware/auth.middleware');

// All order routes require authentication and tenant context
router.use(authMiddleware);

// Routes
router.post('/', orderController.create.bind(orderController));
router.get('/', orderController.list.bind(orderController));
router.get('/search', orderController.search.bind(orderController));
router.get('/:id/status', orderController.getStatus.bind(orderController));
router.get('/:id', orderController.getById.bind(orderController));
router.patch('/:id/status', orderController.updateStatus.bind(orderController));

module.exports = router;
