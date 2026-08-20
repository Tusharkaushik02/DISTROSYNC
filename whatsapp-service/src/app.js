const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const app = express();
const webhookRoutes = require("./routes/webhook.router");

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(helmet());

app.use("/api/whatsapp", webhookRoutes);
app.use("/whatsapp", webhookRoutes);



module.exports = app;
