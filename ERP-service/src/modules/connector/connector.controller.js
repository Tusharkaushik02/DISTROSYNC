const path = require('path');
const fs = require('fs');
const pairingService = require('./pairing.service');
const connectorGateway = require('./connector.gateway');
const tallyService = require('./tally.service');

// Path where the built Windows executable lives
const EXECUTABLE_PATH = path.resolve(__dirname, '../../../../connector/dist/tally-connector.exe');

// Helper: extract tenantId from request headers
function getTenantId(req) {
  return req.headers['x-tenant-id'] || req.headers['tenant-id'] ||
    process.env.DEFAULT_TENANT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
}

// =========================================================================
// EXISTING ENDPOINTS (unchanged)
// =========================================================================

/**
 * Generate pairing code for the authenticated/configured tenant
 */
const generatePairingCode = async (req, res) => {
  try {
    const tenantId = getTenantId(req);

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
    const tenantId = getTenantId(req);

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
    const tenantId = getTenantId(req);
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

// =========================================================================
// TALLY DOMAIN ENDPOINTS — READ
// =========================================================================

const getTallyCompanyInfo = async (req, res) => {
  try {
    const data = await tallyService.getCompanyInfo(getTenantId(req));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const getTallyTaxLedgers = async (req, res) => {
  try {
    const data = await tallyService.getTaxLedgers(getTenantId(req));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const getTallyCustomers = async (req, res) => {
  try {
    const data = await tallyService.listCustomers(getTenantId(req));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const getTallySuppliers = async (req, res) => {
  try {
    const data = await tallyService.listSuppliers(getTenantId(req));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const getTallyProducts = async (req, res) => {
  try {
    const data = await tallyService.listProducts(getTenantId(req));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const getTallyUnits = async (req, res) => {
  try {
    const data = await tallyService.listUnits(getTenantId(req));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const getTallyGodowns = async (req, res) => {
  try {
    const data = await tallyService.listGodowns(getTenantId(req));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const getTallyLedgers = async (req, res) => {
  try {
    const group = req.query.group || '';
    const data = await tallyService.listLedgers(getTenantId(req), group);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const getTallyOutstanding = async (req, res) => {
  try {
    const partyName = req.query.party;
    if (!partyName) {
      return res.status(400).json({ success: false, message: '"party" query param is required' });
    }
    const data = await tallyService.getLedgerOutstanding(getTenantId(req), partyName);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const getTallyStockBalance = async (req, res) => {
  try {
    const itemName = req.query.item;
    if (!itemName) {
      return res.status(400).json({ success: false, message: '"item" query param is required' });
    }
    const data = await tallyService.getStockBalance(getTenantId(req), itemName);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const getTallySalesOrders = async (req, res) => {
  try {
    const data = await tallyService.listSalesOrders(getTenantId(req));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

// =========================================================================
// TALLY DOMAIN ENDPOINTS — WRITE (Masters)
// =========================================================================

const createTallyCustomer = async (req, res) => {
  try {
    const data = await tallyService.createCustomer(getTenantId(req), req.body);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const createTallySupplier = async (req, res) => {
  try {
    const data = await tallyService.createSupplier(getTenantId(req), req.body);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const createTallyProduct = async (req, res) => {
  try {
    const data = await tallyService.createStockItem(getTenantId(req), req.body);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

// =========================================================================
// TALLY DOMAIN ENDPOINTS — WRITE (Transactions)
// =========================================================================

const createTallyInvoice = async (req, res) => {
  try {
    const data = await tallyService.createSalesInvoice(getTenantId(req), req.body);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const createTallyReceipt = async (req, res) => {
  try {
    const data = await tallyService.createReceipt(getTenantId(req), req.body);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const createTallyCreditNote = async (req, res) => {
  try {
    const data = await tallyService.createCreditNote(getTenantId(req), req.body);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const createTallyPurchase = async (req, res) => {
  try {
    const data = await tallyService.createPurchaseInvoice(getTenantId(req), req.body);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

const syncOrderToTally = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { orderId } = req.params;
    const orderService = require('../orders/order.service');
    const order = await orderService.getOrderById(orderId, tenantId);
    if (!order) {
      return res.status(404).json({ success: false, message: `Order ${orderId} not found` });
    }
    const result = await tallyService.pushOrderToTally(tenantId, order, req.body || {});
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
};

module.exports = {
  // Existing
  generatePairingCode,
  pairConnector,
  getStatus,
  triggerSync,
  downloadWindowsConnector,
  getVersionInfo,
  // Tally READ
  getTallyCompanyInfo,
  getTallyTaxLedgers,
  getTallyCustomers,
  getTallySuppliers,
  getTallyProducts,
  getTallyUnits,
  getTallyGodowns,
  getTallyLedgers,
  getTallyOutstanding,
  getTallyStockBalance,
  getTallySalesOrders,
  // Tally WRITE — Masters
  createTallyCustomer,
  createTallySupplier,
  createTallyProduct,
  // Tally WRITE — Transactions
  createTallyInvoice,
  createTallyReceipt,
  createTallyCreditNote,
  createTallyPurchase,
  syncOrderToTally
};
