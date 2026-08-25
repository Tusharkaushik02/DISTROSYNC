const prisma = require('../../config/prisma');

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
        return prisma.customer.findFirst({
            where: {
                phone,
                tenantId
            }
        });
    }

    async create(data) {
        return prisma.customer.create({
            data
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
