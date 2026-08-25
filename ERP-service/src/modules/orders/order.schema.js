const { z } = require('zod');

const orderItemInputSchema = z.object({
    productId: z.string().uuid('Each item productId must be a valid UUID'),
    quantity: z.coerce.number().int('Quantity must be an integer').positive('Quantity must be greater than 0')
});

const createOrderSchema = z.object({
    customerId: z.string().uuid('customerId must be a valid UUID'),
    items: z.array(orderItemInputSchema).min(1, 'Order must contain at least one item')
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

module.exports = {
    createOrderSchema,
    getOrderByIdSchema,
    updateOrderStatusSchema
};
