/**
 * TDL XML builder functions for IMPORT (write) operations.
 *
 * Design rules:
 *  - Each function accepts a validated plain-JS object and returns a raw XML string.
 *  - Callers MUST validate with tally.validator.js BEFORE calling these functions.
 *  - All amounts follow Tally sign convention:
 *      Positive  → Debit  (money COMING IN to the account)
 *      Negative  → Credit (money GOING OUT of the account)
 *  - The sum of every ALLLEDGERENTRIES.LIST amount MUST equal 0.
 *  - Inventory entry amounts are NEGATIVE on sales (stock going out).
 */

const { validateSalesVoucherPayload, validateCustomerLedgerPayload, validateStockItemPayload, validateReceiptPayload } = require('./tally.validator');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape XML special characters in a string value.
 */
function xmlEscape(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Round a number to 2 decimal places.
 */
function r2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Wrap a single TALLYMESSAGE in the standard Import envelope.
 *
 * @param {string} messageXml - Inner XML content of <TALLYMESSAGE>
 * @param {string} importId   - "All Masters" | "Vouchers"
 * @param {string} [companyName] - Optional <SVCURRENTCOMPANY>
 */
function wrapImportEnvelope(messageXml, importId = 'Vouchers', companyName = '') {
  const companyTag = companyName
    ? `<SVCURRENTCOMPANY>${xmlEscape(companyName)}</SVCURRENTCOMPANY>`
    : '';

  return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>${importId}</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <IMPORTDUPS>@@DUPCOMBINE</IMPORTDUPS>
        ${companyTag}
      </STATICVARIABLES>
    </DESC>
    <DATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        ${messageXml}
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>`.trim();
}

// ---------------------------------------------------------------------------
// SALES VOUCHER
// ---------------------------------------------------------------------------

/**
 * Build the XML payload to create a Sales Invoice (with optional GST) in Tally.
 *
 * @param {object} data - See tally.validator.validateSalesVoucherPayload for schema
 * @returns {string} XML string ready to POST to Tally :9000
 *
 * Ledger balance rule (must sum to zero):
 *   Party ledger       + totalInvoiceAmount     (Debit, positive)
 *   Sales ledger       - taxableAmount          (Credit, negative)
 *   CGST ledger        - cgstAmount             (Credit, negative)   [LOCAL only]
 *   SGST ledger        - sgstAmount             (Credit, negative)   [LOCAL only]
 *   IGST ledger        - igstAmount             (Credit, negative)   [INTERSTATE only]
 */
function buildCreateSalesVoucherXml(data) {
  validateSalesVoucherPayload(data);

  const {
    date,
    voucherNumber,
    reference,
    partyLedgerName,
    salesLedgerName,
    items,
    gst,
    narration = '',
    godownName = null,
    voucherTypeName = 'Sales'
  } = data;

  // Compute totals
  const taxableAmount = r2(items.reduce((s, i) => s + Number(i.amount), 0));
  let totalTax = 0;
  let taxEntries = '';

  if (gst && gst.applicable && gst.rate > 0) {
    if (gst.type === 'LOCAL') {
      const cgst = r2(gst.cgst.amount);
      const sgst = r2(gst.sgst.amount);
      totalTax = r2(cgst + sgst);
      taxEntries = `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape(gst.cgst.ledgerName)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>-${cgst.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape(gst.sgst.ledgerName)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>-${sgst.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;
    } else {
      // INTERSTATE
      const igst = r2(gst.igst.amount);
      totalTax = igst;
      taxEntries = `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape(gst.igst.ledgerName)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>-${igst.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;
    }
  }

  const totalInvoiceAmount = r2(taxableAmount + totalTax);

  // Build inventory entries
  const inventoryXml = items.map(item => {
    const godownXml = godownName
      ? `<BATCHALLOCATIONS.LIST>
          <GODOWNNAME>${xmlEscape(godownName)}</GODOWNNAME>
          <BATCHNAME>Primary Batch</BATCHNAME>
          <AMOUNT>-${r2(item.amount).toFixed(2)}</AMOUNT>
          <ACTUALQTY>${r2(item.quantity)} ${xmlEscape(item.unit)}</ACTUALQTY>
          <BILLEDQTY>${r2(item.quantity)} ${xmlEscape(item.unit)}</BILLEDQTY>
        </BATCHALLOCATIONS.LIST>`
      : '';

    return `<ALLINVENTORYENTRIES.LIST>
          <STOCKITEMNAME>${xmlEscape(item.stockItemName)}</STOCKITEMNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <RATE>${r2(item.rate).toFixed(2)}/${xmlEscape(item.unit)}</RATE>
          <AMOUNT>-${r2(item.amount).toFixed(2)}</AMOUNT>
          <ACTUALQTY>${r2(item.quantity)} ${xmlEscape(item.unit)}</ACTUALQTY>
          <BILLEDQTY>${r2(item.quantity)} ${xmlEscape(item.unit)}</BILLEDQTY>
          ${godownXml}
        </ALLINVENTORYENTRIES.LIST>`;
  }).join('\n');

  const voucherXml = `<VOUCHER ACTION="Create" OBJVIEW="Invoice Voucher View">
      <DATE>${date}</DATE>
      <VOUCHERTYPENAME>${xmlEscape(voucherTypeName)}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${xmlEscape(voucherNumber)}</VOUCHERNUMBER>
      <REFERENCE>${xmlEscape(reference || voucherNumber)}</REFERENCE>
      <PARTYLEDGERNAME>${xmlEscape(partyLedgerName)}</PARTYLEDGERNAME>
      <ISINVOICE>Yes</ISINVOICE>
      <NARRATION>${xmlEscape(narration)}</NARRATION>

      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${xmlEscape(partyLedgerName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${totalInvoiceAmount.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>

      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${xmlEscape(salesLedgerName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${taxableAmount.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      ${taxEntries}

      ${inventoryXml}
    </VOUCHER>`;

  return wrapImportEnvelope(voucherXml, 'Vouchers');
}

// ---------------------------------------------------------------------------
// CUSTOMER LEDGER (Master)
// ---------------------------------------------------------------------------

/**
 * Build XML to create a Customer ledger (Sundry Debtors) in Tally.
 *
 * @param {object} data
 * @param {string}  data.name         - Ledger name (unique in Tally)
 * @param {string}  data.stateName    - Indian state name for GST
 * @param {string}  [data.gstin]      - Customer GSTIN
 * @param {string}  [data.address]    - Billing address
 * @param {string}  [data.mobile]     - Mobile number
 * @param {string}  [data.email]      - Email address
 * @param {number}  [data.creditLimit]- Credit limit in INR
 * @param {string}  [data.parent]     - Tally group (default: Sundry Debtors)
 */
function buildCreateCustomerLedgerXml(data) {
  validateCustomerLedgerPayload(data);

  const {
    name,
    stateName,
    gstin = '',
    address = '',
    mobile = '',
    email = '',
    creditLimit = 0,
    parent = 'Sundry Debtors'
  } = data;

  const gstinTag = gstin
    ? `<PARTYGSTIN>${xmlEscape(gstin)}</PARTYGSTIN>
         <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>`
    : `<GSTREGISTRATIONTYPE>Unregistered</GSTREGISTRATIONTYPE>`;

  const creditTag = creditLimit > 0
    ? `<ISBILLWISEON>Yes</ISBILLWISEON>
         <CREDITLIMIT>${r2(creditLimit).toFixed(2)}</CREDITLIMIT>`
    : '';

  const ledgerXml = `<LEDGER NAME="${xmlEscape(name)}" ACTION="Create">
      <NAME>${xmlEscape(name)}</NAME>
      <PARENT>${xmlEscape(parent)}</PARENT>
      <STATENAME>${xmlEscape(stateName)}</STATENAME>
      ${gstinTag}
      <ADDRESS>${xmlEscape(address)}</ADDRESS>
      <LEDGERMOBILE>${xmlEscape(mobile)}</LEDGERMOBILE>
      <EMAIL>${xmlEscape(email)}</EMAIL>
      ${creditTag}
      <OPENINGBALANCE>0</OPENINGBALANCE>
    </LEDGER>`;

  return wrapImportEnvelope(ledgerXml, 'All Masters');
}

// ---------------------------------------------------------------------------
// SUPPLIER LEDGER (Master)
// ---------------------------------------------------------------------------

/**
 * Build XML to create a Supplier ledger (Sundry Creditors) in Tally.
 *
 * @param {object} data - Same shape as customer, parent defaults to Sundry Creditors
 */
function buildCreateSupplierLedgerXml(data) {
  return buildCreateCustomerLedgerXml({
    ...data,
    parent: data.parent || 'Sundry Creditors'
  });
}

// ---------------------------------------------------------------------------
// STOCK ITEM (Master)
// ---------------------------------------------------------------------------

/**
 * Build XML to create a Stock Item in Tally.
 *
 * @param {object} data
 * @param {string}  data.name         - Stock item name (unique)
 * @param {string}  data.baseUnit     - Unit of measure (e.g. "nos", "kg", "box")
 * @param {string}  [data.parent]     - Stock Group (default: "Primary")
 * @param {string}  [data.hsnCode]    - HSN / SAC code for GST
 * @param {number}  [data.gstRate]    - GST rate % (0, 5, 12, 18, 28)
 * @param {number}  [data.standardRate] - Standard selling rate
 */
function buildCreateStockItemXml(data) {
  validateStockItemPayload(data);

  const {
    name,
    baseUnit,
    parent = 'Primary',
    hsnCode = '',
    gstRate = 0,
    standardRate = 0
  } = data;

  const hsnTag = hsnCode
    ? `<HSNDETAILS.LIST>
          <HSNCODE>${xmlEscape(hsnCode)}</HSNCODE>
          <HSNMASTERNAME>${xmlEscape(name)}</HSNMASTERNAME>
        </HSNDETAILS.LIST>`
    : '';

  const gstTag = gstRate > 0
    ? `<GSTDETAILS.LIST>
          <RATEOFGST>${gstRate}</RATEOFGST>
          <TAXABILITYNATURE>Taxable</TAXABILITYNATURE>
        </GSTDETAILS.LIST>`
    : '';

  const stdRateTag = standardRate > 0
    ? `<STANDARDCOSTLIST.LIST>
          <DATE>20200401</DATE>
          <RATE>${r2(standardRate).toFixed(2)}/${xmlEscape(baseUnit)}</RATE>
        </STANDARDCOSTLIST.LIST>`
    : '';

  const stockItemXml = `<STOCKITEM NAME="${xmlEscape(name)}" ACTION="Create">
      <NAME>${xmlEscape(name)}</NAME>
      <PARENT>${xmlEscape(parent)}</PARENT>
      <BASEUNITS>${xmlEscape(baseUnit)}</BASEUNITS>
      <GSTAPPLICABLE>@@APPLICABLE</GSTAPPLICABLE>
      ${hsnTag}
      ${gstTag}
      ${stdRateTag}
    </STOCKITEM>`;

  return wrapImportEnvelope(stockItemXml, 'All Masters');
}

// ---------------------------------------------------------------------------
// RECEIPT VOUCHER
// ---------------------------------------------------------------------------

/**
 * Build XML to record a receipt (customer payment received).
 *
 * @param {object} data
 * @param {string}  data.date               - YYYYMMDD
 * @param {string}  data.voucherNumber      - Receipt number
 * @param {string}  [data.reference]        - ERP payment/order UUID
 * @param {string}  data.partyLedgerName    - Customer ledger
 * @param {string}  data.bankOrCashLedgerName - "Cash" or bank account ledger name
 * @param {number}  data.amount             - Amount received
 * @param {string}  [data.narration]
 */
function buildCreateReceiptXml(data) {
  validateReceiptPayload(data);

  const {
    date,
    voucherNumber,
    reference,
    partyLedgerName,
    bankOrCashLedgerName,
    amount,
    narration = ''
  } = data;

  const amt = r2(amount);

  // Receipt: Cash/Bank DEBITED (+), Party ledger CREDITED (-)
  const voucherXml = `<VOUCHER ACTION="Create" VCHTYPE="Receipt">
      <DATE>${date}</DATE>
      <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${xmlEscape(voucherNumber)}</VOUCHERNUMBER>
      <REFERENCE>${xmlEscape(reference || voucherNumber)}</REFERENCE>
      <NARRATION>${xmlEscape(narration)}</NARRATION>

      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${xmlEscape(bankOrCashLedgerName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${amt.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>

      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${xmlEscape(partyLedgerName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${amt.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`;

  return wrapImportEnvelope(voucherXml, 'Vouchers');
}

// ---------------------------------------------------------------------------
// CREDIT NOTE
// ---------------------------------------------------------------------------

/**
 * Build XML to create a Credit Note (sales return / invoice correction).
 *
 * @param {object} data - Same shape as sales voucher but voucherTypeName = "Credit Note"
 */
function buildCreateCreditNoteXml(data) {
  return buildCreateSalesVoucherXml({
    ...data,
    voucherTypeName: 'Credit Note'
  });
}

// ---------------------------------------------------------------------------
// PURCHASE VOUCHER
// ---------------------------------------------------------------------------

/**
 * Build XML to create a Purchase Invoice in Tally.
 *
 * @param {object} data
 * @param {string}  data.date
 * @param {string}  data.voucherNumber
 * @param {string}  [data.reference]        - ERP order UUID
 * @param {string}  data.partyLedgerName    - Supplier ledger name
 * @param {string}  data.purchaseLedgerName - Purchase ledger (e.g. "Purchase")
 * @param {Array}   data.items              - Same as sales voucher items
 * @param {object}  [data.gst]              - Same as sales voucher gst
 * @param {string}  [data.narration]
 */
function buildCreatePurchaseVoucherXml(data) {
  const {
    date,
    voucherNumber,
    reference,
    partyLedgerName,
    purchaseLedgerName,
    items,
    gst,
    narration = '',
    godownName = null
  } = data;

  // Re-use sales voucher builder with the purchase ledger substituted
  // and reversed sign convention (supplier is CREDITED, purchase ledger DEBITED)
  const taxableAmount = r2(items.reduce((s, i) => s + Number(i.amount), 0));
  let totalTax = 0;
  let taxEntries = '';

  if (gst && gst.applicable && gst.rate > 0) {
    if (gst.type === 'LOCAL') {
      const cgst = r2(gst.cgst.amount);
      const sgst = r2(gst.sgst.amount);
      totalTax = r2(cgst + sgst);
      taxEntries = `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape(gst.cgst.ledgerName)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>${cgst.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape(gst.sgst.ledgerName)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>${sgst.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;
    } else {
      const igst = r2(gst.igst.amount);
      totalTax = igst;
      taxEntries = `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape(gst.igst.ledgerName)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>${igst.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;
    }
  }

  const totalInvoiceAmount = r2(taxableAmount + totalTax);

  const inventoryXml = items.map(item => {
    const godownXml = godownName
      ? `<BATCHALLOCATIONS.LIST>
            <GODOWNNAME>${xmlEscape(godownName)}</GODOWNNAME>
            <BATCHNAME>Primary Batch</BATCHNAME>
            <AMOUNT>${r2(item.amount).toFixed(2)}</AMOUNT>
            <ACTUALQTY>${r2(item.quantity)} ${xmlEscape(item.unit)}</ACTUALQTY>
            <BILLEDQTY>${r2(item.quantity)} ${xmlEscape(item.unit)}</BILLEDQTY>
          </BATCHALLOCATIONS.LIST>`
      : '';

    return `<ALLINVENTORYENTRIES.LIST>
          <STOCKITEMNAME>${xmlEscape(item.stockItemName)}</STOCKITEMNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <RATE>${r2(item.rate).toFixed(2)}/${xmlEscape(item.unit)}</RATE>
          <AMOUNT>${r2(item.amount).toFixed(2)}</AMOUNT>
          <ACTUALQTY>${r2(item.quantity)} ${xmlEscape(item.unit)}</ACTUALQTY>
          <BILLEDQTY>${r2(item.quantity)} ${xmlEscape(item.unit)}</BILLEDQTY>
          ${godownXml}
        </ALLINVENTORYENTRIES.LIST>`;
  }).join('\n');

  const voucherXml = `<VOUCHER ACTION="Create" OBJVIEW="Invoice Voucher View">
      <DATE>${date}</DATE>
      <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${xmlEscape(voucherNumber)}</VOUCHERNUMBER>
      <REFERENCE>${xmlEscape(reference || voucherNumber)}</REFERENCE>
      <PARTYLEDGERNAME>${xmlEscape(partyLedgerName)}</PARTYLEDGERNAME>
      <ISINVOICE>Yes</ISINVOICE>
      <NARRATION>${xmlEscape(narration)}</NARRATION>

      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${xmlEscape(partyLedgerName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${totalInvoiceAmount.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>

      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${xmlEscape(purchaseLedgerName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${taxableAmount.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      ${taxEntries}

      ${inventoryXml}
    </VOUCHER>`;

  return wrapImportEnvelope(voucherXml, 'Vouchers');
}

module.exports = {
  buildCreateSalesVoucherXml,
  buildCreateCustomerLedgerXml,
  buildCreateSupplierLedgerXml,
  buildCreateStockItemXml,
  buildCreateReceiptXml,
  buildCreateCreditNoteXml,
  buildCreatePurchaseVoucherXml,
  // Expose helpers for unit testing
  xmlEscape,
  r2
};
