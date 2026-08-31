const prisma = require('../../config/prisma');

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
