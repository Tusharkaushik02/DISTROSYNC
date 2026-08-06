const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const app = express();
const authRoutes = require('./routes/auth.route');
const companyRoutes = require('./routes/company.route');
const erpRoutes = require('./routes/erp.route');
const whatsappRoutes = require('./routes/whatsapp.route');

app.use(express.json());
app.use(cookieParser());
app.use(helmet());

app.use('/auth', authRoutes);
app.use('/companies', companyRoutes);
app.use('/erp', erpRoutes);
app.use('/whatsapp', whatsappRoutes);

module.exports = app;
