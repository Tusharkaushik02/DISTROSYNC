const customerService = require('./customer.service');
const { createCustomerSchema, getCustomerByIdSchema, getCustomerByPhoneSchema, searchCustomerSchema } = require('./customer.schema');
const { successResponse } = require('../../shared/utils/response');

class CustomerController {
    async search(req, res, next) {
        try {
            const { q, limit } = searchCustomerSchema.parse(req.query);
            const customers = await customerService.searchCustomers(q, req.tenantId, { limit });
            return successResponse(res, customers);
        } catch (error) {
            next(error);
        }
    }

    async getById(req, res, next) {
        try {
            const { id } = getCustomerByIdSchema.parse(req.params);
            const customer = await customerService.getCustomerById(id, req.tenantId);
            return successResponse(res, customer);
        } catch (error) {
            next(error);
        }
    }

    async getByPhone(req, res, next) {
        try {
            const { phone } = getCustomerByPhoneSchema.parse(req.params);
            const customer = await customerService.getCustomerByPhone(phone, req.tenantId);
            return successResponse(res, customer);
        } catch (error) {
            next(error);
        }
    }

    async create(req, res, next) {
        try {
            const validatedData = createCustomerSchema.parse(req.body);
            const customer = await customerService.createCustomer(validatedData, req.tenantId);
            return successResponse(res, customer, 'Customer created successfully', 201);
        } catch (error) {
            next(error);
        }
    }

    async list(req, res, next) {
        try {
            const skip = parseInt(req.query.skip) || 0;
            const take = Math.min(parseInt(req.query.take) || 50, 100);
            const customers = await customerService.listCustomers(req.tenantId, { skip, take });
            return successResponse(res, customers);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CustomerController();
