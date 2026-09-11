const express = require('express');
const router = express.Router();
const controller = require('./connector.controller');

// Pairing endpoints
router.post('/pair-code', controller.generatePairingCode);
router.post('/pair', controller.pairConnector);

// Status & dispatch
router.get('/status', controller.getStatus);
router.post('/sync', controller.triggerSync);
router.post('/command', controller.triggerSync); // alias

// Distribution & Download
router.get('/download/windows', controller.downloadWindowsConnector);
router.get('/version', controller.getVersionInfo);

// =========================================================================
// TALLY DOMAIN ENDPOINTS
// =========================================================================

// READ — Company & Config
router.get('/tally/company', controller.getTallyCompanyInfo);
router.get('/tally/tax-ledgers', controller.getTallyTaxLedgers);

// READ — Masters
router.get('/tally/customers', controller.getTallyCustomers);
router.get('/tally/suppliers', controller.getTallySuppliers);
router.get('/tally/products', controller.getTallyProducts);
router.get('/tally/units', controller.getTallyUnits);
router.get('/tally/godowns', controller.getTallyGodowns);
router.get('/tally/ledgers', controller.getTallyLedgers);
router.get('/tally/outstanding', controller.getTallyOutstanding);
router.get('/tally/stock-balance', controller.getTallyStockBalance);
router.get('/tally/sales-orders', controller.getTallySalesOrders);

// WRITE — Masters
router.post('/tally/customer', controller.createTallyCustomer);
router.post('/tally/supplier', controller.createTallySupplier);
router.post('/tally/product', controller.createTallyProduct);

// WRITE — Transactions
router.post('/tally/invoice', controller.createTallyInvoice);
router.post('/tally/receipt', controller.createTallyReceipt);
router.post('/tally/credit-note', controller.createTallyCreditNote);
router.post('/tally/purchase', controller.createTallyPurchase);
router.post('/tally/sync-order/:orderId', controller.syncOrderToTally);

module.exports = router;
