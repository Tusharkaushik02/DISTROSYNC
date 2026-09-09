const { z } = require('zod');

const orderItemInputSchema = z.object({
    productId: z.string().uuid('Each item productId must be a valid UUID'),
    quantity: z.coerce.number().int('Quantity must be an integer').positive('Quantity must be greater than 0')
});

const createOrderSchema = z.object({
    customerId: z.string().uuid('customerId must be a valid UUID'),
    shippingAddress: z.string().max(1000).optional().nullable(),
    items: z.array(orderItemInputSchema).min(1, 'Order must contain at least one item')
});

const updateOrderSchema = z.object({
    shippingAddress: z.string().min(1, 'shippingAddress cannot be empty').max(1000).optional()
}).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update'
});

const getOrderByIdSchema = z.object({
    id: z.string().uuid('Order ID must be a valid UUID')
});

const updateOrderStatusSchema = z.object({
    status: z.enum([
        'PENDING',
        'CONFIRMED',
        'PROCESSING',
        'SHIPPED',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED'
    ], {
        errorMap: () => ({ message: 'Invalid order status' })
    })
});

const searchOrderSchema = z.object({
    q: z.string().min(1, 'Search query parameter "q" cannot be empty'),
    limit: z.coerce.number().int().positive().max(100).default(10),
    customerId: z.string().uuid().optional()
});

module.exports = {
    createOrderSchema,
    updateOrderSchema,
    getOrderByIdSchema,
    updateOrderStatusSchema,
    searchOrderSchema
};
