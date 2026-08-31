const prisma = require('../../config/prisma');

class ProductRepository {
    async findById(id, tenantId, tx = prisma) {
        return tx.product.findFirst({
            where: {
                id,
                tenantId
            },
            include: {
                inventory: true
            }
        });
    }

    async findBySku(sku, tenantId, tx = prisma) {
        return tx.product.findFirst({
            where: {
                sku,
                tenantId
            },
            include: {
                inventory: true
            }
        });
    }

    async search(query, tenantId, { limit = 10, onlyActive = true } = {}, tx = prisma) {
        const whereClause = {
            tenantId,
            ...(onlyActive ? { active: true } : {}),
            OR: [
                {
                    name: {
                        contains: query,
                        mode: 'insensitive'
                    }
                },
                {
                    sku: {
                        contains: query,
                        mode: 'insensitive'
                    }
                },
                {
                    description: {
                        contains: query,
                        mode: 'insensitive'
                    }
                }
            ]
        };

        return tx.product.findMany({
            where: whereClause,
            take: limit,
            include: {
                inventory: true
            },
            orderBy: {
                name: 'asc'
            }
        });
    }

    async create(data, tx = prisma) {
        return tx.product.create({
            data,
            include: {
                inventory: true
            }
        });
    }

    async list(tenantId, { skip = 0, take = 50, onlyActive = false } = {}, tx = prisma) {
        return tx.product.findMany({
            where: {
                tenantId,
                ...(onlyActive ? { active: true } : {})
            },
            skip,
            take,
            include: {
                inventory: true
            },
            orderBy: {
                name: 'asc'
            }
        });
    }
}

module.exports = new ProductRepository();
