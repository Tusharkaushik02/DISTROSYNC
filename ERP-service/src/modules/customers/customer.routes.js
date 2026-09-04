const express = require('express');
const router = express.Router();
const customerController = require('./customer.controller');
const { authMiddleware } = require('../../shared/middleware/auth.middleware');

// All customer routes require authentication and tenant context
router.use(authMiddleware);

// Routes
router.post('/', customerController.create.bind(customerController));
router.get('/', customerController.list.bind(customerController));
router.get('/search', customerController.search.bind(customerController));
router.get('/by-phone/:phone', customerController.getByPhone.bind(customerController));
router.get('/:id', customerController.getById.bind(customerController));

module.exports = router;
