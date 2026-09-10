const path = require('path');
const fs = require('fs');
const pairingService = require('./pairing.service');
const connectorGateway = require('./connector.gateway');

// Path where the built Windows executable lives
const EXECUTABLE_PATH = path.resolve(__dirname, '../../../../connector/dist/tally-connector.exe');

/**
 * Generate pairing code for the authenticated/configured tenant
 */
const generatePairingCode = async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.headers['tenant-id'] || process.env.DEFAULT_TENANT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    const result = pairingService.generatePairingCode(tenantId);

    return res.status(200).json({
      success: true,
      message: 'Pairing code generated successfully. Valid for 15 minutes.',
      data: {
        pairingCode: result.code,
        expiresInSeconds: result.expiresInSeconds,
        expiresAt: result.expiresAt,
        downloadUrl: '/api/v1/connector/download/windows'
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Public endpoint called by the local connector with pairingCode
 */
const pairConnector = async (req, res) => {
  try {
    const { pairingCode } = req.body;
    if (!pairingCode) {
      return res.status(400).json({
        success: false,
        message: 'pairingCode is required'
      });
    }

    const result = pairingService.exchangePairingCode(pairingCode);

    return res.status(200).json({
      success: true,
      message: 'Connector paired successfully',
      data: {
        token: result.token,
        tenantId: result.tenantId,
        pairedAt: result.pairedAt
      }
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get current real-time status of the tenant's Tally connector
 */
const getStatus = async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.headers['tenant-id'] || process.env.DEFAULT_TENANT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    const status = connectorGateway.getConnectorStatus(tenantId);

    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Manually trigger a test or sync job through the connector
 */
const triggerSync = async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.headers['tenant-id'] || process.env.DEFAULT_TENANT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const { action = 'PING_TALLY', payload = {} } = req.body;

    const result = await connectorGateway.dispatchJob(tenantId, action, payload);

    return res.status(200).json({
      success: true,
      message: `Job ${action} completed successfully`,
      data: result
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Download the packaged Windows installer/executable
 */
const downloadWindowsConnector = (req, res) => {
  if (fs.existsSync(EXECUTABLE_PATH)) {
    res.setHeader('Content-Disposition', 'attachment; filename="DistroSync-Tally-Connector.exe"');
    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    return fs.createReadStream(EXECUTABLE_PATH).pipe(res);
  }

  // If binary not built yet, return helpful instructions
  return res.status(404).json({
    success: false,
    message: 'Connector executable not built yet. Run "npm run build:exe" in connector/ directory to generate dist/tally-connector.exe.',
    expectedPath: EXECUTABLE_PATH
  });
};

/**
 * Version metadata
 */
const getVersionInfo = (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      name: 'DistroSync Tally Connector',
      version: '1.0.0',
      platform: 'win32-x64',
      downloadUrl: '/api/v1/connector/download/windows'
    }
  });
};

module.exports = {
  generatePairingCode,
  pairConnector,
  getStatus,
  triggerSync,
  downloadWindowsConnector,
  getVersionInfo
};
