const customerService = require('../../src/modules/customers/customer.service');
const customerRepository = require('../../src/modules/customers/customer.repository');
const { AppError } = require('../../src/shared/errors/app.error');

// Mock repository
jest.mock('../../src/modules/customers/customer.repository');

describe('Customer Service Unit Tests', () => {
    const mockTenantA = '11111111-1111-1111-1111-111111111111';
    const mockTenantB = '22222222-2222-2222-2222-222222222222';
    const mockCustomerId = '33333333-3333-3333-3333-333333333333';

    const mockCustomer = {
        id: mockCustomerId,
        tenantId: mockTenantA,
        name: 'John Doe Wholesale',
        phone: '+919876543210',
        externalId: 'CUST-001',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getCustomerById', () => {
        it('should return customer when found for valid tenant', async () => {
            customerRepository.findById.mockResolvedValue(mockCustomer);

            const result = await customerService.getCustomerById(mockCustomerId, mockTenantA);

            expect(customerRepository.findById).toHaveBeenCalledWith(mockCustomerId, mockTenantA);
            expect(result).toEqual(mockCustomer);
        });

        it('should throw CUSTOMER_NOT_FOUND when customer does not exist', async () => {
            customerRepository.findById.mockResolvedValue(null);

            await expect(customerService.getCustomerById('non-existent', mockTenantA))
                .rejects
                .toMatchObject({
                    code: 'CUSTOMER_NOT_FOUND',
                    statusCode: 404
                });
        });

        it('should reject cross-tenant access (customer belongs to another tenant)', async () => {
            // When queried with Tenant B, repository returns null due to tenant filter
            customerRepository.findById.mockResolvedValue(null);

            await expect(customerService.getCustomerById(mockCustomerId, mockTenantB))
                .rejects
                .toMatchObject({
                    code: 'CUSTOMER_NOT_FOUND',
                    statusCode: 404
                });

            expect(customerRepository.findById).toHaveBeenCalledWith(mockCustomerId, mockTenantB);
        });
    });

    describe('getCustomerByPhone', () => {
        it('should return customer when found by phone for tenant', async () => {
            customerRepository.findByPhone.mockResolvedValue(mockCustomer);

            const result = await customerService.getCustomerByPhone('+919876543210', mockTenantA);

            expect(customerRepository.findByPhone).toHaveBeenCalledWith('+919876543210', mockTenantA);
            expect(result).toEqual(mockCustomer);
        });

        it('should throw CUSTOMER_NOT_FOUND when phone not found for tenant', async () => {
            customerRepository.findByPhone.mockResolvedValue(null);

            await expect(customerService.getCustomerByPhone('+910000000000', mockTenantA))
                .rejects
                .toMatchObject({
                    code: 'CUSTOMER_NOT_FOUND',
                    statusCode: 404
                });
        });
    });

    describe('createCustomer', () => {
        it('should create new customer successfully', async () => {
            customerRepository.findByPhone.mockResolvedValue(null);
            customerRepository.create.mockResolvedValue(mockCustomer);

            const input = {
                name: 'John Doe Wholesale',
                phone: '+919876543210',
                externalId: 'CUST-001'
            };

            const result = await customerService.createCustomer(input, mockTenantA);

            expect(customerRepository.findByPhone).toHaveBeenCalledWith('+919876543210', mockTenantA);
            expect(customerRepository.create).toHaveBeenCalledWith({
                tenantId: mockTenantA,
                name: 'John Doe Wholesale',
                phone: '+919876543210',
                externalId: 'CUST-001'
            });
            expect(result).toEqual(mockCustomer);
        });

        it('should throw CUSTOMER_ALREADY_EXISTS if phone already registered for tenant', async () => {
            customerRepository.findByPhone.mockResolvedValue(mockCustomer);

            const input = {
                name: 'Duplicate Wholesale',
                phone: '+919876543210'
            };

            await expect(customerService.createCustomer(input, mockTenantA))
                .rejects
                .toMatchObject({
                    code: 'CUSTOMER_ALREADY_EXISTS',
                    statusCode: 409
                });

            expect(customerRepository.create).not.toHaveBeenCalled();
        });
    });
});
