const { z } = require('zod');

const createProductSchema = z.object({
    sku: z.string().min(1, 'SKU is required').max(50, 'SKU cannot exceed 50 characters'),
    name: z.string().min(1, 'Product name is required').max(200, 'Product name cannot exceed 200 characters'),
    description: z.string().max(1000).optional().nullable(),
    category: z.string().max(100).optional().nullable(),
    tags: z.array(z.string()).default([]),
    unit: z.string().min(1).max(50).default('unit'),
    price: z.coerce.number().positive('Price must be greater than 0'),
    active: z.boolean().default(true),
    initialStock: z.coerce.number().int().min(0).default(0)
});

const getProductByIdSchema = z.object({
    id: z.string().uuid('Product ID must be a valid UUID')
});

const searchProductSchema = z.object({
    q: z.string().min(1, 'Search query parameter "q" cannot be empty'),
    limit: z.coerce.number().int().min(1).max(50).default(10)
});

module.exports = {
    createProductSchema,
    getProductByIdSchema,
    searchProductSchema
};
