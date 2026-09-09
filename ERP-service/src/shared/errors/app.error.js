/**
 * Application Error hierarchy for the ERP Service.
 * Provides typed error codes and automatic HTTP status mapping.
 */

const ErrorCodes = {
    // Customer errors
    CUSTOMER_NOT_FOUND: { status: 404, message: 'Customer not found' },
    CUSTOMER_ALREADY_EXISTS: { status: 409, message: 'Customer with this phone number already exists' },

    // Product errors
    PRODUCT_NOT_FOUND: { status: 404, message: 'Product not found' },
    PRODUCT_INACTIVE: { status: 400, message: 'Product is currently inactive' },
    PRODUCT_ALREADY_EXISTS: { status: 409, message: 'Product with this SKU already exists' },

    // Inventory errors
    INSUFFICIENT_INVENTORY: { status: 400, message: 'Insufficient inventory available' },

    // Order errors
    ORDER_NOT_FOUND: { status: 404, message: 'Order not found' },
    INVALID_QUANTITY: { status: 400, message: 'Quantity must be a positive integer greater than 0' },
    EMPTY_ORDER_ITEMS: { status: 400, message: 'Order must contain at least one item' },
    INVALID_ORDER_STATUS: { status: 400, message: 'Invalid order status transition' },
    ORDER_NOT_MODIFIABLE: { status: 400, message: 'Order cannot be modified in its current status' },
    ORDER_ALREADY_CANCELLED: { status: 400, message: 'This order has already been cancelled' },
    ORDER_NOT_CANCELLABLE: { status: 400, message: 'Order cannot be cancelled in its current status' },

    // Document errors
    DOCUMENT_NOT_FOUND: { status: 404, message: 'Document not found' },
    INVALID_DOCUMENT_TYPE: { status: 400, message: 'Invalid document type. Only PDF files are supported' },
    FILE_TOO_LARGE: { status: 400, message: 'File size exceeds maximum allowed limit' },
    DOCUMENT_PROCESSING_FAILED: { status: 500, message: 'Failed to process document' },
    AI_INGESTION_FAILED: { status: 502, message: 'AI RAG ingestion service failed' },

    // Auth / Tenant errors
    UNAUTHORIZED: { status: 401, message: 'Authentication required' },
    INVALID_TOKEN: { status: 401, message: 'Invalid or expired token' },
    INVALID_SERVICE_KEY: { status: 403, message: 'Invalid service API key' },
    TENANT_REQUIRED: { status: 400, message: 'Tenant identification is required' },
    TENANT_ACCESS_DENIED: { status: 403, message: 'Access to this tenant resource is denied' },

    // General errors
    VALIDATION_ERROR: { status: 400, message: 'Request validation failed' },
    ROUTE_NOT_FOUND: { status: 404, message: 'Requested endpoint not found' },
    INTERNAL_SERVER_ERROR: { status: 500, message: 'An unexpected internal server error occurred' }
};

class AppError extends Error {
    constructor(code, customMessage = null, details = null) {
        const errorConfig = ErrorCodes[code] || ErrorCodes.INTERNAL_SERVER_ERROR;
        const message = customMessage || errorConfig.message;

        super(message);
        this.name = 'AppError';
        this.code = code in ErrorCodes ? code : 'INTERNAL_SERVER_ERROR';
        this.statusCode = errorConfig.status;
        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            ...(this.details ? { details: this.details } : {})
        };
    }
}

module.exports = {
    AppError,
    ErrorCodes
};
