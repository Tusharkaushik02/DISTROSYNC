/**
 * Environment configuration — validates and exports required env vars.
 */

const env = {
    PORT: process.env.PORT || 4002,
    NODE_ENV: process.env.NODE_ENV || 'development',
    SERVICE_NAME: process.env.SERVICE_NAME || 'ERP-Service',

    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,

    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    SERVICE_API_KEY: process.env.SERVICE_API_KEY,

    AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    AI_SERVICE_API_KEY: process.env.AI_SERVICE_API_KEY || '',

    UPLOAD_DIR: process.env.UPLOAD_DIR || './storage/documents',
    MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB) || 10,

    get MAX_FILE_SIZE_BYTES() {
        return this.MAX_FILE_SIZE_MB * 1024 * 1024;
    },

    isDevelopment() {
        return this.NODE_ENV === 'development';
    },

    isProduction() {
        return this.NODE_ENV === 'production';
    }
};

module.exports = env;
