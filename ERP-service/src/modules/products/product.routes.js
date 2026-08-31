const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const { authMiddleware } = require('../../shared/middleware/auth.middleware');

// All product routes require authentication and tenant context
router.use(authMiddleware);

// Routes
router.post('/', productController.create.bind(productController));
router.get('/', productController.list.bind(productController));
router.get('/search', productController.search.bind(productController));
router.get('/:id', productController.getById.bind(productController));

module.exports = router;
