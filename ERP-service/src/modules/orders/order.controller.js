const orderService = require('./order.service');
const { createOrderSchema, updateOrderSchema, getOrderByIdSchema, updateOrderStatusSchema, searchOrderSchema } = require('./order.schema');
const { successResponse } = require('../../shared/utils/response');

class OrderController {
    async search(req, res, next) {
        try {
            const { q, limit, customerId } = searchOrderSchema.parse(req.query);
            const orders = await orderService.searchOrders(q, req.tenantId, { limit, customerId });
            return successResponse(res, orders);
        } catch (error) {
            next(error);
        }
    }

    async getById(req, res, next) {
        try {
            const { id } = getOrderByIdSchema.parse(req.params);
            const order = await orderService.getOrderById(id, req.tenantId);
            return successResponse(res, order);
        } catch (error) {
            next(error);
        }
    }

    async getStatus(req, res, next) {
        try {
            const { id } = getOrderByIdSchema.parse(req.params);
            const status = await orderService.getOrderStatus(id, req.tenantId);
            return successResponse(res, status);
        } catch (error) {
            next(error);
        }
    }

    async create(req, res, next) {
        try {
            const validatedData = createOrderSchema.parse(req.body);
            const order = await orderService.createOrder(validatedData, req.tenantId);
            return successResponse(res, order, 'Order created successfully', 201);
        } catch (error) {
            next(error);
        }
    }

    async update(req, res, next) {
        try {
            const { id } = getOrderByIdSchema.parse(req.params);
            const validatedData = updateOrderSchema.parse(req.body);
            const updated = await orderService.updateOrder(id, req.tenantId, validatedData);
            return successResponse(res, updated, 'Order updated successfully');
        } catch (error) {
            next(error);
        }
    }

    async updateStatus(req, res, next) {
        try {
            const { id } = getOrderByIdSchema.parse(req.params);
            const { status } = updateOrderStatusSchema.parse(req.body);
            const updated = await orderService.updateStatus(id, req.tenantId, status);
            return successResponse(res, updated, 'Order status updated successfully');
        } catch (error) {
            next(error);
        }
    }

    async list(req, res, next) {
        try {
            const skip = parseInt(req.query.skip) || 0;
            const take = Math.min(parseInt(req.query.take) || 50, 100);
            const customerId = req.query.customerId || null;
            const orders = await orderService.listOrders(req.tenantId, { skip, take, customerId });
            return successResponse(res, orders);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new OrderController();
