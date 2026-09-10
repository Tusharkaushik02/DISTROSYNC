require('dotenv').config();
const storageService = require('../storage/storage.service');

const stored = storageService.loadConfig();

const config = {
  // Cloud backend settings
  cloudUrl: process.env.DISTROSYNC_CLOUD_URL || stored.cloudUrl || 'http://localhost:4002',
  cloudWsUrl: process.env.DISTROSYNC_WS_URL || stored.cloudWsUrl || 'ws://localhost:4002/ws/connector',

  // Authentication & Pairing
  token: process.env.DISTROSYNC_TOKEN || stored.token || null,
  tenantId: process.env.DISTROSYNC_TENANT_ID || stored.tenantId || null,
  pairedAt: stored.pairedAt || null,

  // Local TallyPrime XML Server settings
  tallyHost: process.env.TALLY_HOST || stored.tallyHost || '127.0.0.1',
  tallyPort: parseInt(process.env.TALLY_PORT || stored.tallyPort || '9000', 10),
  tallyTimeoutMs: parseInt(process.env.TALLY_TIMEOUT_MS || '15000', 10),

  // Local Web Setup UI
  localPort: parseInt(process.env.LOCAL_PORT || stored.localPort || '9123', 10),

  // Heartbeat & Reconnect
  heartbeatIntervalMs: 30000,
  reconnectMinMs: 2000,
  reconnectMaxMs: 30000,

  // Metadata
  version: '1.0.0',
  name: 'DistroSync Tally Connector'
};

module.exports = config;
