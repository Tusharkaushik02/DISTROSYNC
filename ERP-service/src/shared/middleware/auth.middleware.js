const jwt = require('jsonwebtoken');
const { AppError } = require('../errors/app.error');

/**
 * Authentication and Multi-Tenant Context Middleware.
 * Supports:
 * 1. User JWT Auth (Bearer token signed with JWT_ACCESS_SECRET)
 * 2. Trusted Internal Service-to-Service Auth (x-service-key header + x-tenant-id)
 */
function authMiddleware(req, res, next) {
    try {
        // ── 1. Check Service-to-Service Key First ───────────────────────
        const serviceKey = req.headers['x-service-key'] || req.headers['service-key'];
        const tenantHeader = req.headers['x-tenant-id'] || req.headers['tenant-id'];

        if (serviceKey) {
            const configuredKey = process.env.SERVICE_API_KEY;
            if (!configuredKey || serviceKey !== configuredKey) {
                throw new AppError('INVALID_SERVICE_KEY', 'Invalid service API key');
            }

            if (!tenantHeader) {
                throw new AppError('TENANT_REQUIRED', 'x-tenant-id header is required for service calls');
            }

            req.isService = true;
            req.tenantId = tenantHeader;
            return next();
        }

        // ── 2. Check JWT User Token ────────────────────────────────────
        const token =
            req.cookies?.token ||
            req.cookies?.accessToken ||
            (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
                ? req.headers.authorization.split(' ')[1]
                : null);

        if (!token) {
            throw new AppError('UNAUTHORIZED', 'Authentication token or service key required');
        }

        const secret = process.env.JWT_ACCESS_SECRET;
        if (!secret) {
            console.error('[AuthMiddleware] JWT_ACCESS_SECRET not configured');
            throw new AppError('INTERNAL_SERVER_ERROR', 'Authentication configuration error');
        }

        let decoded;
        try {
            decoded = jwt.verify(token, secret);
        } catch (jwtErr) {
            throw new AppError('INVALID_TOKEN', 'Invalid or expired access token');
        }

        const userId = decoded.sub || decoded.id;
        const tenantId = decoded.companyId || decoded.tenantId || tenantHeader;

        if (!tenantId) {
            throw new AppError('TENANT_REQUIRED', 'Tenant/Company context is missing from token and request');
        }

        req.user = {
            id: userId,
            role: decoded.role || 'ADMIN',
            companyId: tenantId
        };
        req.tenantId = tenantId;
        req.isService = false;

        return next();
    } catch (error) {
        next(error);
    }
}

/**
 * Ensures req.tenantId is present on the request
 */
function requireTenant(req, res, next) {
    if (!req.tenantId) {
        return next(new AppError('TENANT_REQUIRED', 'Tenant identifier is required'));
    }
    next();
}

module.exports = {
    authMiddleware,
    requireTenant
};
