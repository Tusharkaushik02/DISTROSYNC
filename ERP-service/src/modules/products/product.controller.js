const productService = require('./product.service');
const { createProductSchema, getProductByIdSchema, searchProductSchema } = require('./product.schema');
const { successResponse } = require('../../shared/utils/response');

class ProductController {
    async getById(req, res, next) {
        try {
            const { id } = getProductByIdSchema.parse(req.params);
            const product = await productService.getProductById(id, req.tenantId);
            return successResponse(res, product);
        } catch (error) {
            next(error);
        }
    }

    async search(req, res, next) {
        try {
            const { q, limit } = searchProductSchema.parse(req.query);
            const results = await productService.searchProducts(q, req.tenantId, { limit });
            return successResponse(res, results);
        } catch (error) {
            next(error);
        }
    }

    async create(req, res, next) {
        try {
            const validatedData = createProductSchema.parse(req.body);
            const product = await productService.createProduct(validatedData, req.tenantId);
            return successResponse(res, product, 'Product created successfully', 201);
        } catch (error) {
            next(error);
        }
    }

    async list(req, res, next) {
        try {
            const skip = parseInt(req.query.skip) || 0;
            const take = Math.min(parseInt(req.query.take) || 50, 100);
            const onlyActive = req.query.onlyActive === 'true';
            const products = await productService.listProducts(req.tenantId, { skip, take, onlyActive });
            return successResponse(res, products);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ProductController();
