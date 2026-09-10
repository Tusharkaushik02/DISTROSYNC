const express = require('express');
const router = express.Router();
const controller = require('./connector.controller');

// Pairing endpoints
router.post('/pair-code', controller.generatePairingCode);
router.post('/pair', controller.pairConnector);

// Status & dispatch
router.get('/status', controller.getStatus);
router.post('/sync', controller.triggerSync);

// Distribution & Download
router.get('/download/windows', controller.downloadWindowsConnector);
router.get('/version', controller.getVersionInfo);

module.exports = router;
