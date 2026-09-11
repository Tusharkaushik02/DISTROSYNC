const axios = require('axios');
const xml2js = require('xml2js');
const config = require('../config/config');
const logger = require('../utils/logger');
const {
  GET_COMPANIES_XML,
  EXPORT_STOCK_ITEMS_XML,
  EXPORT_LEDGERS_XML,
  EXPORT_SALES_ORDERS_XML,
  EXPORT_COMPANY_INFO_XML,
  EXPORT_SUPPLIERS_XML,
  EXPORT_TAX_LEDGERS_XML,
  EXPORT_ALL_LEDGERS_XML,
  EXPORT_UNITS_XML,
  EXPORT_GODOWNS_XML,
  EXPORT_LEDGER_OUTSTANDING_XML,
  EXPORT_STOCK_BALANCE_XML
} = require('./tally.templates');

const {
  buildCreateSalesVoucherXml,
  buildCreateCustomerLedgerXml,
  buildCreateSupplierLedgerXml,
  buildCreateStockItemXml,
  buildCreateReceiptXml,
  buildCreateCreditNoteXml,
  buildCreatePurchaseVoucherXml
} = require('./tally.write.templates');

function extractText(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val._ !== undefined) return String(val._).trim();
    if (val.NAME !== undefined) return String(val.NAME).trim();
    return '';
  }
  return String(val).trim();
}

// ---------------------------------------------------------------------------
// Custom error for Tally Import failures
// ---------------------------------------------------------------------------

class TallyImportError extends Error {
  constructor(message, lineError = '', rawResponse = null) {
    super(message);
    this.name = 'TallyImportError';
    this.lineError = lineError;
    this.rawResponse = rawResponse;
  }
}

// ---------------------------------------------------------------------------
// TallyClient
// ---------------------------------------------------------------------------

