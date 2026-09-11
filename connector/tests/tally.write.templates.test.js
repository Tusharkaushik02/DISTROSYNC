const assert = require('assert');
const { describe, test } = require('node:test');
const {
  buildCreateSalesVoucherXml,
  buildCreateCustomerLedgerXml,
  buildCreateSupplierLedgerXml,
  buildCreateStockItemXml,
  buildCreateReceiptXml,
  buildCreateCreditNoteXml,
  buildCreatePurchaseVoucherXml
} = require('../src/tally/tally.write.templates');

describe('Tally Write Templates Tests', () => {

  const salesPayload = {
    date: '20260911',
    voucherNumber: 'DS-INV-1002',
    reference: 'ord-uuid-2',
    partyLedgerName: 'Krishna & Sons & Co',
    salesLedgerName: 'Sales Account',
    items: [
      { stockItemName: 'Basmati Rice <Grade A>', quantity: 2, unit: 'bag', rate: 450, amount: 900 }
    ],
    gst: {
      applicable: true,
      type: 'LOCAL',
      rate: 18,
      taxableAmount: 900,
      cgst: { ledgerName: 'CGST', amount: 81 },
      sgst: { ledgerName: 'SGST', amount: 81 }
    },
    narration: 'Order from WhatsApp <test & demo>'
  };

  test('should generate valid XML for sales voucher with escaped XML entities', () => {
    const xml = buildCreateSalesVoucherXml(salesPayload);

    assert.ok(xml.includes('<TALLYREQUEST>Import</TALLYREQUEST>'));
    assert.ok(xml.includes('<VOUCHER ACTION="Create" OBJVIEW="Invoice Voucher View">'));
    assert.ok(xml.includes('<VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>'));
    assert.ok(xml.includes('<VOUCHERNUMBER>DS-INV-1002</VOUCHERNUMBER>'));
    assert.ok(xml.includes('<DATE>20260911</DATE>'));

    // Escaped entities
    assert.ok(xml.includes('Krishna &amp; Sons &amp; Co'));
    assert.ok(xml.includes('Basmati Rice &lt;Grade A&gt;'));
    assert.ok(xml.includes('Order from WhatsApp &lt;test &amp; demo&gt;'));

    // Party entry (Debit = +1062.00)
    assert.ok(xml.includes('<AMOUNT>1062.00</AMOUNT>'));

    // Sales ledger (Credit = -900.00)
    assert.ok(xml.includes('<AMOUNT>-900.00</AMOUNT>'));

    // CGST and SGST entries
    assert.ok(xml.includes('<LEDGERNAME>CGST</LEDGERNAME>'));
    assert.ok(xml.includes('<AMOUNT>-81.00</AMOUNT>'));
    assert.ok(xml.includes('<LEDGERNAME>SGST</LEDGERNAME>'));

    // Inventory entry (amount negative on sales)
    assert.ok(xml.includes('<ALLINVENTORYENTRIES.LIST>'));
    assert.ok(xml.includes('<AMOUNT>-900.00</AMOUNT>'));
  });

  test('should generate customer ledger XML', () => {
    const custPayload = {
      name: 'Ravi Groceries & Provisions',
      stateName: 'Karnataka',
      gstin: '29ABCDE1234F1Z5',
      address: '123 Main St, Bengaluru',
      mobile: '9876543210',
      email: 'ravi@groceries.com',
      creditLimit: 25000
    };

    const xml = buildCreateCustomerLedgerXml(custPayload);

    assert.ok(xml.includes('<ID>All Masters</ID>'));
    assert.ok(xml.includes('<LEDGER NAME="Ravi Groceries &amp; Provisions" ACTION="Create">'));
    assert.ok(xml.includes('<PARENT>Sundry Debtors</PARENT>'));
    assert.ok(xml.includes('<STATENAME>Karnataka</STATENAME>'));
    assert.ok(xml.includes('<PARTYGSTIN>29ABCDE1234F1Z5</PARTYGSTIN>'));
    assert.ok(xml.includes('<CREDITLIMIT>25000.00</CREDITLIMIT>'));
  });

  test('should generate supplier ledger XML with Sundry Creditors parent', () => {
    const suppPayload = {
      name: 'National Mills Ltd',
      stateName: 'Punjab',
      gstin: '03ABCDE1234F1Z5'
    };

    const xml = buildCreateSupplierLedgerXml(suppPayload);

    assert.ok(xml.includes('<LEDGER NAME="National Mills Ltd" ACTION="Create">'));
    assert.ok(xml.includes('<PARENT>Sundry Creditors</PARENT>'));
  });

  test('should generate stock item XML', () => {
    const itemPayload = {
      name: 'Toor Dal 1kg',
      baseUnit: 'pkt',
      hsnCode: '0713',
      gstRate: 5,
      standardRate: 140
    };

    const xml = buildCreateStockItemXml(itemPayload);

    assert.ok(xml.includes('<STOCKITEM NAME="Toor Dal 1kg" ACTION="Create">'));
    assert.ok(xml.includes('<BASEUNITS>pkt</BASEUNITS>'));
    assert.ok(xml.includes('<HSNCODE>0713</HSNCODE>'));
    assert.ok(xml.includes('<GSTDETAILS.LIST>'));
    assert.ok(xml.includes('<RATEOFGST>5</RATEOFGST>'));
  });

  test('should generate receipt voucher XML', () => {
    const receiptPayload = {
      date: '20260911',
      voucherNumber: 'RCT-1001',
      reference: 'ord-uuid-2',
      partyLedgerName: 'Krishna & Sons',
      bankOrCashLedgerName: 'HDFC Current A/c',
      amount: 1062,
      narration: 'Payment received via UPI'
    };

    const xml = buildCreateReceiptXml(receiptPayload);

    assert.ok(xml.includes('<VOUCHER ACTION="Create" VCHTYPE="Receipt">'));
    assert.ok(xml.includes('<AMOUNT>1062.00</AMOUNT>')); // Bank Debit (+)
    assert.ok(xml.includes('<AMOUNT>-1062.00</AMOUNT>')); // Party Credit (-)
  });

  test('should generate credit note XML', () => {
    const cnPayload = {
      date: '20260911',
      voucherNumber: 'CN-1001',
      reference: 'ret-uuid-1',
      partyLedgerName: 'Krishna & Sons',
      salesLedgerName: 'Sales Returns',
      items: [
        { stockItemName: 'Rice 5kg', quantity: 1, unit: 'bag', rate: 450, amount: 450 }
      ],
      gst: { applicable: false }
    };

    const xml = buildCreateCreditNoteXml(cnPayload);

    assert.ok(xml.includes('<VOUCHER ACTION="Create" OBJVIEW="Invoice Voucher View">'));
    assert.ok(xml.includes('<VOUCHERTYPENAME>Credit Note</VOUCHERTYPENAME>'));
    assert.ok(xml.includes('<AMOUNT>-450.00</AMOUNT>')); // Party Credit (-)
    assert.ok(xml.includes('<AMOUNT>450.00</AMOUNT>')); // Sales Return Debit (+)
  });
});
