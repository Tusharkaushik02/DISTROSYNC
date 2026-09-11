/**
 * Tally payload validation layer.
 *
 * All validation runs BEFORE the XML is built or sent to Tally. This gives the
 * ERP-service a fast, actionable error instead of a cryptic Tally rejection.
 */

class TallyValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'TallyValidationError';
    this.field = field;
  }
}

/**
 * Validate date string — must be YYYYMMDD (Tally native format)
 */
function validateDate(date, fieldName = 'date') {
  if (!date) throw new TallyValidationError(`${fieldName} is required`, fieldName);
  if (!/^\d{8}$/.test(String(date))) {
    throw new TallyValidationError(
      `${fieldName} must be in YYYYMMDD format (got: ${date})`,
      fieldName
    );
  }
}

/**
 * Validate that a string field is non-empty
 */
function requireString(value, fieldName) {
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new TallyValidationError(`${fieldName} is required and must be a non-empty string`, fieldName);
  }
}

/**
 * Validate that a number is positive
 */
function requirePositiveNumber(value, fieldName) {
  const n = Number(value);
  if (isNaN(n) || n <= 0) {
    throw new TallyValidationError(`${fieldName} must be a positive number (got: ${value})`, fieldName);
  }
}

/**
 * Validate that ledger entries balance to zero (Tally mandatory rule).
 *
 * @param {Array<{ amount: number }>} entries
 */
function validateLedgerBalance(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TallyValidationError('Ledger entries list is empty');
  }

  const total = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  // Allow a small floating-point tolerance
  if (Math.abs(total) > 0.01) {
    throw new TallyValidationError(
      `Ledger entries do not balance. Net = ${total.toFixed(2)} (must be 0.00)`
    );
  }
}

/**
 * Validate GST amounts for a sales invoice.
 *
 * @param {object} gst - GST configuration from invoice payload
 * @param {number} taxableAmount - Base taxable amount
 */
function validateGstAmounts(gst, taxableAmount) {
  if (!gst || !gst.applicable) return; // Non-GST invoice — nothing to validate

  requireString(gst.type, 'gst.type');
  if (!['LOCAL', 'INTERSTATE'].includes(gst.type)) {
    throw new TallyValidationError('gst.type must be "LOCAL" or "INTERSTATE"', 'gst.type');
  }

  const rate = Number(gst.rate);
  if (isNaN(rate) || rate < 0 || rate > 100) {
    throw new TallyValidationError('gst.rate must be between 0 and 100', 'gst.rate');
  }

  const expectedTax = +(taxableAmount * rate / 100).toFixed(2);

  if (gst.type === 'LOCAL') {
    requireString(gst.cgst?.ledgerName, 'gst.cgst.ledgerName');
    requireString(gst.sgst?.ledgerName, 'gst.sgst.ledgerName');
    const cgst = Number(gst.cgst.amount);
    const sgst = Number(gst.sgst.amount);
    if (Math.abs(cgst + sgst - expectedTax) > 0.02) {
      throw new TallyValidationError(
        `CGST (${cgst}) + SGST (${sgst}) = ${cgst + sgst} does not match expected tax ${expectedTax} at ${rate}%`
      );
    }
  } else {
    // INTERSTATE
    requireString(gst.igst?.ledgerName, 'gst.igst.ledgerName');
    const igst = Number(gst.igst.amount);
    if (Math.abs(igst - expectedTax) > 0.02) {
      throw new TallyValidationError(
        `IGST (${igst}) does not match expected tax ${expectedTax} at ${rate}%`
      );
    }
  }
}

/**
 * Validate a full sales voucher payload.
 *
 * @param {object} data
 */
function validateSalesVoucherPayload(data) {
  if (!data || typeof data !== 'object') {
    throw new TallyValidationError('Sales voucher payload is required');
  }

  validateDate(data.date, 'date');
  requireString(data.voucherNumber, 'voucherNumber');
  requireString(data.partyLedgerName, 'partyLedgerName');
  requireString(data.salesLedgerName, 'salesLedgerName');

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new TallyValidationError('items must be a non-empty array', 'items');
  }

  let totalTaxable = 0;

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    const prefix = `items[${i}]`;

    requireString(item.stockItemName, `${prefix}.stockItemName`);
    requireString(item.unit, `${prefix}.unit`);
    requirePositiveNumber(item.quantity, `${prefix}.quantity`);
    requirePositiveNumber(item.rate, `${prefix}.rate`);
    requirePositiveNumber(item.amount, `${prefix}.amount`);

    // Verify amount = quantity × rate (allow 1-rupee rounding tolerance)
    const expected = +(item.quantity * item.rate).toFixed(2);
    if (Math.abs(Number(item.amount) - expected) > 1.0) {
      throw new TallyValidationError(
        `${prefix}.amount (${item.amount}) does not match qty × rate (${expected})`
      );
    }

    totalTaxable += Number(item.amount);
  }

  if (data.gst?.applicable) {
    validateGstAmounts(data.gst, totalTaxable);
  }
}

/**
 * Validate a customer ledger creation payload.
 *
 * @param {object} data
 */
function validateCustomerLedgerPayload(data) {
  if (!data || typeof data !== 'object') {
    throw new TallyValidationError('Customer ledger payload is required');
  }
  requireString(data.name, 'name');
  // stateName is required for GST compliance in India
  if (!data.stateName) {
    throw new TallyValidationError(
      'stateName is required for customer ledger (needed for GST place-of-supply)',
      'stateName'
    );
  }
}

/**
 * Validate a stock item creation payload.
 *
 * @param {object} data
 */
function validateStockItemPayload(data) {
  if (!data || typeof data !== 'object') {
    throw new TallyValidationError('Stock item payload is required');
  }
  requireString(data.name, 'name');
  requireString(data.baseUnit, 'baseUnit');
}

/**
 * Validate a receipt creation payload.
 *
 * @param {object} data
 */
function validateReceiptPayload(data) {
  if (!data || typeof data !== 'object') {
    throw new TallyValidationError('Receipt payload is required');
  }
  validateDate(data.date, 'date');
  requireString(data.partyLedgerName, 'partyLedgerName');
  requireString(data.bankOrCashLedgerName, 'bankOrCashLedgerName');
  requirePositiveNumber(data.amount, 'amount');
}

module.exports = {
  TallyValidationError,
  validateDate,
  requireString,
  requirePositiveNumber,
  validateLedgerBalance,
  validateGstAmounts,
  validateSalesVoucherPayload,
  validateCustomerLedgerPayload,
  validateStockItemPayload,
  validateReceiptPayload
};
