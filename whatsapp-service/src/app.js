const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const app = express();
const webhookRoutes = require("./routes/webhook.router");
const webhookPipelineRoutes = require("./whatsapp/routes/webhook.routes");

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(helmet());

// Existing v1 routes (untouched)
app.use("/api/whatsapp", webhookRoutes);
app.use("/whatsapp", webhookRoutes);

// New v2 inbound pipeline
app.use("/api/v2/whatsapp/webhook", webhookPipelineRoutes);



module.exports = app;
