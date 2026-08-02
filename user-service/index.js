require('dotenv').config(); // loads user-service/.env
const app = require('./src/app');

const startServer = async () => {
    try {
        app.listen(process.env.PORT, () => {
            console.log(`${process.env.SERVICE_NAME} is running on port ${process.env.PORT} in ${process.env.NODE_ENV} mode`);
        });
    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
};

startServer();