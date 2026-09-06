const prisma = require('../../config/prisma');
const { isValidUuid } = require('../../shared/utils/search');

class CustomerRepository {
    async findById(id, tenantId) {
        return prisma.customer.findFirst({
            where: {
                id,
                tenantId
            }
        });
    }

    async findByPhone(phone, tenantId) {
        const cleanPhone = (phone || '').trim();
        if (!cleanPhone) return null;

        const digitsOnly = cleanPhone.replace(/\D/g, '');
        const candidates = new Set([cleanPhone]);
        if (digitsOnly) {
            candidates.add(digitsOnly);
            if (digitsOnly.length === 10) {
                candidates.add(`+91${digitsOnly}`);
                candidates.add(`91${digitsOnly}`);
            } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
                candidates.add(`+${digitsOnly}`);
                candidates.add(digitsOnly.slice(2));
            }
        }

        return prisma.customer.findFirst({
            where: {
                tenantId,
                phone: {
                    in: Array.from(candidates),
                },
            },
        });
    }

    async create(data) {
        return prisma.customer.create({
            data
        });
    }

    async search(query, tenantId, { limit = 10 } = {}) {
        const cleanQuery = (query || '').trim();
        if (!cleanQuery) return [];

        const stopWords = new Set([
            'a', 'about', 'an', 'and', 'are', 'can', 'could', 'customer', 'details',
            'find', 'for', 'get', 'i', 'information', 'is', 'me', 'my', 'of', 'please',
            'search', 'show', 'tell', 'the', 'this', 'to', 'want', 'what', 'who', 'you',
            'need', 'like', 'looking', 'look'
        ]);
        const tokens = cleanQuery.toLowerCase()
            .split(/[^a-z0-9+]+/)
            .filter(token => token.length > 1 && !stopWords.has(token));
        if (!tokens.length) return [];

        const tokenConditions = tokens.flatMap(token => [
            { name: { contains: token, mode: 'insensitive' } },
            { phone: { contains: token, mode: 'insensitive' } },
            { externalId: { contains: token, mode: 'insensitive' } }
        ]);

        const exactConditions = [
            { phone: { equals: cleanQuery, mode: 'insensitive' } },
            { externalId: { equals: cleanQuery, mode: 'insensitive' } }
        ];
        if (isValidUuid(cleanQuery)) {
            exactConditions.push({ id: cleanQuery });
        }

        return prisma.customer.findMany({
            where: {
                tenantId,
                OR: [
                    { name: { contains: cleanQuery, mode: 'insensitive' } },
                    { phone: { contains: cleanQuery, mode: 'insensitive' } },
                    { externalId: { contains: cleanQuery, mode: 'insensitive' } },
                    ...exactConditions,
                    ...tokenConditions
                ]
            },
            take: Math.min(Math.max(limit * 5, limit), 100),
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async list(tenantId, { skip = 0, take = 50 } = {}) {
        return prisma.customer.findMany({
            where: {
                tenantId
            },
            skip,
            take,
            orderBy: {
                createdAt: 'desc'
            }
        });
    }
}

module.exports = new CustomerRepository();
