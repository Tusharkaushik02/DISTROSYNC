/**
 * High-level domain service for Tally operations.
 *
 * Provides clean domain-oriented functions that:
 *  1. Map ERP data models to Tally payloads
 *  2. Dispatch jobs through the connector gateway
 *  3. Handle auto-creation of missing masters
 *
 * This is the ONLY layer that the rest of ERP-service should call for Tally operations.
 * It is NOT called directly by routes — the connector controller uses it.
 */

const connectorGateway = require('./connector.gateway');

class TallyService {
  // =========================================================================
  // READ — Company & Configuration
  // =========================================================================

  /**
   * Get Tally company info (GSTIN, state, FY).
   * Used for determining local vs interstate GST.
   */
  async getCompanyInfo(tenantId) {
    return connectorGateway.dispatchJob(tenantId, 'FETCH_COMPANY_INFO', {});
  }

  /**
   * Get tax ledger names (CGST, SGST, IGST).
   * These names vary per Tally company so we must read them before creating invoices.
   */
  async getTaxLedgers(tenantId) {
    return connectorGateway.dispatchJob(tenantId, 'FETCH_TAX_LEDGERS', {});
  }

  // =========================================================================
  // READ — Masters
  // =========================================================================

  async listCustomers(tenantId) {
    return connectorGateway.dispatchJob(tenantId, 'FETCH_CUSTOMERS', {});
  }

  async listSuppliers(tenantId) {
    return connectorGateway.dispatchJob(tenantId, 'FETCH_SUPPLIERS', {});
  }

  async listProducts(tenantId) {
    return connectorGateway.dispatchJob(tenantId, 'FETCH_INVENTORY', {});
  }

  async listUnits(tenantId) {
    return connectorGateway.dispatchJob(tenantId, 'FETCH_UNITS', {});
  }

  async listGodowns(tenantId) {
    return connectorGateway.dispatchJob(tenantId, 'FETCH_GODOWNS', {});
  }

  async listLedgers(tenantId, group = '') {
    return connectorGateway.dispatchJob(tenantId, 'FETCH_LEDGERS', { group });
  }

  async getStockBalance(tenantId, itemName) {
    return connectorGateway.dispatchJob(tenantId, 'FETCH_STOCK_BALANCE', { itemName });
  }

  async getLedgerOutstanding(tenantId, partyName) {
    return connectorGateway.dispatchJob(tenantId, 'FETCH_LEDGER_OUTSTANDING', { partyName });
  }

  async listSalesOrders(tenantId) {
    return connectorGateway.dispatchJob(tenantId, 'FETCH_SALES_ORDERS', {});
  }

  // =========================================================================
  // WRITE — Masters
  // =========================================================================

  /**
   * Create a customer ledger in Tally.
   *
   * @param {string} tenantId
   * @param {object} customerData - { name, stateName, gstin, address, mobile, email, creditLimit }
   */
  async createCustomer(tenantId, customerData) {
    return connectorGateway.dispatchJob(tenantId, 'CREATE_CUSTOMER_LEDGER', customerData);
  }

  async createSupplier(tenantId, supplierData) {
    return connectorGateway.dispatchJob(tenantId, 'CREATE_SUPPLIER_LEDGER', supplierData);
  }

  async createStockItem(tenantId, itemData) {
    return connectorGateway.dispatchJob(tenantId, 'CREATE_STOCK_ITEM', itemData);
  }

  // =========================================================================
  // WRITE — Transactions
  // =========================================================================

  /**
   * Create a sales invoice in Tally from an ERP order.
   *
   * This is the primary integration endpoint used when an order is CONFIRMED.
   *
   * @param {string} tenantId
   * @param {object} invoicePayload - Full sales voucher payload (see tally.validator.js)
   */
  async createSalesInvoice(tenantId, invoicePayload) {
    return connectorGateway.dispatchJob(tenantId, 'CREATE_SALES_VOUCHER', invoicePayload, 45000);
  }

  async createReceipt(tenantId, receiptPayload) {
    return connectorGateway.dispatchJob(tenantId, 'CREATE_RECEIPT', receiptPayload);
  }

  async createCreditNote(tenantId, creditNotePayload) {
    return connectorGateway.dispatchJob(tenantId, 'CREATE_CREDIT_NOTE', creditNotePayload);
  }

  async createPurchaseInvoice(tenantId, purchasePayload) {
    return connectorGateway.dispatchJob(tenantId, 'CREATE_PURCHASE_VOUCHER', purchasePayload);
  }

  // =========================================================================
  // COMPOSITE — Order-to-Tally Pipeline
  // =========================================================================

