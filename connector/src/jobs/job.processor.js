const tallyClient = require('../tally/tally.client');
const voucherCache = require('../storage/voucher.cache');
const logger = require('../utils/logger');

class JobProcessor {
  async processJob(action, payload = {}) {
    logger.info(`[JobProcessor] Executing action: ${action}`, payload);

    switch (action) {

      // =====================================================================
      // HEALTH / PING
      // =====================================================================

      case 'PING_TALLY':
      case 'HEALTH_CHECK': {
        const health = await tallyClient.checkHealth();
        return health;
      }

      // =====================================================================
      // READ — EXISTING
      // =====================================================================

      case 'FETCH_INVENTORY':
      case 'SYNC_STOCK': {
        const items = await tallyClient.fetchStockItems();
        return {
          count: items.length,
          items,
          timestamp: new Date().toISOString()
        };
      }

      case 'FETCH_CUSTOMERS':
      case 'SYNC_CUSTOMERS': {
        const customers = await tallyClient.fetchCustomers();
        return {
          count: customers.length,
          customers,
          timestamp: new Date().toISOString()
        };
      }

      case 'FETCH_SALES_ORDERS':
      case 'SYNC_SALES_ORDERS': {
        const orders = await tallyClient.fetchSalesOrders();

        return {
          count: orders.length,
          salesOrders: orders,
          timestamp: new Date().toISOString()
        };
      }

      case 'EXECUTE_RAW_XML': {
        if (!payload.xml) {
          throw new Error('Missing "xml" field in payload for EXECUTE_RAW_XML');
        }
        const parsed = await tallyClient.executeXml(payload.xml);
        return parsed;
      }

      // =====================================================================
      // READ — NEW
      // =====================================================================

      case 'FETCH_COMPANY_INFO': {
        const companyInfo = await tallyClient.fetchCompanyInfo();
        return {
          ...companyInfo,
          timestamp: new Date().toISOString()
        };
      }

      case 'FETCH_SUPPLIERS': {
        const suppliers = await tallyClient.fetchSuppliers();
        return {
          count: suppliers.length,
          suppliers,
          timestamp: new Date().toISOString()
        };
      }

      case 'FETCH_TAX_LEDGERS': {
        const taxLedgers = await tallyClient.fetchTaxLedgers();
        return {
          ...taxLedgers,
          timestamp: new Date().toISOString()
        };
      }

      case 'FETCH_LEDGERS': {
        const group = payload.group || '';
        const ledgers = await tallyClient.fetchAllLedgers(group);
        return {
          count: ledgers.length,
          group: group || 'All',
          ledgers,
          timestamp: new Date().toISOString()
        };
      }

      case 'FETCH_UNITS': {
        const units = await tallyClient.fetchUnits();
        return {
          count: units.length,
          units,
          timestamp: new Date().toISOString()
        };
      }

      case 'FETCH_GODOWNS': {
        const godowns = await tallyClient.fetchGodowns();
        return {
          count: godowns.length,
          godowns,
          timestamp: new Date().toISOString()
        };
      }

      case 'FETCH_LEDGER_OUTSTANDING': {
        if (!payload.partyName) {
          throw new Error('Missing "partyName" field for FETCH_LEDGER_OUTSTANDING');
        }
        const outstanding = await tallyClient.fetchLedgerOutstanding(payload.partyName);
        return {
          ...outstanding,
          timestamp: new Date().toISOString()
        };
      }

      case 'FETCH_STOCK_BALANCE': {
        if (!payload.itemName) {
          throw new Error('Missing "itemName" field for FETCH_STOCK_BALANCE');
        }
        const balance = await tallyClient.fetchStockBalance(payload.itemName);
        return {
          ...balance,
          timestamp: new Date().toISOString()
        };
      }

      // =====================================================================
      // WRITE — VOUCHERS
      // =====================================================================

      case 'CREATE_SALES_VOUCHER': {
        // Idempotency: check if already sent
        const ref = payload.reference;
        if (ref && voucherCache.hasSent(ref)) {
          const cached = voucherCache.getStatus(ref);
          logger.info(`[JobProcessor] Duplicate detected for ref=${ref}. Already sent at ${cached.sentAt}`);
          return {
            success: true,
            duplicate: true,
            tallyVoucherNumber: cached.tallyVoucherNumber,
            sentAt: cached.sentAt
          };
        }

        const salesResult = await tallyClient.createSalesVoucher(payload);

        // Cache the successful result
        if (salesResult.success && ref) {
          voucherCache.markSent(ref, payload.voucherNumber, 'CREATE_SALES_VOUCHER');
        }

        return {
          success: salesResult.success,
          created: salesResult.created,
          voucherNumber: payload.voucherNumber,
          timestamp: new Date().toISOString()
        };
      }

      case 'CREATE_RECEIPT': {
        const ref = payload.reference;
        if (ref && voucherCache.hasSent(ref)) {
          const cached = voucherCache.getStatus(ref);
          return { success: true, duplicate: true, sentAt: cached.sentAt };
        }

        const receiptResult = await tallyClient.createReceipt(payload);

        if (receiptResult.success && ref) {
          voucherCache.markSent(ref, payload.voucherNumber, 'CREATE_RECEIPT');
        }

        return {
          success: receiptResult.success,
          created: receiptResult.created,
          voucherNumber: payload.voucherNumber,
          timestamp: new Date().toISOString()
        };
      }

      case 'CREATE_CREDIT_NOTE': {
        const ref = payload.reference;
        if (ref && voucherCache.hasSent(ref)) {
          const cached = voucherCache.getStatus(ref);
          return { success: true, duplicate: true, sentAt: cached.sentAt };
        }

        const cnResult = await tallyClient.createCreditNote(payload);

        if (cnResult.success && ref) {
          voucherCache.markSent(ref, payload.voucherNumber, 'CREATE_CREDIT_NOTE');
        }

        return {
          success: cnResult.success,
          created: cnResult.created,
          voucherNumber: payload.voucherNumber,
          timestamp: new Date().toISOString()
        };
      }

      case 'CREATE_PURCHASE_VOUCHER': {
        const ref = payload.reference;
        if (ref && voucherCache.hasSent(ref)) {
          const cached = voucherCache.getStatus(ref);
          return { success: true, duplicate: true, sentAt: cached.sentAt };
        }

        const pvResult = await tallyClient.createPurchaseVoucher(payload);

        if (pvResult.success && ref) {
          voucherCache.markSent(ref, payload.voucherNumber, 'CREATE_PURCHASE_VOUCHER');
        }

        return {
          success: pvResult.success,
          created: pvResult.created,
          voucherNumber: payload.voucherNumber,
          timestamp: new Date().toISOString()
        };
      }

      // =====================================================================
      // WRITE — MASTERS
      // =====================================================================

      case 'CREATE_CUSTOMER_LEDGER': {
        const custResult = await tallyClient.createCustomerLedger(payload);
        return {
          success: custResult.success,
          created: custResult.created,
          altered: custResult.altered,
          ledgerName: payload.name,
          timestamp: new Date().toISOString()
        };
      }

      case 'CREATE_SUPPLIER_LEDGER': {
        const suppResult = await tallyClient.createSupplierLedger(payload);
        return {
          success: suppResult.success,
          created: suppResult.created,
          altered: suppResult.altered,
          ledgerName: payload.name,
          timestamp: new Date().toISOString()
        };
      }

      case 'CREATE_STOCK_ITEM': {
        const itemResult = await tallyClient.createStockItem(payload);
        return {
          success: itemResult.success,
          created: itemResult.created,
          altered: itemResult.altered,
          itemName: payload.name,
          timestamp: new Date().toISOString()
        };
      }

      default:
        throw new Error(`Unknown job action: ${action}`);
    }
  }
}

const jobProcessor = new JobProcessor();
module.exports = jobProcessor;
