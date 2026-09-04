const prisma = require('../../src/config/prisma');
const productRepository = require('../../src/modules/products/product.repository');
const customerRepository = require('../../src/modules/customers/customer.repository');
const orderRepository = require('../../src/modules/orders/order.repository');

jest.mock('../../src/config/prisma', () => ({
    product: { findMany: jest.fn() },
    customer: { findMany: jest.fn() },
    order: { findMany: jest.fn() }
}));

const tenantId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';

function hasInvalidIdContains(value) {
    if (!value || typeof value !== 'object') return false;
    if (value.id && value.id.contains !== undefined) return true;
    return Object.values(value).some(hasInvalidIdContains);
}

describe('ERP search repository filters', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.product.findMany.mockResolvedValue([]);
        prisma.customer.findMany.mockResolvedValue([]);
        prisma.order.findMany.mockResolvedValue([]);
    });

    it('uses text fields for natural-language product queries', async () => {
        await productRepository.search('blue shampoo', tenantId);

        const where = prisma.product.findMany.mock.calls[0][0].where;
        expect(where.tenantId).toBe(tenantId);
        expect(hasInvalidIdContains(where)).toBe(false);
        expect(where.OR).toEqual(expect.arrayContaining([
            { name: { contains: 'blue shampoo', mode: 'insensitive' } },
            { sku: { contains: 'blue shampoo', mode: 'insensitive' } },
            { description: { contains: 'blue shampoo', mode: 'insensitive' } }
        ]));
    });

    it('uses exact ID equality only for a valid product UUID', async () => {
        await productRepository.search(productId, tenantId);

        const where = prisma.product.findMany.mock.calls[0][0].where;
        expect(where.OR).toContainEqual({ id: productId });
        expect(hasInvalidIdContains(where)).toBe(false);
    });

    it('does not treat a natural-language product query as an ID', async () => {
        await productRepository.search('blu shampoo', tenantId);

        const where = prisma.product.findMany.mock.calls[0][0].where;
        expect(where.OR).not.toContainEqual({ id: 'blu shampoo' });
        expect(hasInvalidIdContains(where)).toBe(false);
    });

    it('keeps customer and order ID filters Prisma-compatible', async () => {
        await customerRepository.search('blue', tenantId);
        await orderRepository.search('blue', tenantId);

        expect(hasInvalidIdContains(prisma.customer.findMany.mock.calls[0][0].where)).toBe(false);
        expect(hasInvalidIdContains(prisma.order.findMany.mock.calls[0][0].where)).toBe(false);
    });
});