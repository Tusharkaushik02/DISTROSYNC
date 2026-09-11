const assert = require('assert');
const { describe, test } = require('node:test');
const {
  validateSalesVoucherPayload,
  validateCustomerLedgerPayload,
  validateStockItemPayload,
  validateReceiptPayload,
  TallyValidationError
} = require('../src/tally/tally.validator');

describe('Tally Validator Tests', () => {

  const validSalesPayload = {
    date: '20260911',
    voucherNumber: 'DS-INV-1001',
    reference: 'ord-uuid-1',
    partyLedgerName: 'Acme Traders',
    salesLedgerName: 'Sales Account',
    items: [
      { stockItemName: 'Rice 5kg', quantity: 2, unit: 'bag', rate: 500, amount: 1000 }
    ],
    gst: {
      applicable: true,
      type: 'LOCAL',
      rate: 18,
      taxableAmount: 1000,
      cgst: { ledgerName: 'CGST', amount: 90 },
      sgst: { ledgerName: 'SGST', amount: 90 }
    }
  };

  test('should validate a valid sales voucher with local GST', () => {
    assert.doesNotThrow(() => {
      validateSalesVoucherPayload(validSalesPayload);
    });
  });

  test('should validate a valid sales voucher with interstate GST', () => {
    const interstatePayload = {
      ...validSalesPayload,
      gst: {
        applicable: true,
        type: 'INTERSTATE',
        rate: 18,
        taxableAmount: 1000,
        igst: { ledgerName: 'IGST', amount: 180 }
      }
    };
    assert.doesNotThrow(() => {
      validateSalesVoucherPayload(interstatePayload);
    });
  });

  test('should validate a valid sales voucher without GST', () => {
    const nonGstPayload = {
      ...validSalesPayload,
      gst: { applicable: false }
    };
    assert.doesNotThrow(() => {
      validateSalesVoucherPayload(nonGstPayload);
    });
  });

  test('should reject invalid date format', () => {
    const invalidDate = { ...validSalesPayload, date: '11-09-2026' };
    assert.throws(() => {
      validateSalesVoucherPayload(invalidDate);
    }, /YYYYMMDD/);
  });

  test('should reject missing party ledger name', () => {
    const missingParty = { ...validSalesPayload, partyLedgerName: '' };
    assert.throws(() => {
      validateSalesVoucherPayload(missingParty);
    }, /partyLedgerName/);
  });

  test('should reject empty items array', () => {
    const emptyItems = { ...validSalesPayload, items: [] };
    assert.throws(() => {
      validateSalesVoucherPayload(emptyItems);
    }, /items/);
  });

  test('should reject mismatched GST amount', () => {
    const mismatchedGst = {
      ...validSalesPayload,
      gst: {
        applicable: true,
        type: 'LOCAL',
        rate: 18,
        taxableAmount: 1000,
        cgst: { ledgerName: 'CGST', amount: 50 }, // expected 90
        sgst: { ledgerName: 'SGST', amount: 50 }
      }
    };
    assert.throws(() => {
      validateSalesVoucherPayload(mismatchedGst);
    }, /does not match expected tax/);
  });

  test('should validate customer ledger payload', () => {
    assert.doesNotThrow(() => {
      validateCustomerLedgerPayload({
        name: 'Apex Wholesale',
        stateName: 'Maharashtra',
        gstin: '27AAAAA0000A1Z5',
        creditLimit: 50000
      });
    });
  });

  test('should reject customer ledger without stateName', () => {
    assert.throws(() => {
      validateCustomerLedgerPayload({
        name: 'Apex Wholesale'
      });
    }, /stateName/);
  });

  test('should validate stock item payload', () => {
    assert.doesNotThrow(() => {
      validateStockItemPayload({
        name: 'Wheat Flour 10kg',
        baseUnit: 'bag',
        gstRate: 5,
        standardRate: 350
      });
    });
  });

  test('should reject stock item without baseUnit', () => {
    assert.throws(() => {
      validateStockItemPayload({
        name: 'Wheat Flour 10kg'
      });
    }, /baseUnit/);
  });

  test('should validate receipt payload', () => {
    assert.doesNotThrow(() => {
      validateReceiptPayload({
        date: '20260911',
        voucherNumber: 'RCT-001',
        partyLedgerName: 'Acme Traders',
        bankOrCashLedgerName: 'HDFC Bank',
        amount: 1180
      });
    });
  });

  test('should reject receipt with negative amount', () => {
    assert.throws(() => {
      validateReceiptPayload({
        date: '20260911',
        voucherNumber: 'RCT-001',
        partyLedgerName: 'Acme Traders',
        bankOrCashLedgerName: 'HDFC Bank',
        amount: -500
      });
    }, /positive number/);
  });
});
