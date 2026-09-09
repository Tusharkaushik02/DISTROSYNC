const orderService = require('../../src/modules/orders/order.service');
const orderRepository = require('../../src/modules/orders/order.repository');
const customerRepository = require('../../src/modules/customers/customer.repository');
const productRepository = require('../../src/modules/products/product.repository');
const inventoryService = require('../../src/modules/inventory/inventory.service');
const prisma = require('../../src/config/prisma');
const { AppError } = require('../../src/shared/errors/app.error');

jest.mock('../../src/modules/orders/order.repository');
jest.mock('../../src/modules/customers/customer.repository');
jest.mock('../../src/modules/products/product.repository');
jest.mock('../../src/modules/inventory/inventory.service');
jest.mock('../../src/config/prisma', () => ({
    $transaction: jest.fn((callback) => callback({
        order: { create: jest.fn() }
    }))
}));

describe('Order Service Unit Tests', () => {
    const mockTenantA = '11111111-1111-1111-1111-111111111111';
    const mockTenantB = '22222222-2222-2222-2222-222222222222';
    const mockCustomerId = '33333333-3333-3333-3333-333333333333';
    const mockProductId = '44444444-4444-4444-4444-444444444444';
    const mockOrderId = '55555555-5555-5555-5555-555555555555';

    const mockCustomer = {
        id: mockCustomerId,
        tenantId: mockTenantA,
        name: 'John Customer',
        phone: '+919876543210'
    };

    const mockProduct = {
        id: mockProductId,
        tenantId: mockTenantA,
        sku: 'RICE-001',
        name: 'Basmati Rice 5kg',
        unit: 'bag',
        price: '450.00',
        active: true,
        inventory: {
            availableQuantity: 50,
            reservedQuantity: 5
        }
    };

    const mockOrder = {
        id: mockOrderId,
        tenantId: mockTenantA,
        customerId: mockCustomerId,
        status: 'CONFIRMED',
        totalAmount: '900.00',
        customer: mockCustomer,
        items: [
            {
                id: 'item-1',
                orderId: mockOrderId,
                productId: mockProductId,
                quantity: 2,
                unitPrice: '450.00',
                totalPrice: '900.00',
                product: {
                    id: mockProductId,
                    sku: 'RICE-001',
                    name: 'Basmati Rice 5kg',
                    unit: 'bag'
                }
            }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getOrderById', () => {
        it('should return authoritative order details for tenant', async () => {
            orderRepository.findById.mockResolvedValue(mockOrder);

            const result = await orderService.getOrderById(mockOrderId, mockTenantA);

            expect(orderRepository.findById).toHaveBeenCalledWith(mockOrderId, mockTenantA);
            expect(result.id).toBe(mockOrderId);
            expect(result.status).toBe('CONFIRMED');
            expect(result.totalAmount).toBe(900);
            expect(result.items[0].productName).toBe('Basmati Rice 5kg');
            expect(result.items[0].unitPrice).toBe(450);
            expect(result.items[0].totalPrice).toBe(900);
        });

        it('should throw ORDER_NOT_FOUND when order does not exist', async () => {
            orderRepository.findById.mockResolvedValue(null);

            await expect(orderService.getOrderById('missing-order', mockTenantA))
                .rejects
                .toMatchObject({
                    code: 'ORDER_NOT_FOUND',
                    statusCode: 404
                });
        });

        it('should reject cross-tenant order access', async () => {
            orderRepository.findById.mockResolvedValue(null);

            await expect(orderService.getOrderById(mockOrderId, mockTenantB))
                .rejects
                .toMatchObject({
                    code: 'ORDER_NOT_FOUND',
                    statusCode: 404
                });
        });
    });

    describe('getOrderStatus', () => {
        it('should return lightweight status object', async () => {
            orderRepository.findStatusById.mockResolvedValue({
                id: mockOrderId,
                status: 'PROCESSING',
                updatedAt: new Date('2026-08-25T12:00:00Z')
            });

            const result = await orderService.getOrderStatus(mockOrderId, mockTenantA);

            expect(result).toEqual({
                orderId: mockOrderId,
                status: 'PROCESSING',
                updatedAt: new Date('2026-08-25T12:00:00Z')
            });
        });
    });

    describe('createOrder', () => {
        it('should create order with authoritative ERP price calculation and inventory reservation', async () => {
            customerRepository.findById.mockResolvedValue(mockCustomer);
            productRepository.findById.mockResolvedValue(mockProduct);
            inventoryService.reserve.mockResolvedValue(true);

            prisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    order: {
                        create: jest.fn().mockResolvedValue(mockOrder)
                    }
                };
                return callback(tx);
            });

            const orderPayload = {
                customerId: mockCustomerId,
                items: [
                    {
                        productId: mockProductId,
                        quantity: 2
                    }
                ]
            };

            const result = await orderService.createOrder(orderPayload, mockTenantA);

            expect(customerRepository.findById).toHaveBeenCalledWith(mockCustomerId, mockTenantA);
            expect(productRepository.findById).toHaveBeenCalledWith(mockProductId, mockTenantA);
            expect(inventoryService.reserve).toHaveBeenCalledWith(mockProductId, mockTenantA, 2, expect.anything());
            expect(result.id).toBe(mockOrderId);
            expect(result.totalAmount).toBe(900);
        });

        it('should reject order if customer is not found or belongs to different tenant', async () => {
            customerRepository.findById.mockResolvedValue(null);

            const orderPayload = {
                customerId: 'invalid-cust',
                items: [{ productId: mockProductId, quantity: 1 }]
            };

            await expect(orderService.createOrder(orderPayload, mockTenantA))
                .rejects
                .toMatchObject({
                    code: 'CUSTOMER_NOT_FOUND',
                    statusCode: 404
                });
        });

        it('should reject order if product is inactive', async () => {
            customerRepository.findById.mockResolvedValue(mockCustomer);
            productRepository.findById.mockResolvedValue({
                ...mockProduct,
                active: false
            });

            const orderPayload = {
                customerId: mockCustomerId,
                items: [{ productId: mockProductId, quantity: 1 }]
            };

            await expect(orderService.createOrder(orderPayload, mockTenantA))
                .rejects
                .toMatchObject({
                    code: 'PRODUCT_INACTIVE',
                    statusCode: 400
                });
        });

        it('should reject order if inventory is insufficient', async () => {
            customerRepository.findById.mockResolvedValue(mockCustomer);
            productRepository.findById.mockResolvedValue({
                ...mockProduct,
                inventory: { availableQuantity: 3, reservedQuantity: 0 }
            });

            const orderPayload = {
                customerId: mockCustomerId,
                items: [{ productId: mockProductId, quantity: 10 }]
            };

            await expect(orderService.createOrder(orderPayload, mockTenantA))
                .rejects
                .toMatchObject({
                    code: 'INSUFFICIENT_INVENTORY',
                    statusCode: 400
                });
        });

        it('should reject order if quantity is zero or negative', async () => {
            customerRepository.findById.mockResolvedValue(mockCustomer);

            const orderPayload = {
                customerId: mockCustomerId,
                items: [{ productId: mockProductId, quantity: 0 }]
            };

            await expect(orderService.createOrder(orderPayload, mockTenantA))
                .rejects
                .toMatchObject({
                    code: 'INVALID_QUANTITY',
                    statusCode: 400
                });
        });
    });

    describe('updateOrder', () => {
        it('should update shippingAddress for a CONFIRMED order', async () => {
            orderRepository.findById.mockResolvedValue(mockOrder);
            orderRepository.updateOrder.mockResolvedValue({
                ...mockOrder,
                shippingAddress: '456 New Market Rd, Shop 12'
            });

            const result = await orderService.updateOrder(
                mockOrderId,
                mockTenantA,
                { shippingAddress: '456 New Market Rd, Shop 12' }
            );

            expect(orderRepository.findById).toHaveBeenCalledWith(mockOrderId, mockTenantA);
            expect(orderRepository.updateOrder).toHaveBeenCalledWith(
                mockOrderId,
                mockTenantA,
                { shippingAddress: '456 New Market Rd, Shop 12' }
            );
            expect(result.shippingAddress).toBe('456 New Market Rd, Shop 12');
        });

        it('should reject modification if order is SHIPPED', async () => {
            orderRepository.findById.mockResolvedValue({
                ...mockOrder,
                status: 'SHIPPED'
            });

            await expect(orderService.updateOrder(mockOrderId, mockTenantA, { shippingAddress: 'New Addr' }))
                .rejects
                .toMatchObject({
                    code: 'ORDER_NOT_MODIFIABLE',
                    statusCode: 400
                });
        });

        it('should reject modification if order is DELIVERED', async () => {
            orderRepository.findById.mockResolvedValue({
                ...mockOrder,
                status: 'DELIVERED'
            });

            await expect(orderService.updateOrder(mockOrderId, mockTenantA, { shippingAddress: 'New Addr' }))
                .rejects
                .toMatchObject({
                    code: 'ORDER_NOT_MODIFIABLE',
                    statusCode: 400
                });
        });

        it('should throw ORDER_NOT_FOUND when updating non-existent order', async () => {
            orderRepository.findById.mockResolvedValue(null);

            await expect(orderService.updateOrder('unknown-id', mockTenantA, { shippingAddress: 'New Addr' }))
                .rejects
                .toMatchObject({
                    code: 'ORDER_NOT_FOUND',
                    statusCode: 404
                });
        });
    });

    describe('updateStatus', () => {
        it('should cancel CONFIRMED order and release reserved inventory', async () => {
            orderRepository.findById.mockResolvedValue(mockOrder);
            orderRepository.updateStatus.mockResolvedValue({
                ...mockOrder,
                status: 'CANCELLED',
                updatedAt: new Date()
            });
            inventoryService.release.mockResolvedValue(true);

            const result = await orderService.updateStatus(mockOrderId, mockTenantA, 'CANCELLED');

            expect(orderRepository.findById).toHaveBeenCalledWith(mockOrderId, mockTenantA);
            expect(inventoryService.release).toHaveBeenCalledWith(mockProductId, mockTenantA, 2, expect.anything());
            expect(result.status).toBe('CANCELLED');
        });

        it('should reject cancellation if order is already CANCELLED', async () => {
            orderRepository.findById.mockResolvedValue({
                ...mockOrder,
                status: 'CANCELLED'
            });

            await expect(orderService.updateStatus(mockOrderId, mockTenantA, 'CANCELLED'))
                .rejects
                .toMatchObject({
                    code: 'ORDER_ALREADY_CANCELLED',
                    statusCode: 400
                });
        });

        it('should reject cancellation if order is DELIVERED', async () => {
            orderRepository.findById.mockResolvedValue({
                ...mockOrder,
                status: 'DELIVERED'
            });

            await expect(orderService.updateStatus(mockOrderId, mockTenantA, 'CANCELLED'))
                .rejects
                .toMatchObject({
                    code: 'ORDER_NOT_CANCELLABLE',
                    statusCode: 400
                });
        });
    });
});
