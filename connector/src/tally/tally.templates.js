/**
 * TDL XML Templates for communicating with TallyPrime / Tally.ERP 9 HTTP Server
 */

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

module.exports = {
  GET_COMPANIES_XML,
  EXPORT_STOCK_ITEMS_XML,
  EXPORT_LEDGERS_XML,
  EXPORT_SALES_ORDERS_XML
};

