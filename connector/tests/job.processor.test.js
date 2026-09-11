const assert = require('assert');
const { describe, test, beforeEach, afterEach } = require('node:test');
const jobProcessor = require('../src/jobs/job.processor');
const tallyClient = require('../src/tally/tally.client');
const voucherCache = require('../src/storage/voucher.cache');

describe('Job Processor Tests', () => {

  const originalMethods = {};

  beforeEach(() => {
    // Backup and mock tallyClient methods
    originalMethods.checkHealth = tallyClient.checkHealth;
    originalMethods.createSalesVoucher = tallyClient.createSalesVoucher;
    originalMethods.createCustomerLedger = tallyClient.createCustomerLedger;
    originalMethods.createStockItem = tallyClient.createStockItem;
    originalMethods.fetchCompanyInfo = tallyClient.fetchCompanyInfo;
    originalMethods.fetchStockItems = tallyClient.fetchStockItems;

    tallyClient.checkHealth = async () => ({
      online: true,
      companyName: 'Test Corp',
      host: 'localhost',
      port: 9000
    });

    tallyClient.createSalesVoucher = async (data) => ({
      success: true,
      created: 1,
      altered: 0,
      errors: 0,
      lastVchId: '101'
    });

    tallyClient.createCustomerLedger = async (data) => ({
      success: true,
      created: 1,
      altered: 0,
      errors: 0
    });

    tallyClient.createStockItem = async (data) => ({
      success: true,
      created: 1,
      altered: 0,
      errors: 0
    });

    tallyClient.fetchCompanyInfo = async () => ({
      companyName: 'Test Corp',
      formalName: 'Test Corp Pvt Ltd',
      companyState: 'Delhi',
      companyGstin: '07AAAAA0000A1Z5'
    });

    tallyClient.fetchStockItems = async () => [
      { sku: 'RICE-5KG', name: 'Rice 5kg', availableQuantity: 100, price: 450 }
    ];
  });

  afterEach(() => {
    // Restore original methods
    Object.assign(tallyClient, originalMethods);
    voucherCache.remove('job-test-ref-1');
  });

  test('should process HEALTH_CHECK action', async () => {
    const res = await jobProcessor.processJob('HEALTH_CHECK');
    assert.strictEqual(res.online, true);
    assert.strictEqual(res.companyName, 'Test Corp');
  });

  test('should process FETCH_COMPANY_INFO action', async () => {
    const res = await jobProcessor.processJob('FETCH_COMPANY_INFO');
    assert.strictEqual(res.companyName, 'Test Corp');
    assert.strictEqual(res.companyState, 'Delhi');
  });

  test('should process FETCH_INVENTORY action', async () => {
    const res = await jobProcessor.processJob('FETCH_INVENTORY');
    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.items[0].name, 'Rice 5kg');
  });

  test('should process CREATE_CUSTOMER_LEDGER action', async () => {
    const res = await jobProcessor.processJob('CREATE_CUSTOMER_LEDGER', {
      name: 'Supermart',
      stateName: 'Delhi'
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.created, 1);
    assert.strictEqual(res.ledgerName, 'Supermart');
  });

  test('should process CREATE_STOCK_ITEM action', async () => {
    const res = await jobProcessor.processJob('CREATE_STOCK_ITEM', {
      name: 'Wheat 10kg',
      baseUnit: 'bag'
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.created, 1);
    assert.strictEqual(res.itemName, 'Wheat 10kg');
  });

  test('should process CREATE_SALES_VOUCHER and deduplicate on repeat', async () => {
    const payload = {
      reference: 'job-test-ref-1',
      voucherNumber: 'DS-9001',
      date: '20260911',
      partyLedgerName: 'Acme Traders',
      salesLedgerName: 'Sales Account',
      items: [{ stockItemName: 'Rice 5kg', quantity: 1, rate: 450, amount: 450, unit: 'bag' }]
    };

    // First call -> success
    const firstRes = await jobProcessor.processJob('CREATE_SALES_VOUCHER', payload);
    assert.strictEqual(firstRes.success, true);
    assert.strictEqual(firstRes.created, 1);
    assert.strictEqual(firstRes.voucherNumber, 'DS-9001');

    // Second call with same reference -> returns cached duplicate
    const secondRes = await jobProcessor.processJob('CREATE_SALES_VOUCHER', payload);
    assert.strictEqual(secondRes.success, true);
    assert.strictEqual(secondRes.duplicate, true);
    assert.strictEqual(secondRes.tallyVoucherNumber, 'DS-9001');
  });

  test('should reject unknown action', async () => {
    await assert.rejects(async () => {
      await jobProcessor.processJob('NON_EXISTENT_ACTION');
    }, /Unknown job action/);
  });
});
