const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const app = express();
const authRoutes = require('./routes/auth.route');

app.use(express.json());
app.use(cookieParser());
app.use(helmet());

app.use('/auth', authRoutes);

module.exports = app;
