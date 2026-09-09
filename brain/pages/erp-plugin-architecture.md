---
id: erp-plugin-architecture
title: ERP Plugin and Connector Architecture
category: concept
status: active
tags: [erp, plugins, architecture, planned]
created: "2026-09-09T19:45:01"
updated: "2026-09-09T19:45:28"
---

<!-- compiled_truth -->
The ERP Plugin layer is the mechanism by which DISTROSYNC's normalized order data is synced into a customer's actual on-premise or cloud ERP.

**Current state:** DATABASE SCHEMA ONLY. The `ERPConfiguration` model exists in `user-service/prisma/schema.prisma`, storing `erpType`, `pluginName`, and `connectionConfig (JSON)`. No connector driver code exists yet. Planned for Milestone 6.

**Architecture concept:**

```
AI-service (Tool Calls)
        |
        v  (normalized ERP REST API)
ERP-service (Core/Mock ERP)
        |
        v  (future: ERP Connector Manager)
ERP Plugin Adapters:
  - Tally Plugin (XML/HTTP/ODBC)
  - SAP Plugin (BAPI/RFC/OData)
  - Busy Plugin (REST/Direct DB)
  - Marg Plugin (JSON API)
  - Oracle NetSuite Plugin (SuiteTalk REST)
        |
        v
Customer On-Premise ERP
```

**Supported ERP types (enum in DB):** `TALLY | BUSY | MARG | SAP | ORACLE | CUSTOM`

**First implementation target (M6): Tally Prime XML bridge**
- Tally Prime exposes an HTTP XML server at `localhost:9000` (on the customer's machine)
- DISTROSYNC must send Tally XML voucher requests over HTTP to that local server
- Requires a self-hosted "Tally Sync Agent" that the distributor installs on their Tally PC (or a reverse tunnel approach)
- The key challenge is NAT traversal ??? Tally runs on-premise without a public IP

**Design invariant:** The AI LLM tooling (`[[tool-calling-over-direct-db]]`) must never be changed when adding a new ERP plugin. The AI calls normalized tools; the connector layer is purely a translation + transport concern below the ERP-service REST boundary.

**Connection config is stored as opaque JSON** in `connectionConfig` field ??? allows each plugin to define its own schema (e.g., `{ host, port, companyName }` for Tally vs. `{ clientId, clientSecret, sapHost }` for SAP).


## Timeline

- time: 2026-09-09T19:45:01
  kind: decision
  summary: "Created this page: ERP Plugin and Connector Architecture"
  source: "DISTROSYNC_PROJECT_STATUS.md Part-10; user-service/prisma/schema.prisma"
  affects: [erp-plugin-architecture]

- time: 2026-09-09T19:45:28
  kind: decision
  summary: "Seeded concept: plugin adapter layer, current state (schema only), Tally XML target for M6"
  source: "DISTROSYNC_PROJECT_STATUS.md Part-10; user-service/prisma/schema.prisma"
  affects: [erp-plugin-architecture]
