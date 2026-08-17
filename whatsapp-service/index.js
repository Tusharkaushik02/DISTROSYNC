require('dotenv').config(); // loads user-service/.env
const app = require('./src/app');
// const { redis } = require('./src/config/redis');

const startServer = async () => {
    try {
        const server = app.listen(process.env.PORT, () => {
            console.log(`${process.env.SERVICE_NAME} is running on port ${process.env.PORT} in ${process.env.NODE_ENV} mode`);
        });

        // Graceful shutdown
        const cleanup = async () => {
            console.log('Received kill signal, shutting down gracefully...');

            // await redis.quit();

            server.close(() => {
                console.log('Closed out remaining connections');
                process.exit(0);
            });
        };

        process.on('SIGTERM', cleanup);
        process.on('SIGINT', cleanup);

    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
};

startServer();