const tallyClient = require('../tally/tally.client');
const logger = require('../utils/logger');

class JobProcessor {
  async processJob(action, payload = {}) {
    logger.info(`[JobProcessor] Executing action: ${action}`, payload);

    switch (action) {
      case 'PING_TALLY':
      case 'HEALTH_CHECK': {
        const health = await tallyClient.checkHealth();
        return health;
      }

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

      default:
        throw new Error(`Unknown job action: ${action}`);
    }
  }
}

const jobProcessor = new JobProcessor();
module.exports = jobProcessor;
