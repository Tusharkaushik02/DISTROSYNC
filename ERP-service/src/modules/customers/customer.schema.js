const { z } = require('zod');

const createCustomerSchema = z.object({
    name: z.string().min(1, 'Name is required').max(150, 'Name cannot exceed 150 characters'),
    phone: z.string().min(5, 'Phone must be at least 5 digits').max(20, 'Phone cannot exceed 20 characters'),
    externalId: z.string().max(100).optional().nullable()
});

const getCustomerByIdSchema = z.object({
    id: z.string().uuid('Customer ID must be a valid UUID')
});

const getCustomerByPhoneSchema = z.object({
    phone: z.string().min(5, 'Phone number must be at least 5 digits')
});

const searchCustomerSchema = z.object({
    q: z.string().min(1, 'Search query parameter "q" cannot be empty'),
    limit: z.coerce.number().int().positive().max(100).default(10)
});

module.exports = {
    createCustomerSchema,
    getCustomerByIdSchema,
    getCustomerByPhoneSchema,
    searchCustomerSchema
};
