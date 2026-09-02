const inventoryService = require('../../src/modules/inventory/inventory.service');
const inventoryRepository = require('../../src/modules/inventory/inventory.repository');
const { AppError } = require('../../src/shared/errors/app.error');

jest.mock('../../src/modules/inventory/inventory.repository');

describe('Inventory Service Unit Tests', () => {
    const mockTenantId = 'tenant-uuid-1';
    const mockProductId = 'product-uuid-1';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getInventory', () => {
        it('should return inventory when record exists', async () => {
            const mockInventory = {
                id: 'inv-1',
                productId: mockProductId,
                tenantId: mockTenantId,
                availableQuantity: 73,
                reservedQuantity: 5
            };

            inventoryRepository.findByProductId.mockResolvedValue(mockInventory);

            const result = await inventoryService.getInventory(mockProductId, mockTenantId);

            expect(result).toEqual(mockInventory);
            expect(inventoryRepository.findByProductId).toHaveBeenCalledWith(mockProductId, mockTenantId, undefined);
        });

        it('should throw PRODUCT_NOT_FOUND when inventory record does not exist', async () => {
            inventoryRepository.findByProductId.mockResolvedValue(null);

            await expect(
                inventoryService.getInventory(mockProductId, mockTenantId)
            ).rejects.toThrow(AppError);
        });
    });

    describe('checkAvailability', () => {
        it('should return inventory when stock is sufficient', async () => {
            inventoryRepository.findByProductId.mockResolvedValue({
                availableQuantity: 50,
                reservedQuantity: 0
            });

            const result = await inventoryService.checkAvailability(mockProductId, mockTenantId, 20);
            expect(result.availableQuantity).toBe(50);
        });

        it('should throw INSUFFICIENT_INVENTORY when stock is less than requested', async () => {
            inventoryRepository.findByProductId.mockResolvedValue({
                availableQuantity: 10,
                reservedQuantity: 0
            });

            await expect(
                inventoryService.checkAvailability(mockProductId, mockTenantId, 20)
            ).rejects.toThrow(AppError);
        });
    });

    describe('reserve', () => {
        it('should return true when stock is successfully reserved', async () => {
            inventoryRepository.reserveStock.mockResolvedValue({ count: 1 });

            const result = await inventoryService.reserve(mockProductId, mockTenantId, 10);
            expect(result).toBe(true);
        });

        it('should throw INSUFFICIENT_INVENTORY when reservation count is 0', async () => {
            inventoryRepository.reserveStock.mockResolvedValue({ count: 0 });

            await expect(
                inventoryService.reserve(mockProductId, mockTenantId, 10)
            ).rejects.toThrow(AppError);
        });
    });
});
