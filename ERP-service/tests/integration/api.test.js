const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

// Mock all services
jest.mock('../../src/modules/customers/customer.service');
jest.mock('../../src/modules/products/product.service');
jest.mock('../../src/modules/orders/order.service');
jest.mock('../../src/modules/documents/document.service');

const customerService = require('../../src/modules/customers/customer.service');
const productService = require('../../src/modules/products/product.service');
const orderService = require('../../src/modules/orders/order.service');
const documentService = require('../../src/modules/documents/document.service');

describe('ERP Service API & Auth Integration Tests', () => {
    let server;
    let baseUrl;
    const testSecret = 'test_jwt_access_secret_key_123456';
    const testServiceKey = 'test_service_key_789';
    const mockTenantId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const validOrderId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
    const validCustId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
    const validProdId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';

    beforeAll((done) => {
        process.env.JWT_ACCESS_SECRET = testSecret;
        process.env.SERVICE_API_KEY = testServiceKey;
        server = http.createServer(app);
        server.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            done();
        });
    });

    afterAll((done) => {
        server.close(done);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createToken = (payload = {}) => {
        return jwt.sign(
            {
                sub: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
                companyId: mockTenantId,
                role: 'ADMIN',
                ...payload
            },
            testSecret,
            { expiresIn: '15m' }
        );
    };

    describe('Health Check Endpoint', () => {
        it('GET /health should return 200 without authentication', async () => {
            const res = await fetch(`${baseUrl}/health`);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.status).toBe('healthy');
        });
    });

    describe('Authentication & Tenant Enforcement', () => {
        it('should reject unauthenticated request with 401', async () => {
            const res = await fetch(`${baseUrl}/api/v1/products/search?q=salt`);
            const data = await res.json();

            expect(res.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should authenticate with valid JWT Bearer token', async () => {
            const token = createToken();
            productService.searchProducts.mockResolvedValue([
                { id: 'p1', name: 'Tata Salt', sku: 'SALT-001', price: 28 }
            ]);

            const res = await fetch(`${baseUrl}/api/v1/products/search?q=salt`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(productService.searchProducts).toHaveBeenCalledWith('salt', mockTenantId, { limit: 10 });
        });

        it('should authenticate with valid Service API Key and x-tenant-id header', async () => {
            productService.searchProducts.mockResolvedValue([
                { id: 'p1', name: 'Tata Salt', sku: 'SALT-001', price: 28 }
            ]);

            const res = await fetch(`${baseUrl}/api/v1/products/search?q=salt`, {
                headers: {
                    'x-service-key': testServiceKey,
                    'x-tenant-id': mockTenantId
                }
            });
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(productService.searchProducts).toHaveBeenCalledWith('salt', mockTenantId, { limit: 10 });
        });

        it('should reject invalid service key with 403', async () => {
            const res = await fetch(`${baseUrl}/api/v1/products/search?q=salt`, {
                headers: {
                    'x-service-key': 'wrong-key',
                    'x-tenant-id': mockTenantId
                }
            });
            const data = await res.json();

            expect(res.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_SERVICE_KEY');
        });

        it('should reject service key without tenant ID with 400', async () => {
            const res = await fetch(`${baseUrl}/api/v1/products/search?q=salt`, {
                headers: {
                    'x-service-key': testServiceKey
                }
            });
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_REQUIRED');
        });
    });

    describe('Orders API Endpoint Routing', () => {
        const token = createToken();

        it('GET /api/v1/orders/:id/status should return status', async () => {
            orderService.getOrderStatus.mockResolvedValue({
                orderId: validOrderId,
                status: 'CONFIRMED',
                updatedAt: new Date().toISOString()
            });

            const res = await fetch(`${baseUrl}/api/v1/orders/${validOrderId}/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.status).toBe('CONFIRMED');
        });

        it('POST /api/v1/orders should create order', async () => {
            orderService.createOrder.mockResolvedValue({
                id: validOrderId,
                status: 'CONFIRMED',
                totalAmount: 500
            });

            const res = await fetch(`${baseUrl}/api/v1/orders`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    customerId: validCustId,
                    items: [{ productId: validProdId, quantity: 5 }]
                })
            });
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.data.totalAmount).toBe(500);
        });

        it('POST /api/v1/orders should validate bad payload and return 400', async () => {
            const res = await fetch(`${baseUrl}/api/v1/orders`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    customerId: 'invalid-not-uuid',
                    items: []
                })
            });
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('404 Route Handling', () => {
        it('should return 404 with standard error structure for unknown routes', async () => {
            const res = await fetch(`${baseUrl}/api/v1/unknown-endpoint`);
            const data = await res.json();

            expect(res.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('ROUTE_NOT_FOUND');
        });
    });
});
