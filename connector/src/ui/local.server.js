const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const config = require('../config/config');
const authService = require('../auth/auth.service');
const connectionManager = require('../connection/connection.manager');
const tallyClient = require('../tally/tally.client');
const logger = require('../utils/logger');

class LocalServer {
  constructor() {
    this.app = express();
    this.server = null;
  }

  setupRoutes() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));

    // Status API
    this.app.get('/api/status', async (req, res) => {
      const tallyHealth = await tallyClient.checkHealth();
      return res.json({
        paired: authService.isPaired(),
        tenantId: config.tenantId,
        cloudStatus: connectionManager.getStatus(),
        tallyOnline: tallyHealth.online,
        tallyCompany: tallyHealth.companyName || null,
        version: config.version
      });
    });

    // Pair API
    this.app.post('/api/pair', async (req, res) => {
      try {
        const { pairingCode, cloudUrl } = req.body;
        if (!pairingCode) {
          return res.status(400).json({ success: false, message: 'Pairing code is required' });
        }

        const result = await authService.pairWithCode(pairingCode, cloudUrl);
        // Immediately initiate connection
        connectionManager.connect();

        return res.json({ success: true, data: result });
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    });

    // Test Tally
    this.app.post('/api/test-tally', async (req, res) => {
      const result = await tallyClient.checkHealth();
      return res.json(result);
    });

    // Unpair API
    this.app.post('/api/unpair', (req, res) => {
      authService.unpair();
      connectionManager.disconnect();
      return res.json({ success: true, message: 'Unpaired successfully' });
    });
  }

  start() {
    this.setupRoutes();

    this.server = this.app.listen(config.localPort, () => {
      logger.info(`[Local UI] Local setup dashboard running at http://localhost:${config.localPort}`);

      // Auto-open browser if connector is not yet paired
      if (!authService.isPaired()) {
        this.openBrowser(`http://localhost:${config.localPort}`);
      }
    });

    this.server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`[Local UI] Port ${config.localPort} already in use. Local dashboard might be running in another instance.`);
      } else {
        logger.error(`[Local UI] Server error: ${err.message}`);
      }
    });
  }

  openBrowser(targetUrl) {
    try {
      if (process.platform === 'win32') {
        exec(`start "" "${targetUrl}"`);
      } else if (process.platform === 'darwin') {
        exec(`open "${targetUrl}"`);
      } else {
        exec(`xdg-open "${targetUrl}"`);
      }
    } catch (err) {
      logger.warn(`[Local UI] Could not automatically open browser: ${err.message}`);
    }
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

const localServer = new LocalServer();
module.exports = localServer;