class TallyClient {
  constructor() {
    this.parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true,
      trim: true
    });
  }

  getBaseUrl() {
    return `http://${config.tallyHost}:${config.tallyPort}`;
  }

  // =========================================================================
  // LOW-LEVEL XML EXECUTION
  // =========================================================================

  /**
   * Send XML payload to local Tally HTTP Server (Export / Read)
   */
  async executeXml(xmlPayload) {
    const url = this.getBaseUrl();
    try {
      const response = await axios.post(url, xmlPayload, {
        headers: {
          'Content-Type': 'text/xml;charset=utf-8'
        },
        timeout: config.tallyTimeoutMs,
        responseType: 'text'
      });

      const rawXml = typeof response.data === 'string' ? response.data : String(response.data);
      const sanitizedXml = rawXml.replace(/&#(?:[0-8]|1[1-2]|1[4-9]|2[0-9]|3[0-1]);/g, '');
      return await this.parser.parseStringPromise(sanitizedXml);
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        throw new Error(`Tally is not reachable at ${url}. Please ensure TallyPrime is running with ODBC/XML enabled.`);
      }
      if (err.code === 'ETIMEDOUT') {
        throw new Error(`Tally request timed out after ${config.tallyTimeoutMs}ms`);
      }
      throw new Error(`Tally communication error: ${err.message}`);
    }
  }

  /**
   * Send XML payload to Tally for Import (Write) operations.
   * Parses the response to detect STATUS=1 (success) or STATUS=0 (failure).
   *
   * @param {string} xmlPayload - ENVELOPE XML for Import
   * @returns {{ success: boolean, created: number, altered: number, errors: number, lineError: string, raw: object }}
   * @throws {TallyImportError} on Tally rejection
   */
  async importXml(xmlPayload) {
    const url = this.getBaseUrl();
    let rawXml;

    try {
      const response = await axios.post(url, xmlPayload, {
        headers: {
          'Content-Type': 'text/xml;charset=utf-8'
        },
        timeout: config.tallyTimeoutMs,
        responseType: 'text'
      });

      rawXml = typeof response.data === 'string' ? response.data : String(response.data);
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        throw new Error(`Tally is not reachable at ${url}. Please ensure TallyPrime is running.`);
      }
      if (err.code === 'ETIMEDOUT') {
        throw new Error(`Tally import timed out after ${config.tallyTimeoutMs}ms`);
      }
      throw new Error(`Tally import communication error: ${err.message}`);
    }

    // Sanitize control characters
    const sanitizedXml = rawXml.replace(/&#(?:[0-8]|1[1-2]|1[4-9]|2[0-9]|3[0-1]);/g, '');
    const parsed = await this.parser.parseStringPromise(sanitizedXml);

    // Parse Tally response structure
    const header = parsed?.ENVELOPE?.HEADER || parsed?.RESPONSE?.HEADER || {};
    const body = parsed?.ENVELOPE?.BODY || parsed?.RESPONSE?.BODY || {};

    // Tally import responses may contain:
    //   HEADER.STATUS: 1 (success) or 0 (failure)
    //   BODY.DATA.IMPORTRESULT: { CREATED, ALTERED, LASTVCHID, ... }
    //   BODY.DATA.LINEERROR or BODY.LINEERROR: error description
    const status = Number(header.STATUS ?? header.status ?? 1);

    const importResult = body?.DATA?.IMPORTRESULT || body?.IMPORTRESULT || {};
    const created = Number(importResult.CREATED || importResult.Created || 0);
    const altered = Number(importResult.ALTERED || importResult.Altered || 0);
    const errors = Number(importResult.ERRORS || importResult.Errors || 0);
    const lastVchId = importResult.LASTVCHID || importResult.LastVchId || '';

    // Extract line-level errors
    let lineError = '';
    const lineErr = body?.DATA?.LINEERROR || body?.LINEERROR ||
                    body?.DATA?.TALLYMESSAGE?.LINEERROR || '';
    if (lineErr) {
      lineError = typeof lineErr === 'object' ? JSON.stringify(lineErr) : String(lineErr);
    }

    const result = {
      success: status === 1 && errors === 0,
      created,
      altered,
      errors,
      lastVchId,
      lineError,
      raw: parsed
    };

    if (!result.success) {
      const errMsg = lineError || `Tally rejected the import (STATUS=${status}, errors=${errors})`;
      logger.error(`[Tally] Import failed: ${errMsg}`);
      throw new TallyImportError(errMsg, lineError, parsed);
    }

    logger.info(`[Tally] Import successful: created=${created}, altered=${altered}, lastVchId=${lastVchId}`);
    return result;
  }

  // =========================================================================
  // READ OPERATIONS (existing)
  // =========================================================================

  /**
   * Verify Tally connectivity and get active company name
   */
  async checkHealth() {
    try {
      const parsed = await this.executeXml(GET_COMPANIES_XML);

      let companyName = null;
      const body = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
      if (body?.COMPANY) {
        const companies = Array.isArray(body.COMPANY) ? body.COMPANY : [body.COMPANY];
        if (companies.length > 0) {
          companyName = companies[0]?.NAME || companies[0]?._ || 'Active Company';
        }
      }

      return {
        online: true,
        companyName: companyName || 'Connected to Tally',
        host: config.tallyHost,
        port: config.tallyPort
      };
    } catch (err) {
      return {
        online: false,
        error: err.message,
        host: config.tallyHost,
        port: config.tallyPort
      };
    }
  }

  /**
   * Fetch and normalize stock items from Tally
   */
  async fetchStockItems() {
    logger.info('[Tally] Fetching stock items...');
    const parsed = await this.executeXml(EXPORT_STOCK_ITEMS_XML);

    const items = [];
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKITEM;

    if (collection) {
      const rawList = Array.isArray(collection) ? collection : [collection];
      for (const item of rawList) {
        const name = item.NAME || item._ || '';
        if (!name) continue;

        const closingBalance = parseFloat(item.CLOSINGBALANCE || '0') || 0;
        const rate = parseFloat(item.CLOSINGRATE || '0') || 0;
        const unit = item.BASEUNITS || 'Unit';

        items.push({
          sku: name.replace(/\s+/g, '-').toUpperCase(),
          name,
          category: item.PARENT || 'General',
          unit,
          price: rate,
          availableQuantity: closingBalance
        });
      }
    }

    logger.info(`[Tally] Successfully retrieved ${items.length} stock items from Tally`);
    return items;
  }

  /**
   * Fetch customer ledgers from Tally
   */
  async fetchCustomers() {
    logger.info('[Tally] Fetching customer ledgers...');
    const parsed = await this.executeXml(EXPORT_LEDGERS_XML);

    const customers = [];
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;

    if (collection) {
      const rawList = Array.isArray(collection) ? collection : [collection];
      for (const ledger of rawList) {
        const name = ledger.NAME || ledger._ || '';
        if (!name) continue;

        customers.push({
          name,
          phone: ledger.LEDGERMOBILE || ledger.LEDGERPHONE || '',
          email: ledger.EMAIL || '',
          state: ledger.STATENAME || '',
          gstin: ledger.PARTYGSTIN || '',
          balance: parseFloat(ledger.CLOSINGBALANCE || '0') || 0
        });
      }
    }

    logger.info(`[Tally] Successfully retrieved ${customers.length} customer ledgers`);
    return customers;
  }

  /**
   * Fetch and normalize sales orders from Tally
   */
  async fetchSalesOrders() {
    logger.info('[Tally] Fetching sales orders...');
    const parsed = await this.executeXml(EXPORT_SALES_ORDERS_XML);

    const orders = [];
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER;

    if (collection) {
      const rawList = Array.isArray(collection) ? collection : [collection];
      for (const voucher of rawList) {
        const voucherType = extractText(voucher.VOUCHERTYPENAME) || voucher.VCHTYPE || 'Sales Order';

        // Defensive check: ensure it is a Sales Order
        if (voucherType && !voucherType.toLowerCase().includes('sales order') && !voucherType.toLowerCase().includes('order')) {
          continue;
        }

        const rawVchNo = extractText(voucher.VOUCHERNUMBER);
        const rawRef = extractText(voucher.REFERENCE);
        let voucherNumber = rawVchNo;
        if (rawRef && (!rawVchNo || /^\d+$/.test(rawVchNo))) {
          voucherNumber = rawRef.toUpperCase();
        } else if (!voucherNumber && rawRef) {
          voucherNumber = rawRef;
        }

        const party = extractText(voucher.PARTYLEDGERNAME) || extractText(voucher.PARTYNAME) || '';
        const date = extractText(voucher.DATE) || '';
        const rawAmount = Math.abs(parseFloat(extractText(voucher.AMOUNT))) || 0;

        // Extract inventory items defensively
        const rawItems = voucher['ALLINVENTORYENTRIES.LIST'] || voucher['INVENTORYENTRIES.LIST'];
        const items = [];
        if (rawItems) {
          const itemList = Array.isArray(rawItems) ? rawItems : [rawItems];
          for (const item of itemList) {
            const stockItemName = extractText(item.STOCKITEMNAME);
            if (!stockItemName) continue;

            const quantity = extractText(item.ACTUALQTY);
            const billedQuantity = extractText(item.BILLEDQTY) || quantity;
            const rate = extractText(item.RATE);
            const itemAmount = Math.abs(parseFloat(extractText(item.AMOUNT))) || 0;

            items.push({
              stockItemName,
              quantity,
              billedQuantity,
              rate,
              amount: itemAmount
            });
          }
        }

        const totalAmount = rawAmount || items.reduce((sum, it) => sum + it.amount, 0);

        orders.push({
          date,
          voucherNumber,
          party,
          voucherType,
          reference: rawRef,
          amount: totalAmount,
          items
        });
      }
    }

    logger.info(`[Tally] Successfully retrieved ${orders.length} sales orders from Tally`);
    return orders;
  }

  // =========================================================================
  // READ OPERATIONS (new)
  // =========================================================================

  /**
   * Fetch company info including GSTIN, state, and financial year.
   */
  async fetchCompanyInfo() {
    logger.info('[Tally] Fetching company info...');
    const parsed = await this.executeXml(EXPORT_COMPANY_INFO_XML);

    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.COMPANY;
    if (!collection) {
      return { name: null, gstin: null, state: null };
    }

    const company = Array.isArray(collection) ? collection[0] : collection;

    return {
      name: company.NAME || company.BASICCOMPANYNAME || '',
      gstin: company.PARTYGSTIN || '',
      gstRegistrationType: company.GSTREGISTRATIONTYPE || '',
      state: company.STATENAME || '',
      country: company.COUNTRYNAME || 'India',
      address: company.ADDRESS || '',
      startingFrom: company.STARTINGFROM || '',
      booksFrom: company.BOOKBEGINNINGFROM || '',
      periodFrom: company.CURRENTPERIODFROM || '',
      periodTo: company.CURRENTPERIODTO || ''
    };
  }

  /**
   * Fetch supplier ledgers (Sundry Creditors).
   */
  async fetchSuppliers() {
    logger.info('[Tally] Fetching supplier ledgers...');
    const parsed = await this.executeXml(EXPORT_SUPPLIERS_XML);

    const suppliers = [];
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;

    if (collection) {
      const rawList = Array.isArray(collection) ? collection : [collection];
      for (const ledger of rawList) {
        const name = ledger.NAME || ledger._ || '';
        if (!name) continue;
        suppliers.push({
          name,
          phone: ledger.LEDGERMOBILE || ledger.LEDGERPHONE || '',
          email: ledger.EMAIL || '',
          state: ledger.STATENAME || '',
          gstin: ledger.PARTYGSTIN || '',
          balance: parseFloat(ledger.CLOSINGBALANCE || '0') || 0
        });
      }
    }

    logger.info(`[Tally] Successfully retrieved ${suppliers.length} supplier ledgers`);
    return suppliers;
  }

  /**
   * Fetch tax ledgers (Duties & Taxes group).
   * Returns ledger names categorized by GST type (CGST, SGST, IGST).
   */
  async fetchTaxLedgers() {
    logger.info('[Tally] Fetching tax ledgers...');
    const parsed = await this.executeXml(EXPORT_TAX_LEDGERS_XML);

    const ledgers = [];
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;

    if (collection) {
      const rawList = Array.isArray(collection) ? collection : [collection];
      for (const ledger of rawList) {
        const name = ledger.NAME || ledger._ || '';
        if (!name) continue;
        ledgers.push({
          name,
          parent: ledger.PARENT || '',
          gstType: ledger.GSTTYPE || '',
          balance: parseFloat(ledger.CLOSINGBALANCE || '0') || 0
        });
      }
    }

    // Attempt to auto-classify CGST, SGST, IGST by name or GSTType
    const classify = (type) => {
      return ledgers.find(l =>
        l.gstType?.toLowerCase().includes(type) ||
        l.name?.toLowerCase().includes(type)
      )?.name || null;
    };

    logger.info(`[Tally] Successfully retrieved ${ledgers.length} tax ledgers`);
    return {
      all: ledgers,
      cgst: classify('central') || classify('cgst'),
      sgst: classify('state') || classify('sgst'),
      igst: classify('integrated') || classify('igst')
    };
  }

  /**
   * Fetch all ledgers, optionally filtered by parent group.
   */
  async fetchAllLedgers(group = '') {
    logger.info(`[Tally] Fetching ledgers${group ? ` (group: ${group})` : ' (all)'}...`);
    const parsed = await this.executeXml(EXPORT_ALL_LEDGERS_XML(group));

    const ledgers = [];
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;

    if (collection) {
      const rawList = Array.isArray(collection) ? collection : [collection];
      for (const ledger of rawList) {
        const name = ledger.NAME || ledger._ || '';
        if (!name) continue;
        ledgers.push({
          name,
          parent: ledger.PARENT || '',
          state: ledger.STATENAME || '',
          gstin: ledger.PARTYGSTIN || '',
          phone: ledger.LEDGERMOBILE || '',
          email: ledger.EMAIL || '',
          balance: parseFloat(ledger.CLOSINGBALANCE || '0') || 0
        });
      }
    }

    logger.info(`[Tally] Retrieved ${ledgers.length} ledgers`);
    return ledgers;
  }

  /**
   * Fetch units of measure.
   */
  async fetchUnits() {
    logger.info('[Tally] Fetching units...');
    const parsed = await this.executeXml(EXPORT_UNITS_XML);

    const units = [];
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.UNIT;

    if (collection) {
      const rawList = Array.isArray(collection) ? collection : [collection];
      for (const unit of rawList) {
        const name = unit.NAME || unit._ || '';
        if (!name) continue;
        units.push({
          name,
          formalName: unit.FORMALNAME || name,
          type: unit.UOMTYPE || ''
        });
      }
    }

    logger.info(`[Tally] Retrieved ${units.length} units`);
    return units;
  }

  /**
   * Fetch godowns / warehouses.
   */
  async fetchGodowns() {
    logger.info('[Tally] Fetching godowns...');
    const parsed = await this.executeXml(EXPORT_GODOWNS_XML);

    const godowns = [];
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.GODOWN;

    if (collection) {
      const rawList = Array.isArray(collection) ? collection : [collection];
      for (const gdn of rawList) {
        const name = gdn.NAME || gdn._ || '';
        if (!name) continue;
        godowns.push({
          name,
          parent: gdn.PARENT || '',
          address: gdn.ADDRESS || ''
        });
      }
    }

    logger.info(`[Tally] Retrieved ${godowns.length} godowns`);
    return godowns;
  }

  /**
   * Fetch outstanding bills for a party ledger.
   */
  async fetchLedgerOutstanding(partyName) {
    logger.info(`[Tally] Fetching outstanding for: ${partyName}`);
    const parsed = await this.executeXml(EXPORT_LEDGER_OUTSTANDING_XML(partyName));

    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;
    if (!collection) {
      return { party: partyName, balance: 0, bills: [] };
    }

    const ledger = Array.isArray(collection) ? collection[0] : collection;
    const balance = parseFloat(ledger.CLOSINGBALANCE || '0') || 0;

    const bills = [];
    const billDetails = ledger['BILLDETAILS.LIST'] || ledger.BILLDETAILS;
    if (billDetails) {
      const billList = Array.isArray(billDetails) ? billDetails : [billDetails];
      for (const bill of billList) {
        bills.push({
          name: bill.NAME || '',
          amount: parseFloat(bill.AMOUNT || '0') || 0,
          date: bill.DATE || ''
        });
      }
    }

    return { party: partyName, balance, bills };
  }

  /**
   * Fetch stock balance for a specific item.
   */
  async fetchStockBalance(itemName) {
    logger.info(`[Tally] Fetching stock balance for: ${itemName}`);
    const parsed = await this.executeXml(EXPORT_STOCK_BALANCE_XML(itemName));

    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKITEM;
    if (!collection) {
      return { name: itemName, quantity: 0, rate: 0, value: 0, unit: '' };
    }

    const item = Array.isArray(collection) ? collection[0] : collection;
    return {
      name: item.NAME || itemName,
      unit: item.BASEUNITS || '',
      quantity: parseFloat(item.CLOSINGBALANCE || '0') || 0,
      rate: parseFloat(item.CLOSINGRATE || '0') || 0,
      value: parseFloat(item.CLOSINGVALUE || '0') || 0
    };
  }

  // =========================================================================
  // WRITE OPERATIONS
  // =========================================================================

  /**
   * Create a sales invoice in Tally.
   */
  async createSalesVoucher(data) {
    logger.info(`[Tally] Creating sales voucher: ${data.voucherNumber}`);
    const xml = buildCreateSalesVoucherXml(data);
    return await this.importXml(xml);
  }

  /**
   * Create a customer ledger in Tally (Sundry Debtors).
   */
  async createCustomerLedger(data) {
    logger.info(`[Tally] Creating customer ledger: ${data.name}`);
    const xml = buildCreateCustomerLedgerXml(data);
    return await this.importXml(xml);
  }

  /**
   * Create a supplier ledger in Tally (Sundry Creditors).
   */
  async createSupplierLedger(data) {
    logger.info(`[Tally] Creating supplier ledger: ${data.name}`);
    const xml = buildCreateSupplierLedgerXml(data);
    return await this.importXml(xml);
  }

  /**
   * Create a stock item in Tally.
   */
  async createStockItem(data) {
    logger.info(`[Tally] Creating stock item: ${data.name}`);
    const xml = buildCreateStockItemXml(data);
    return await this.importXml(xml);
  }

  /**
   * Create a receipt voucher (customer payment) in Tally.
   */
  async createReceipt(data) {
    logger.info(`[Tally] Creating receipt: ${data.voucherNumber}`);
    const xml = buildCreateReceiptXml(data);
    return await this.importXml(xml);
  }

  /**
   * Create a credit note in Tally.
   */
  async createCreditNote(data) {
    logger.info(`[Tally] Creating credit note: ${data.voucherNumber}`);
    const xml = buildCreateCreditNoteXml(data);
    return await this.importXml(xml);
  }

  /**
   * Create a purchase invoice in Tally.
   */
  async createPurchaseVoucher(data) {
    logger.info(`[Tally] Creating purchase voucher: ${data.voucherNumber}`);
    const xml = buildCreatePurchaseVoucherXml(data);
    return await this.importXml(xml);
  }
}

const tallyClient = new TallyClient();
module.exports = tallyClient;
module.exports.TallyImportError = TallyImportError;
