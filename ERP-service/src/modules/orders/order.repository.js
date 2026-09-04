const prisma = require('../../config/prisma');
const { isValidUuid } = require('../../shared/utils/search');

class OrderRepository {
    async findById(id, tenantId, tx = prisma) {
        return tx.order.findFirst({
            where: {
                id,
                tenantId
            },
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        externalId: true
                    }
                },
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                sku: true,
                                name: true,
                                unit: true
                            }
                        }
                    }
                }
            }
        });
    }

    async findStatusById(id, tenantId, tx = prisma) {
        return tx.order.findFirst({
            where: {
                id,
                tenantId
            },
            select: {
                id: true,
                status: true,
                updatedAt: true
            }
        });
    }

    async create(data, tx = prisma) {
        return tx.order.create({
            data,
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        externalId: true
                    }
                },
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                sku: true,
                                name: true,
                                unit: true
                            }
                        }
                    }
                }
            }
        });
    }

    async updateStatus(id, tenantId, status, tx = prisma) {
        return tx.order.update({
            where: {
                id,
                tenantId
            },
            data: {
                status
            }
        });
    }

    async search(query, tenantId, { limit = 10, customerId = null } = {}, tx = prisma) {
        const cleanQuery = (query || '').trim();
        if (!cleanQuery) return [];

        const stopWords = new Set([
            'a', 'about', 'an', 'and', 'are', 'can', 'could', 'details', 'do', 'find',
            'for', 'get', 'have', 'i', 'information', 'is', 'me', 'my', 'of', 'order',
            'orders', 'please', 'search', 'show', 'status', 'tell', 'the', 'this', 'to',
            'want', 'what', 'where', 'which', 'you', 'need', 'like', 'looking', 'look'
        ]);
        const tokens = cleanQuery.toLowerCase()
            .split(/[^a-z0-9-]+/)
            .filter(token => token.length > 1 && !stopWords.has(token));
        if (!tokens.length) return [];

        const validStatuses = new Set([
            'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED',
            'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'
        ]);
        const tokenConditions = tokens.flatMap(token => [
            { customer: { name: { contains: token, mode: 'insensitive' } } },
            { customer: { phone: { contains: token, mode: 'insensitive' } } },
            { customer: { externalId: { contains: token, mode: 'insensitive' } } },
            { items: { some: { product: { name: { contains: token, mode: 'insensitive' } } } } },
            { items: { some: { product: { sku: { contains: token, mode: 'insensitive' } } } } }
        ].concat(validStatuses.has(token.toUpperCase()) ? [{ status: { equals: token.toUpperCase() } }] : []));

        const directConditions = [
            { customer: { name: { contains: cleanQuery, mode: 'insensitive' } } },
            { customer: { phone: { contains: cleanQuery, mode: 'insensitive' } } },
            { customer: { externalId: { contains: cleanQuery, mode: 'insensitive' } } },
            { items: { some: { product: { name: { contains: cleanQuery, mode: 'insensitive' } } } } },
            { items: { some: { product: { sku: { contains: cleanQuery, mode: 'insensitive' } } } } }
        ];
        if (isValidUuid(cleanQuery)) {
            directConditions.unshift({ id: cleanQuery });
        }
        if (validStatuses.has(cleanQuery.toUpperCase())) {
            directConditions.push({ status: { equals: cleanQuery.toUpperCase() } });
        }

        return tx.order.findMany({
            where: {
                tenantId,
                ...(customerId ? { customerId } : {}),
                OR: [...directConditions, ...tokenConditions]
            },
            take: Math.min(Math.max(limit * 5, limit), 100),
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        externalId: true
                    }
                },
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                sku: true,
                                name: true,
                                unit: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async list(tenantId, { skip = 0, take = 50, customerId = null } = {}, tx = prisma) {
        return tx.order.findMany({
            where: {
                tenantId,
                ...(customerId ? { customerId } : {})
            },
            skip,
            take,
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                },
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                sku: true,
                                name: true,
                                unit: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }
}

module.exports = new OrderRepository();