  /**
   * Convert an ERP order (with order items, customer, products) into a Tally
   * sales invoice payload and dispatch it.
   *
   * This is the main entry point called from the order confirmation hook.
   *
   * @param {string} tenantId
   * @param {object} order          - ERP Order record (with items, customer)
   * @param {object} tallyConfig    - Tenant-specific Tally configuration
   *   @param {string}  tallyConfig.salesLedgerName    - "Sales" or "Sales @ 18%"
   *   @param {string}  tallyConfig.companyState        - Company state for IGST determination
   *   @param {object}  tallyConfig.taxLedgers          - { cgst, sgst, igst } ledger name mapping
   *   @param {number}  [tallyConfig.defaultGstRate]     - Default GST rate if not per-product
   *   @param {string}  [tallyConfig.defaultGodown]      - Default godown name
   */
  async pushOrderToTally(tenantId, order, tallyConfig = {}) {
    const {
      salesLedgerName = 'Sales',
      companyState = '',
      taxLedgers = {},
      defaultGstRate = 0,
      defaultGodown = null,
      autoCreateMasters = false
    } = tallyConfig;

    // Optional: auto-create missing masters if requested
    if (autoCreateMasters) {
      if (order.customer?.name) {
        try {
          await this.createCustomer(tenantId, {
            name: order.customer.name,
            stateName: order.customer.state || companyState || 'Delhi',
            gstin: order.customer.gstin || '',
            address: order.shippingAddress || order.customer.address || '',
            mobile: order.customer.phone || '',
            email: order.customer.email || ''
          });
        } catch (err) {
          console.warn(`[Tally Service] Auto-create customer note: ${err.message}`);
        }
      }

      const rawItems = order.items || order.orderItems || [];
      for (const item of rawItems) {
        const itemName = item.productName || item.name || item.stockItemName;
        if (itemName) {
          try {
            await this.createStockItem(tenantId, {
              name: itemName,
              baseUnit: item.unit || 'nos',
              standardRate: Number(item.unitPrice || item.rate || item.price || 0),
              gstRate: defaultGstRate
            });
          } catch (err) {
            console.warn(`[Tally Service] Auto-create stock item note: ${err.message}`);
          }
        }
      }
    }

    // Determine GST type based on company state vs customer state
    const customerState = order.customer?.state || order.customerState || '';
    const isInterstate = companyState && customerState &&
      companyState.toLowerCase() !== customerState.toLowerCase();
    const gstType = isInterstate ? 'INTERSTATE' : 'LOCAL';

    // Build line items
    const items = (order.items || order.orderItems || []).map(item => ({
      stockItemName: item.productName || item.name || item.stockItemName,
      quantity: Number(item.quantity),
      unit: item.unit || 'nos',
      rate: Number(item.unitPrice || item.rate || item.price),
      amount: Number(item.quantity) * Number(item.unitPrice || item.rate || item.price)
    }));

    const taxableAmount = items.reduce((s, i) => s + i.amount, 0);
    const gstRate = defaultGstRate;

    // Build GST block
    let gst = { applicable: false };
    if (gstRate > 0) {
      const totalTax = +(taxableAmount * gstRate / 100).toFixed(2);
      if (gstType === 'LOCAL') {
        const half = +(totalTax / 2).toFixed(2);
        gst = {
          applicable: true,
          type: 'LOCAL',
          rate: gstRate,
          taxableAmount,
          cgst: { ledgerName: taxLedgers.cgst || 'CGST', amount: half },
          sgst: { ledgerName: taxLedgers.sgst || 'SGST', amount: +(totalTax - half).toFixed(2) }
        };
      } else {
        gst = {
          applicable: true,
          type: 'INTERSTATE',
          rate: gstRate,
          taxableAmount,
          igst: { ledgerName: taxLedgers.igst || 'IGST', amount: totalTax }
        };
      }
    }

    // Build the invoice date in YYYYMMDD
    const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
    const dateStr = orderDate.getFullYear().toString() +
      String(orderDate.getMonth() + 1).padStart(2, '0') +
      String(orderDate.getDate()).padStart(2, '0');

    const invoicePayload = {
      date: dateStr,
      voucherNumber: `DS-${order.orderNumber || order.id}`,
      reference: order.id,
      partyLedgerName: order.customer?.name || order.customerName,
      salesLedgerName,
      items,
      gst,
      narration: `WhatsApp order ${order.id} via DistroSync`,
      godownName: defaultGodown
    };

    return this.createSalesInvoice(tenantId, invoicePayload);
  }
}

const tallyService = new TallyService();
module.exports = tallyService;
