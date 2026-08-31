const productService = require('../../src/modules/products/product.service');
const productRepository = require('../../src/modules/products/product.repository');
const inventoryRepository = require('../../src/modules/inventory/inventory.repository');
const prisma = require('../../src/config/prisma');
const { AppError } = require('../../src/shared/errors/app.error');

jest.mock('../../src/modules/products/product.repository');
jest.mock('../../src/modules/inventory/inventory.repository');
jest.mock('../../src/config/prisma', () => ({
    $transaction: jest.fn((callback) => callback({
        product: { create: jest.fn() },
        inventory: { create: jest.fn() }
    }))
}));

describe('Product Service Unit Tests', () => {
    const mockTenantA = '11111111-1111-1111-1111-111111111111';
    const mockTenantB = '22222222-2222-2222-2222-222222222222';
    const mockProductId = '44444444-4444-4444-4444-444444444444';

    const mockProduct = {
        id: mockProductId,
        tenantId: mockTenantA,
        sku: 'SALT-001',
        name: 'Tata Salt 1kg',
        description: 'Vacuum evaporated iodised salt',
        unit: 'box',
        price: '28.50',
        active: true,
        inventory: {
            id: 'inv-1',
            productId: mockProductId,
            availableQuantity: 100,
            reservedQuantity: 10
        },
        createdAt: new Date(),
        updatedAt: new Date()
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getProductById', () => {
        it('should return formatted product with inventory for valid tenant', async () => {
            productRepository.findById.mockResolvedValue(mockProduct);

            const result = await productService.getProductById(mockProductId, mockTenantA);

            expect(productRepository.findById).toHaveBeenCalledWith(mockProductId, mockTenantA);
            expect(result.id).toBe(mockProductId);
            expect(result.sku).toBe('SALT-001');
            expect(result.price).toBe(28.5);
            expect(result.availableQuantity).toBe(100);
            expect(result.reservedQuantity).toBe(10);
        });

        it('should throw PRODUCT_NOT_FOUND when product does not exist', async () => {
            productRepository.findById.mockResolvedValue(null);

            await expect(productService.getProductById('non-existent', mockTenantA))
                .rejects
                .toMatchObject({
                    code: 'PRODUCT_NOT_FOUND',
                    statusCode: 404
                });
        });

        it('should reject cross-tenant access', async () => {
            productRepository.findById.mockResolvedValue(null);

            await expect(productService.getProductById(mockProductId, mockTenantB))
                .rejects
                .toMatchObject({
                    code: 'PRODUCT_NOT_FOUND',
                    statusCode: 404
                });

            expect(productRepository.findById).toHaveBeenCalledWith(mockProductId, mockTenantB);
        });
    });

    describe('searchProducts', () => {
        it('should return matching active product candidates', async () => {
            productRepository.search.mockResolvedValue([mockProduct]);

            const results = await productService.searchProducts('tata salt', mockTenantA, { limit: 5 });

            expect(productRepository.search).toHaveBeenCalledWith('tata salt', mockTenantA, { limit: 5, onlyActive: true });
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('Tata Salt 1kg');
            expect(results[0].availableQuantity).toBe(100);
        });

        it('should return empty list for empty search query', async () => {
            const results = await productService.searchProducts('', mockTenantA);
            expect(results).toEqual([]);
            expect(productRepository.search).not.toHaveBeenCalled();
        });
    });

    describe('createProduct', () => {
        it('should create product and initial inventory inside a transaction', async () => {
            productRepository.findBySku.mockResolvedValue(null);
            productRepository.create.mockResolvedValue({
                ...mockProduct,
                inventory: null
            });
            inventoryRepository.create.mockResolvedValue(mockProduct.inventory);

            const input = {
                sku: 'SALT-001',
                name: 'Tata Salt 1kg',
                description: 'Vacuum evaporated iodised salt',
                unit: 'box',
                price: 28.5,
                active: true,
                initialStock: 100
            };

            const result = await productService.createProduct(input, mockTenantA);

            expect(productRepository.findBySku).toHaveBeenCalledWith('SALT-001', mockTenantA);
            expect(result.sku).toBe('SALT-001');
            expect(result.availableQuantity).toBe(100);
        });

        it('should throw PRODUCT_ALREADY_EXISTS if SKU exists for tenant', async () => {
            productRepository.findBySku.mockResolvedValue(mockProduct);

            const input = {
                sku: 'SALT-001',
                name: 'Duplicate Salt',
                price: 25.0
            };

            await expect(productService.createProduct(input, mockTenantA))
                .rejects
                .toMatchObject({
                    code: 'PRODUCT_ALREADY_EXISTS',
                    statusCode: 409
                });
        });
    });
});
