const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');

const { errorHandler } = require('./shared/middleware/errorHandler.middleware');

// Module routes
const customerRoutes = require('./modules/customers/customer.routes');
const productRoutes = require('./modules/products/product.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const orderRoutes = require('./modules/orders/order.routes');
const documentRoutes = require('./modules/documents/document.routes');

const app = express();

// ─── Global Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(helmet());

// Request logger
app.use((req, res, next) => {
    const tenant = req.headers['x-tenant-id'] || req.headers['tenant-id'] || 'No-Tenant';
    console.log(`[ERP Request] ${req.method} ${req.originalUrl} | Tenant: ${tenant}`);
    next();
});

// ─── Health Check ──────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            service: process.env.SERVICE_NAME || 'ERP-Service',
            status: 'healthy',
            timestamp: new Date().toISOString()
        }
    });
});

// ─── API Routes ────────────────────────────────────────────────────
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/documents', documentRoutes);

// ─── 404 Handler ───────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'ROUTE_NOT_FOUND',
            message: `Route ${req.method} ${req.originalUrl} not found`
        }
    });
});

// ─── Centralized Error Handler ─────────────────────────────────────
app.use(errorHandler);

module.exports = app;
