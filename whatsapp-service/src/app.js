const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const app = express();
const webhookRoutes = require('./modules/whatsapp/presentation/routes/webhook.routes');

app.enable('trust proxy');
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(helmet());

// Inbound WhatsApp webhook pipeline
app.use('/api/v2/whatsapp/webhook', webhookRoutes);

module.exports = app;
