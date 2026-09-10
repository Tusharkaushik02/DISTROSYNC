require('dotenv').config();
const app = require('./src/app');
const connectorGateway = require('./src/modules/connector/connector.gateway');

const startServer = async () => {
    try {
        const server = app.listen(process.env.PORT || 4002, () => {
            console.log(`${process.env.SERVICE_NAME || 'ERP-Service'} is running on port ${process.env.PORT || 4002} in ${process.env.NODE_ENV || 'development'} mode`);
        });

        // Attach WebSocket gateway to HTTP server
        connectorGateway.initialize(server);

        // Graceful shutdown
        const cleanup = async () => {
            console.log('Received kill signal, shutting down gracefully...');

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
