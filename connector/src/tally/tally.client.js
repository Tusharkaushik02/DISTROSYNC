const axios = require('axios');
const xml2js = require('xml2js');
const config = require('../config/config');
const logger = require('../utils/logger');
const {
  GET_COMPANIES_XML,
  EXPORT_STOCK_ITEMS_XML,
  EXPORT_LEDGERS_XML,
  EXPORT_SALES_ORDERS_XML
} = require('./tally.templates');

function extractText(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val._ !== undefined) return String(val._).trim();
    if (val.NAME !== undefined) return String(val.NAME).trim();
    return '';
  }
  return String(val).trim();
}


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

  /**
   * Send XML payload to local Tally HTTP Server
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
   * Verify Tally connectivity and get active company name
   */
  async checkHealth() {
    try {
      const parsed = await this.executeXml(GET_COMPANIES_XML);

      let companyName = null;
      // Navigate parsed Tally response structure
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
          state: ledger.STATENAME || ''
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
}

const tallyClient = new TallyClient();
module.exports = tallyClient;
