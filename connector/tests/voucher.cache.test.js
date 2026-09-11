const assert = require('assert');
const { describe, test, afterEach } = require('node:test');
const voucherCache = require('../src/storage/voucher.cache');

describe('Voucher Cache Tests', () => {

  const testRef = 'test-order-uuid-9999';
  const testVoucherNum = 'DS-INV-9999';

  afterEach(() => {
    voucherCache.remove(testRef);
  });

  test('should initially report reference not sent', () => {
    assert.strictEqual(voucherCache.hasSent(testRef), false);
    assert.strictEqual(voucherCache.getStatus(testRef), null);
  });

  test('should mark reference as sent and retrieve status', () => {
    voucherCache.markSent(testRef, testVoucherNum, 'CREATE_SALES_VOUCHER');

    assert.strictEqual(voucherCache.hasSent(testRef), true);
    const status = voucherCache.getStatus(testRef);
    assert.ok(status);
    assert.strictEqual(status.tallyVoucherNumber, testVoucherNum);
    assert.strictEqual(status.action, 'CREATE_SALES_VOUCHER');
    assert.ok(status.sentAt);
  });

  test('should remove cached reference', () => {
    voucherCache.markSent(testRef, testVoucherNum, 'CREATE_SALES_VOUCHER');
    assert.strictEqual(voucherCache.hasSent(testRef), true);

    voucherCache.remove(testRef);
    assert.strictEqual(voucherCache.hasSent(testRef), false);
  });
});
