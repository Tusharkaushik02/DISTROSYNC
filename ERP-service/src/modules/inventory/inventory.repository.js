const prisma = require('../../config/prisma');

class InventoryRepository {
    async findByProductId(productId, tenantId, tx = prisma) {
        return tx.inventory.findFirst({
            where: {
                productId,
                tenantId
            }
        });
    }

    async create(data, tx = prisma) {
        return tx.inventory.create({
            data
        });
    }

    async update(id, data, tx = prisma) {
        return tx.inventory.update({
            where: { id },
            data
        });
    }

    async updateByProductId(productId, tenantId, data, tx = prisma) {
        return tx.inventory.updateMany({
            where: {
                productId,
                tenantId
            },
            data
        });
    }

    async reserveStock(productId, tenantId, quantity, tx = prisma) {
        // Atomic decrement of available and increment of reserved
        return tx.inventory.updateMany({
            where: {
                productId,
                tenantId,
                availableQuantity: { gte: quantity }
            },
            data: {
                availableQuantity: { decrement: quantity },
                reservedQuantity: { increment: quantity }
            }
        });
    }
}

module.exports = new InventoryRepository();
