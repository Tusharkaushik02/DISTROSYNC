const WebSocket = require('ws');
const config = require('../config/config');
const logger = require('../utils/logger');
const jobProcessor = require('../jobs/job.processor');
const tallyClient = require('../tally/tally.client');

class ConnectionManager {
  constructor() {
    this.ws = null;
    this.status = 'DISCONNECTED';
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.isManualDisconnect = false;
  }

  getStatus() {
    return this.status;
  }

  /**
   * Connect to the DistroSync cloud gateway
   */
  connect() {
    if (!config.token) {
      logger.warn('[Connection] Cannot connect: Connector is not paired yet');
      this.status = 'UNPAIRED';
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isManualDisconnect = false;
    this.status = 'CONNECTING';

    const wsUrl = `${config.cloudWsUrl}?token=${encodeURIComponent(config.token)}`;
    logger.info(`[Connection] Connecting to cloud gateway at ${config.cloudWsUrl}...`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.handleOpen();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code, reason) => {
        this.handleClose(code, reason);
      });

      this.ws.on('error', (err) => {
        this.handleError(err);
      });

      this.ws.on('ping', () => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.pong();
        }
      });

    } catch (err) {
      logger.error(`[Connection] Failed to initialize WebSocket: ${err.message}`);
      this.scheduleReconnect();
    }
  }

  async handleOpen() {
    this.status = 'CONNECTED';
    this.reconnectAttempts = 0;
    logger.info('[Connection] Successfully connected to DistroSync Cloud Gateway');

    // Check Tally health immediately on connect
    const tallyHealth = await tallyClient.checkHealth();

    // Send READY signal
    this.send({
      type: 'CONNECTOR_READY',
      version: config.version,
      tenantId: config.tenantId,
      tallyStatus: tallyHealth.online ? 'ONLINE' : 'OFFLINE',
      companyName: tallyHealth.companyName || null
    });

    // Start periodic heartbeat
    this.startHeartbeat();
  }

  async handleMessage(data) {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'EXECUTE_JOB') {
        logger.info(`[Connection] Received job from cloud: ${msg.action} (${msg.jobId})`);
        try {
          const result = await jobProcessor.processJob(msg.action, msg.payload);
          this.send({
            type: 'JOB_RESULT',
            jobId: msg.jobId,
            success: true,
            data: result
          });
        } catch (jobErr) {
          logger.error(`[Connection] Error executing job ${msg.jobId}: ${jobErr.message}`);
          this.send({
            type: 'JOB_RESULT',
            jobId: msg.jobId,
            success: false,
            error: jobErr.message
          });
        }
      } else if (msg.type === 'GATEWAY_HELLO') {
        logger.info(`[Connection] Cloud handshake: ${msg.message}`);
      }

    } catch (err) {
      logger.error(`[Connection] Error parsing incoming message: ${err.message}`);
    }
  }

  handleClose(code, reason) {
    this.stopHeartbeat();
    this.ws = null;

    if (code === 4001 || code === 4002) {
      logger.error(`[Connection] Connection rejected by cloud (${code}): ${reason}. Re-pairing may be required.`);
      this.status = 'AUTH_ERROR';
      return;
    }

    if (!this.isManualDisconnect) {
      logger.warn(`[Connection] Disconnected from cloud (code: ${code}). Reconnecting...`);
      this.status = 'RECONNECTING';
      this.scheduleReconnect();
    } else {
      this.status = 'DISCONNECTED';
    }
  }

  handleError(err) {
    logger.error(`[Connection] WebSocket error: ${err.message}`);
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    // Exponential backoff: 2s, 4s, 8s, 16s, capped at 30s
    const delay = Math.min(
      config.reconnectMinMs * Math.pow(2, this.reconnectAttempts),
      config.reconnectMaxMs
    );

    this.reconnectAttempts++;
    logger.info(`[Connection] Scheduling reconnect attempt #${this.reconnectAttempts} in ${delay / 1000}s...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(async () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const tallyHealth = await tallyClient.checkHealth();
        this.send({
          type: 'HEARTBEAT',
          timestamp: Date.now(),
          tallyStatus: tallyHealth.online ? 'ONLINE' : 'OFFLINE',
          companyName: tallyHealth.companyName || null,
          version: config.version
        });
      }
    }, config.heartbeatIntervalMs);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  disconnect() {
    this.isManualDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.status = 'DISCONNECTED';
  }
}

const connectionManager = new ConnectionManager();
module.exports = connectionManager;
