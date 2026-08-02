require('dotenv').config(); // loads user-service/.env
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');


const app = express();
const authRoutes = require('./routes/auth.route');

app.use(express.json());
app.use(cookieParser());
app.use(helmet());


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