const customerRepository = require('./customer.repository');
const { AppError } = require('../../shared/errors/app.error');

class CustomerService {
    async getCustomerById(id, tenantId) {
        const customer = await customerRepository.findById(id, tenantId);
        if (!customer) {
            throw new AppError('CUSTOMER_NOT_FOUND', `Customer with id ${id} not found`);
        }
        return customer;
    }

    async getCustomerByPhone(phone, tenantId) {
        // Clean phone number (strip spaces/dashes if any)
        const cleanPhone = phone.trim();
        const customer = await customerRepository.findByPhone(cleanPhone, tenantId);
        if (!customer) {
            throw new AppError('CUSTOMER_NOT_FOUND', `Customer with phone ${cleanPhone} not found`);
        }
        console.log(`[ERP Customer] 👤 Found customer "${customer.name}" (ID: ${customer.id}) for phone: ${cleanPhone}`);
        return customer;
    }

    async createCustomer(data, tenantId) {
        const cleanPhone = data.phone.trim();
        const cleanName = data.name.trim();
        console.log(`[ERP Customer] ➕ Creating customer "${cleanName}" (${cleanPhone}) | Tenant: ${tenantId}`);

        // Check if customer with this phone exists in tenant
        const existing = await customerRepository.findByPhone(cleanPhone, tenantId);
        if (existing) {
            throw new AppError('CUSTOMER_ALREADY_EXISTS', `Customer with phone ${cleanPhone} already exists for this tenant`);
        }

        return customerRepository.create({
            tenantId,
            name: cleanName,
            phone: cleanPhone,
            externalId: data.externalId ? data.externalId.trim() : null
        });
    }

    async searchCustomers(query, tenantId, { limit = 10 } = {}) {
        const cleanQuery = (query || '').trim();
        if (!cleanQuery) return [];
        return customerRepository.search(cleanQuery, tenantId, { limit });
    }

    async listCustomers(tenantId, options) {
        return customerRepository.list(tenantId, options);
    }
}

module.exports = new CustomerService();
