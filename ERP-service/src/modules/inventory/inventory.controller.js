const inventoryService = require('./inventory.service');
const { z } = require('zod');
const { successResponse } = require('../../shared/utils/response');

const getInventoryByProductSchema = z.object({
    productId: z.string().uuid('Product ID must be a valid UUID')
});

class InventoryController {
    async getByProductId(req, res, next) {
        try {
            const { productId } = getInventoryByProductSchema.parse(req.params);
            const inventory = await inventoryService.getInventory(productId, req.tenantId);
            return successResponse(res, inventory);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new InventoryController();
