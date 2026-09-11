---
id: erp-plugin-architecture
title: ERP Plugin and Connector Architecture
category: concept
status: active
tags: [erp, plugins, architecture, connector, tally]
created: "2026-09-09T19:45:01"
updated: "2026-09-11T17:31:15"
---


<!-- compiled_truth -->
The ERP Plugin layer is the mechanism by which DISTROSYNC's normalized order data is synced into a customer's actual on-premise or cloud ERP.

**Current State (Implemented):**
- **TallyPrime Connector**: Fully implemented in `connector/` and `ERP-service/src/modules/connector/`.
- **Architecture**: Outbound persistent WebSocket (`/ws/connector` on ERP-service :4002) allows on-premise connector behind corporate NAT/firewalls to connect to DISTROSYNC cloud without public IPs or port forwarding.
- **Tally Bridge**: Connector communicates with local TallyPrime / Tally.ERP 9 via HTTP XML on port 9000. Supports stock fetching (`EXPORT_STOCK_ITEMS_XML`), customer ledger queries (`EXPORT_LEDGERS_XML`), sales order queries (`EXPORT_SALES_ORDERS_XML` with voucher item normalization and XML control character entity sanitization), and company health checks.
- **Pairing Flow**: 1-click pairing via local web dashboard (`http://localhost:9123`), exchanging a 6-digit code for a secure token stored in `%APPDATA%/DistroSync/config.json`.
- **Packaging**: Packaged as a standalone Windows executable (`tally-connector.exe`) via `pkg` and `esbuild`, or runnable via Node.js development mode (`npm start`).

**Architecture Diagram:**

```
AI-service (Tool Calls)
        |
        v  (normalized REST API)
ERP-service (:4002)
        |
        ^  (Outbound Persistent WebSocket /ws/connector)
DistroSync Connector Agent (On-Premise Windows Daemon / Local UI :9123)
        |
        v  (Local HTTP XML POST)
TallyPrime / Tally.ERP 9 (Localhost:9000)
```

**Supported ERP Types:** TALLY | BUSY | MARG | SAP | ORACLE | CUSTOM

**Design Invariant:** The AI LLM tooling ([[tool-calling-over-direct-db]]) remains completely decoupled from ERP-specific implementations. AI tools call normalized ERP-service endpoints; the connector gateway dispatches sync jobs across the WebSocket bridge to the on-premise agent.


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

- time: 2026-09-09T20:19:05
  kind: decision
  summary: Tally connector implemented with WebSocket gateway and Tally XML bridge
  source: brain update-truth
  affects: [erp-plugin-architecture]

- time: 2026-09-09T20:46:30
  kind: note
  summary: "WhatsApp order creation writes to DistroSync PostgreSQL; automatic Tally voucher entry requires voucher template dispatch"
  affects: [erp-plugin-architecture]

- time: 2026-09-10T19:56:21
  kind: decision
  summary: "Implemented FETCH_SALES_ORDERS: Sales Order collection TDL query, XML control entity sanitization, and order normalization"
  affects: [erp-plugin-architecture]

- time: 2026-09-10T19:56:28
  kind: decision
  summary: "Added sales order query (EXPORT_SALES_ORDERS_XML) and control entity sanitization"
  source: brain update-truth
  affects: [erp-plugin-architecture]

- time: 2026-09-11T17:31:06
  kind: decision
  summary: "Tally connector implemented with WebSocket gateway, sales order queries, and standalone exe build"
  source: brain update-truth
  affects: [erp-plugin-architecture]
