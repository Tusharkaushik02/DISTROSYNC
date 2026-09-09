const inventoryRepository = require('./inventory.repository');
const { AppError } = require('../../shared/errors/app.error');

class InventoryService {
    async getInventory(productId, tenantId, tx) {
        const inventory = await inventoryRepository.findByProductId(productId, tenantId, tx);
        if (!inventory) {
            throw new AppError('PRODUCT_NOT_FOUND', `Inventory record for product ${productId} not found`);
        }
        console.log(`[ERP Inventory] 📦 Product ${productId} -> Available: ${inventory.availableQuantity}, Reserved: ${inventory.reservedQuantity}`);
        return inventory;
    }

    async checkAvailability(productId, tenantId, requestedQuantity, tx) {
        const inventory = await this.getInventory(productId, tenantId, tx);
        if (inventory.availableQuantity < requestedQuantity) {
            throw new AppError(
                'INSUFFICIENT_INVENTORY',
                `Insufficient inventory for product ${productId}. Requested: ${requestedQuantity}, Available: ${inventory.availableQuantity}`,
                {
                    productId,
                    requestedQuantity,
                    availableQuantity: inventory.availableQuantity
                }
            );
        }
        return inventory;
    }

    async reserve(productId, tenantId, quantity, tx) {
        const result = await inventoryRepository.reserveStock(productId, tenantId, quantity, tx);
        if (result.count === 0) {
            throw new AppError(
                'INSUFFICIENT_INVENTORY',
                `Failed to reserve inventory for product ${productId}. Insufficient stock or concurrency conflict.`,
                { productId, requestedQuantity: quantity }
            );
        }
        return true;
    }

    async release(productId, tenantId, quantity, tx) {
        await inventoryRepository.releaseStock(productId, tenantId, quantity, tx);
        console.log(`[ERP Inventory] 🔄 Released ${quantity} reserved units for product ${productId}`);
        return true;
    }
}

module.exports = new InventoryService();
