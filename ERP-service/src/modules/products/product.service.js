const productRepository = require('./product.repository');
const inventoryRepository = require('../inventory/inventory.repository');
const prisma = require('../../config/prisma');
const { AppError } = require('../../shared/errors/app.error');

class ProductService {
    async getProductById(id, tenantId) {
        const product = await productRepository.findById(id, tenantId);
        if (!product) {
            throw new AppError('PRODUCT_NOT_FOUND', `Product with id ${id} not found`);
        }
        return this.formatProduct(product);
    }

    async searchProducts(query, tenantId, { limit = 10 } = {}) {
        const cleanQuery = (query || '').trim();
        if (!cleanQuery) {
            return [];
        }

        const products = await productRepository.search(cleanQuery, tenantId, { limit, onlyActive: true });
        return products.map(p => this.formatProduct(p));
    }

    async createProduct(data, tenantId) {
        const cleanSku = data.sku.trim();
        const cleanName = data.name.trim();

        // Check if SKU exists in tenant
        const existing = await productRepository.findBySku(cleanSku, tenantId);
        if (existing) {
            throw new AppError('PRODUCT_ALREADY_EXISTS', `Product with SKU ${cleanSku} already exists for this tenant`);
        }

        return prisma.$transaction(async (tx) => {
            const product = await productRepository.create({
                tenantId,
                sku: cleanSku,
                name: cleanName,
                description: data.description ? data.description.trim() : null,
                unit: data.unit || 'unit',
                price: data.price,
                active: data.active !== undefined ? data.active : true
            }, tx);

            // Create initial inventory record
            const inventory = await inventoryRepository.create({
                tenantId,
                productId: product.id,
                availableQuantity: data.initialStock || 0,
                reservedQuantity: 0
            }, tx);

            product.inventory = inventory;
            return this.formatProduct(product);
        });
    }

    async listProducts(tenantId, options = {}) {
        const products = await productRepository.list(tenantId, options);
        return products.map(p => this.formatProduct(p));
    }

    formatProduct(product) {
        return {
            id: product.id,
            tenantId: product.tenantId,
            sku: product.sku,
            name: product.name,
            description: product.description,
            unit: product.unit,
            price: Number(product.price),
            active: product.active,
            availableQuantity: product.inventory ? product.inventory.availableQuantity : 0,
            reservedQuantity: product.inventory ? product.inventory.reservedQuantity : 0,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt
        };
    }
}

module.exports = new ProductService();
