const storageService = require('./storage/storage.service');
const logger = require('./utils/logger');
const config = require('./config/config');
const authService = require('./auth/auth.service');
const connectionManager = require('./connection/connection.manager');
const localServer = require('./ui/local.server');

async function bootstrap() {
  // Initialize logger with storage directory (%APPDATA%/DistroSync/logs)
  logger.init(storageService.getBaseDir());

  console.log(`
===================================================================
      DISTROSYNC TALLY CONNECTOR v${config.version}
===================================================================
  Data Directory : ${storageService.getBaseDir()}
  Cloud Backend  : ${config.cloudUrl}
  Tally Target   : http://${config.tallyHost}:${config.tallyPort}
  Local Dashboard: http://localhost:${config.localPort}
===================================================================
  `);

  logger.info('[Bootstrap] Starting DistroSync Tally Connector...');

  // Start local web interface for pairing / status
  localServer.start();

  // If already paired with token, initiate cloud WebSocket connection
  if (authService.isPaired()) {
    logger.info(`[Bootstrap] Existing pairing found for tenant: ${config.tenantId}. Connecting to cloud...`);
    connectionManager.connect();
  } else {
    logger.info('[Bootstrap] Connector is not paired yet. Open http://localhost:' + config.localPort + ' to pair.');
  }

  // Graceful shutdown
  const shutdown = () => {
    logger.info('[Bootstrap] Shutting down connector gracefully...');
    connectionManager.disconnect();
    localServer.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  process.on('unhandledRejection', (reason) => {
    logger.error('[Bootstrap] Unhandled promise rejection:', { reason: String(reason) });
  });
}

bootstrap();
