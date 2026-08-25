const prisma = require('../../config/prisma');

class DocumentRepository {
    async findById(id, tenantId) {
        return prisma.document.findFirst({
            where: {
                id,
                tenantId
            }
        });
    }

    async create(data) {
        return prisma.document.create({
            data
        });
    }

    async update(id, tenantId, data) {
        return prisma.document.updateMany({
            where: {
                id,
                tenantId
            },
            data
        });
    }

    async list(tenantId, { skip = 0, take = 50 } = {}) {
        return prisma.document.findMany({
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

module.exports = new DocumentRepository();
