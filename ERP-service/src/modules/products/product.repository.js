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
        const stopWords = new Set([
            'a', 'about', 'an', 'and', 'can', 'could', 'details', 'do', 'find', 'for', 'get',
            'have', 'i', 'information', 'is', 'me', 'of', 'please', 'product', 'products',
            'search', 'show', 'stock', 'tell', 'the', 'there', 'this', 'want', 'what', 'you'
        ]);
        const normalizedQuery = (query || '').trim().toLowerCase();
        const searchTokens = normalizedQuery
            .split(/[^a-z0-9]+/)
            .filter(token => token.length > 1 && !stopWords.has(token));

        if (!searchTokens.length) {
            return [];
        }

        const whereClause = {
            tenantId,
            ...(onlyActive ? { active: true } : {}),
            AND: searchTokens.map(token => ({
                OR: [
                    { name: { contains: token, mode: 'insensitive' } },
                    { sku: { contains: token, mode: 'insensitive' } },
                    { description: { contains: token, mode: 'insensitive' } }
                ]
            }))
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
