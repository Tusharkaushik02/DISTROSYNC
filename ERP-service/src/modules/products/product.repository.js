const prisma = require('../../config/prisma');
const { isValidUuid } = require('../../shared/utils/search');

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
            'search', 'show', 'stock', 'tell', 'the', 'there', 'this', 'want', 'what', 'you',
            'need', 'like', 'looking', 'look', 'buy', 'purchase', 'order', 'orders', 'item', 'items'
        ]);
        const cleanQuery = (query || '').trim();
        const normalizedQuery = cleanQuery.toLowerCase();
        const searchTokens = normalizedQuery
            .split(/[^a-z0-9]+/)
            .filter(token => token.length > 1 && !stopWords.has(token));

        if (!cleanQuery || !searchTokens.length) {
            return [];
        }

        // Return a broad, tenant-scoped candidate set. The AI service owns
        // typo/semantic ranking, so requiring every token here would discard
        // useful alternatives such as Yellow Shampoo for "blue shampoo".
        const tokenConditions = searchTokens.flatMap(token => [
            { name: { contains: token, mode: 'insensitive' } },
            { sku: { contains: token, mode: 'insensitive' } },
            { description: { contains: token, mode: 'insensitive' } }
        ]);

        const exactConditions = [
            { sku: { equals: cleanQuery, mode: 'insensitive' } }
        ];
        if (isValidUuid(cleanQuery)) {
            exactConditions.push({ id: cleanQuery });
        }

        const whereClause = {
            tenantId,
            ...(onlyActive ? { active: true } : {}),
            OR: [
                { name: { contains: cleanQuery, mode: 'insensitive' } },
                { sku: { contains: cleanQuery, mode: 'insensitive' } },
                { description: { contains: cleanQuery, mode: 'insensitive' } },
                ...exactConditions,
                ...tokenConditions
            ]
        };

        return tx.product.findMany({
            where: whereClause,
            take: Math.min(Math.max(limit * 5, limit), 100),
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
