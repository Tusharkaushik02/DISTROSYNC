const orderRepository = require('./order.repository');
const customerRepository = require('../customers/customer.repository');
const productRepository = require('../products/product.repository');
const inventoryService = require('../inventory/inventory.service');
const prisma = require('../../config/prisma');
const { AppError } = require('../../shared/errors/app.error');

class OrderService {
    async getOrderById(id, tenantId) {
        const order = await orderRepository.findById(id, tenantId);
        if (!order) {
            throw new AppError('ORDER_NOT_FOUND', `Order with id ${id} not found`);
        }
        return this.formatOrder(order);
    }

    async getOrderStatus(id, tenantId) {
        const order = await orderRepository.findStatusById(id, tenantId);
        if (!order) {
            throw new AppError('ORDER_NOT_FOUND', `Order with id ${id} not found`);
        }
        return {
            orderId: order.id,
            status: order.status,
            updatedAt: order.updatedAt
        };
    }

    async createOrder(data, tenantId) {
        const { customerId, items } = data;

        if (!items || items.length === 0) {
            throw new AppError('EMPTY_ORDER_ITEMS', 'Order must contain at least one item');
        }

        // ── 1. Validate Customer ─────────────────────────────────────────
        const customer = await customerRepository.findById(customerId, tenantId);
        if (!customer) {
            throw new AppError('CUSTOMER_NOT_FOUND', `Customer with id ${customerId} not found for this tenant`);
        }

        // ── 2. Validate Products & Collect Authoritative Data ────────────
        const validatedItems = [];
        let totalOrderAmount = 0;

        for (const item of items) {
            if (!item.quantity || item.quantity <= 0) {
                throw new AppError('INVALID_QUANTITY', `Quantity for item ${item.productId} must be greater than 0`);
            }

            const product = await productRepository.findById(item.productId, tenantId);
            if (!product) {
                throw new AppError('PRODUCT_NOT_FOUND', `Product with id ${item.productId} not found for this tenant`);
            }

            if (!product.active) {
                throw new AppError('PRODUCT_INACTIVE', `Product "${product.name}" (${product.sku}) is currently inactive`);
            }

            // Check inventory availability
            const availableStock = product.inventory ? product.inventory.availableQuantity : 0;
            if (availableStock < item.quantity) {
                throw new AppError(
                    'INSUFFICIENT_INVENTORY',
                    `Insufficient stock for "${product.name}". Requested: ${item.quantity}, Available: ${availableStock}`,
                    {
                        productId: product.id,
                        productName: product.name,
                        requestedQuantity: item.quantity,
                        availableQuantity: availableStock
                    }
                );
            }

            // Authoritative Pricing from ERP Database
            const unitPrice = Number(product.price);
            const lineTotal = Number((unitPrice * item.quantity).toFixed(2));
            totalOrderAmount += lineTotal;

            validatedItems.push({
                productId: product.id,
                quantity: item.quantity,
                unitPrice: unitPrice,
                totalPrice: lineTotal
            });
        }

        totalOrderAmount = Number(totalOrderAmount.toFixed(2));

        // ── 3. Execute Transaction ───────────────────────────────────────
        const createdOrder = await prisma.$transaction(async (tx) => {
            // A. Create Order with nested items
            const newOrder = await tx.order.create({
                data: {
                    tenantId,
                    customerId: customer.id,
                    status: 'CONFIRMED',
                    totalAmount: totalOrderAmount,
                    items: {
                        create: validatedItems.map(item => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            totalPrice: item.totalPrice
                        }))
                    }
                },
                include: {
                    customer: {
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                            externalId: true
                        }
                    },
                    items: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    sku: true,
                                    name: true,
                                    unit: true
                                }
                            }
                        }
                    }
                }
            });

            // B. Reserve Inventory for each item
            for (const item of validatedItems) {
                await inventoryService.reserve(item.productId, tenantId, item.quantity, tx);
            }

            return newOrder;
        });

        return this.formatOrder(createdOrder);
    }

    async updateStatus(id, tenantId, status) {
        const existing = await orderRepository.findById(id, tenantId);
        if (!existing) {
            throw new AppError('ORDER_NOT_FOUND', `Order with id ${id} not found`);
        }

        const updated = await orderRepository.updateStatus(id, tenantId, status);
        return {
            orderId: updated.id,
            status: updated.status,
            updatedAt: updated.updatedAt
        };
    }

    async listOrders(tenantId, options = {}) {
        const orders = await orderRepository.list(tenantId, options);
        return orders.map(o => this.formatOrder(o));
    }

    formatOrder(order) {
        return {
            id: order.id,
            tenantId: order.tenantId,
            status: order.status,
            totalAmount: Number(order.totalAmount),
            customer: order.customer ? {
                id: order.customer.id,
                name: order.customer.name,
                phone: order.customer.phone,
                externalId: order.customer.externalId
            } : null,
            items: (order.items || []).map(item => ({
                id: item.id,
                productId: item.productId,
                sku: item.product ? item.product.sku : null,
                productName: item.product ? item.product.name : null,
                unit: item.product ? item.product.unit : null,
                quantity: item.quantity,
                unitPrice: Number(item.unitPrice),
                totalPrice: Number(item.totalPrice)
            })),
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        };
    }
}

module.exports = new OrderService();
