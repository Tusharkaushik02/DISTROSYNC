/**
 * TDL XML Templates for communicating with TallyPrime / Tally.ERP 9 HTTP Server
 *
 * READ templates (Export) — for fetching data from Tally
 * WRITE templates live in tally.write.templates.js
 */

// ---------------------------------------------------------------------------
// EXISTING READ TEMPLATES
// ---------------------------------------------------------------------------

// Request to list currently opened/loaded companies in Tally
const GET_COMPANIES_XML = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>List of Companies</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>
`.trim();

// Request to export stock items with quantities, rates, and units
const EXPORT_STOCK_ITEMS_XML = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Stock Item Collection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Stock Item Collection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>StockItem</TYPE>
            <FETCH>Name,Parent,BaseUnits,OpeningBalance,ClosingBalance,ClosingRate,ClosingValue,StandardPriceList</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
`.trim();

// Request to export ledgers (Customers / Sundry Debtors)
const EXPORT_LEDGERS_XML = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Ledger Collection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Ledger Collection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>Ledger</TYPE>
            <FETCH>Name,Parent,ClosingBalance,LedgerPhone,LedgerMobile,EMail,StateName,CountryName</FETCH>
            <FILTERS>IsDebtor</FILTERS>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsDebtor">$$IsSysNameEqual:$$GroupSundryDebtors:$Parent</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
`.trim();

// Request to export Sales Order vouchers
const EXPORT_SALES_ORDERS_XML = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SalesOrderCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SalesOrderCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>Voucher</TYPE>
            <FETCH>Date,VoucherNumber,PartyLedgerName,VoucherTypeName,Reference,Amount,AllInventoryEntries.List</FETCH>
            <FILTERS>IsSalesOrderVch</FILTERS>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsSalesOrderVch">$$IsSalesOrder:$VoucherTypeName</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
`.trim();

// ---------------------------------------------------------------------------
// NEW READ TEMPLATES
// ---------------------------------------------------------------------------

/**
 * Export active company details including GSTIN and state.
 * Used to determine local vs interstate GST routing.
 */
const EXPORT_COMPANY_INFO_XML = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>CompanyInfoCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="CompanyInfoCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>Company</TYPE>
            <FETCH>Name,BasicCompanyName,GSTRegistrationType,PartyGSTIN,StateName,CountryName,Address,StartingFrom,BookBeginningFrom,CurrentPeriodFrom,CurrentPeriodTo</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
`.trim();

/**
 * Export supplier ledgers (Sundry Creditors).
 */
const EXPORT_SUPPLIERS_XML = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SupplierCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SupplierCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>Ledger</TYPE>
            <FETCH>Name,Parent,ClosingBalance,LedgerPhone,LedgerMobile,EMail,StateName,PartyGSTIN</FETCH>
            <FILTERS>IsCreditor</FILTERS>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsCreditor">$$IsSysNameEqual:$$GroupSundryCreditors:$Parent</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
`.trim();

/**
 * Export Tax ledgers (Duties & Taxes group) — identifies CGST/SGST/IGST ledger names.
 * These names vary per Tally company setup so we must read them before writing invoices.
 */
const EXPORT_TAX_LEDGERS_XML = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>TaxLedgerCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="TaxLedgerCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>Ledger</TYPE>
            <FETCH>Name,Parent,GSTType,ClosingBalance</FETCH>
            <FILTERS>IsTaxLedger</FILTERS>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsTaxLedger">$$IsSysNameEqual:$$GroupDutiesTaxes:$Parent</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
`.trim();

/**
 * Export all ledgers, optionally filtered by group.
 * Pass a group name like "Bank Accounts", "Cash-in-Hand", "Sales Accounts", etc.
 * When group is empty this returns ALL ledgers (can be large).
 *
 * @param {string} [group] - Tally parent group to filter by
 */
function EXPORT_ALL_LEDGERS_XML(group = '') {
  const filterTag = group
    ? `<FILTERS>InGroup</FILTERS>`
    : '';
  const formulaTag = group
    ? `<SYSTEM TYPE="Formulae" NAME="InGroup">$$IsSysNameEqual:"${group}":$Parent</SYSTEM>`
    : '';

  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>AllLedgerCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="AllLedgerCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>Ledger</TYPE>
            <FETCH>Name,Parent,ClosingBalance,StateName,PartyGSTIN,LedgerMobile,EMail</FETCH>
            ${filterTag}
          </COLLECTION>
          ${formulaTag}
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
}

/**
 * Export units of measure.
 */
const EXPORT_UNITS_XML = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>UnitCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="UnitCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>Unit</TYPE>
            <FETCH>Name,FormalName,UOMType</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
`.trim();

/**
 * Export godowns (warehouses / storage locations).
 */
const EXPORT_GODOWNS_XML = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>GodownCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="GodownCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>Godown</TYPE>
            <FETCH>Name,Parent,Address</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
`.trim();

/**
 * Export outstanding bills for a specific party ledger.
 * Returns pending receivables (for customers) or payables (for suppliers).
 *
 * @param {string} partyName - Exact ledger name in Tally
 */
function EXPORT_LEDGER_OUTSTANDING_XML(partyName) {
  const escaped = partyName.replace(/"/g, '&quot;');
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>OutstandingCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="OutstandingCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>Ledger</TYPE>
            <FETCH>Name,ClosingBalance,BillDetails.List</FETCH>
            <FILTERS>IsThisParty</FILTERS>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsThisParty">$Name = "${escaped}"</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
}

/**
 * Export closing stock balance for a specific stock item.
 *
 * @param {string} itemName - Exact stock item name in Tally
 */
function EXPORT_STOCK_BALANCE_XML(itemName) {
  const escaped = itemName.replace(/"/g, '&quot;');
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>StockBalanceCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="StockBalanceCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>StockItem</TYPE>
            <FETCH>Name,BaseUnits,ClosingBalance,ClosingRate,ClosingValue</FETCH>
            <FILTERS>IsThisItem</FILTERS>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsThisItem">$Name = "${escaped}"</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
}

module.exports = {
  // Original
  GET_COMPANIES_XML,
  EXPORT_STOCK_ITEMS_XML,
  EXPORT_LEDGERS_XML,
  EXPORT_SALES_ORDERS_XML,
  // New READ templates
  EXPORT_COMPANY_INFO_XML,
  EXPORT_SUPPLIERS_XML,
  EXPORT_TAX_LEDGERS_XML,
  EXPORT_ALL_LEDGERS_XML,
  EXPORT_UNITS_XML,
  EXPORT_GODOWNS_XML,
  EXPORT_LEDGER_OUTSTANDING_XML,
  EXPORT_STOCK_BALANCE_XML
};

