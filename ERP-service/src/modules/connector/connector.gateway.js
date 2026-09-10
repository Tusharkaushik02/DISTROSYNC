const { WebSocketServer, WebSocket } = require('ws');
const url = require('url');
const { verifyConnectorToken } = require('./pairing.service');

class ConnectorGateway {
  constructor() {
    this.wss = null;
    // Map: tenantId -> { ws, metadata, lastSeen }
    this.activeConnectors = new Map();
    // Map: jobId -> { resolve, reject, timer }
    this.pendingJobs = new Map();
  }

  /**
   * Initialize and attach WebSocket server to existing HTTP server
   */
  initialize(httpServer) {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws/connector'
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Run periodic liveness check every 30 seconds
    setInterval(() => {
      this.checkHeartbeats();
    }, 30000);

    console.log('[Connector Gateway] WebSocket server initialized on path /ws/connector');
  }

  handleConnection(ws, req) {
    try {
      const parsedUrl = url.parse(req.url, true);
      const token = parsedUrl.query.token || req.headers['sec-websocket-protocol'];

      if (!token) {
        console.warn('[Connector Gateway] Connection rejected: Missing token');
        ws.close(4001, 'Authentication token required');
        return;
      }

      const decoded = verifyConnectorToken(token);
      const tenantId = decoded.tenantId;

      ws.tenantId = tenantId;
      ws.isAlive = true;
      ws.connectedAt = new Date();

      // Store active connection
      this.activeConnectors.set(tenantId, {
        ws,
        tenantId,
        connectedAt: ws.connectedAt,
        lastSeen: new Date(),
        tallyStatus: 'UNKNOWN',
        companyName: null,
        version: null
      });

      console.log(`[Connector Gateway] Connector connected for tenant: ${tenantId}`);

      // Send initial welcome & config request
      this.sendMessage(ws, {
        type: 'GATEWAY_HELLO',
        message: 'Connected to DistroSync Cloud Gateway',
        timestamp: new Date().toISOString()
      });

      ws.on('pong', () => {
        ws.isAlive = true;
        const entry = this.activeConnectors.get(tenantId);
        if (entry) {
          entry.lastSeen = new Date();
        }
      });

      ws.on('message', (data) => {
        this.handleMessage(ws, tenantId, data);
      });

      ws.on('close', (code, reason) => {
        console.log(`[Connector Gateway] Connector disconnected for tenant: ${tenantId} (${code})`);
        this.activeConnectors.delete(tenantId);
      });

      ws.on('error', (err) => {
        console.error(`[Connector Gateway] Socket error for tenant ${tenantId}:`, err.message);
      });

    } catch (err) {
      console.warn(`[Connector Gateway] Auth failed on connection: ${err.message}`);
      ws.close(4002, `Authentication failed: ${err.message}`);
    }
  }

  handleMessage(ws, tenantId, rawData) {
    try {
      const message = JSON.parse(rawData.toString());
      const entry = this.activeConnectors.get(tenantId);
      if (entry) {
        entry.lastSeen = new Date();
      }

      switch (message.type) {
        case 'HEARTBEAT':
          if (entry) {
            entry.tallyStatus = message.tallyStatus || entry.tallyStatus;
            entry.companyName = message.companyName || entry.companyName;
            entry.version = message.version || entry.version;
          }
          this.sendMessage(ws, { type: 'HEARTBEAT_ACK', timestamp: Date.now() });
          break;

        case 'CONNECTOR_READY':
          if (entry) {
            entry.tallyStatus = message.tallyStatus || 'ONLINE';
            entry.companyName = message.companyName || null;
            entry.version = message.version || '1.0.0';
          }
          console.log(`[Connector Gateway] Ready signal from tenant ${tenantId}. Tally Status: ${entry?.tallyStatus}, Company: ${entry?.companyName}`);
          break;

        case 'JOB_RESULT':
          this.handleJobResult(message);
          break;

        default:
          console.log(`[Connector Gateway] Received message type ${message.type} from tenant ${tenantId}`);
      }
    } catch (err) {
      console.error(`[Connector Gateway] Failed to parse message from tenant ${tenantId}:`, err.message);
    }
  }

  handleJobResult(message) {
    const { jobId, success, data, error } = message;
    if (!jobId) return;

    const pending = this.pendingJobs.get(jobId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingJobs.delete(jobId);

      if (success) {
        pending.resolve(data);
      } else {
        pending.reject(new Error(error || 'Job failed on connector'));
      }
    }
  }

  /**
   * Dispatch a job/command to a tenant's local connector
   */
  async dispatchJob(tenantId, action, payload = {}, timeoutMs = 30000) {
    const entry = this.activeConnectors.get(tenantId);
    if (!entry || entry.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Connector is offline for tenant ${tenantId}`);
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingJobs.delete(jobId);
        reject(new Error(`Job ${jobId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingJobs.set(jobId, { resolve, reject, timer });

      this.sendMessage(entry.ws, {
        type: 'EXECUTE_JOB',
        jobId,
        action,
        payload,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Get connector connection status for a tenant
   */
  getConnectorStatus(tenantId) {
    const entry = this.activeConnectors.get(tenantId);
    if (!entry || entry.ws.readyState !== WebSocket.OPEN) {
      return {
        online: false,
        status: 'DISCONNECTED',
        lastSeen: entry?.lastSeen || null,
        tallyStatus: 'OFFLINE',
        companyName: null,
        version: null
      };
    }

    return {
      online: true,
      status: 'CONNECTED',
      connectedAt: entry.connectedAt,
      lastSeen: entry.lastSeen,
      tallyStatus: entry.tallyStatus,
      companyName: entry.companyName,
      version: entry.version
    };
  }

  sendMessage(ws, obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  checkHeartbeats() {
    for (const [tenantId, entry] of this.activeConnectors.entries()) {
      if (!entry.ws.isAlive) {
        console.warn(`[Connector Gateway] Terminating dead connection for tenant: ${tenantId}`);
        entry.ws.terminate();
        this.activeConnectors.delete(tenantId);
        continue;
      }
      entry.ws.isAlive = false;
      entry.ws.ping();
    }
  }
}

// Singleton instance
const gatewayInstance = new ConnectorGateway();
module.exports = gatewayInstance;
