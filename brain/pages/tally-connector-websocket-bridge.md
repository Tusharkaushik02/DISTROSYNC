---
id: tally-connector-websocket-bridge
title: Outbound WebSocket Bridge for On-Premise Tally ERP Integration
category: decision
status: active
tags: [architecture, erp, connector, websocket, tally]
created: "2026-09-11T17:31:25"
updated: "2026-09-11T17:31:53"
updated: "2026-09-11T18:50:17"
---


<!-- compiled_truth -->
On-premise ERP instances (TallyPrime / Tally.ERP 9) run inside local office or warehouse networks behind NAT and corporate firewalls. They do not possess public static IPs or open inbound ports.

**Decision: Outbound Persistent WebSocket Gateway (`/ws/connector`)**
Rather than requiring distributors to configure router port forwarding, DDNS, or inbound VPNs, the on-premise DistroSync Connector agent initiates an **outbound persistent WebSocket** connection from the distributor's machine to the cloud `ERP-service` on port 4002.

**Key Components & Behaviors:**
1. **Firewall & NAT Traversal**: Outbound HTTP/WS traffic on standard ports is permitted by default in almost all corporate and SME network environments.
2. **Pairing Workflow**:
   - Cloud dashboard issues a temporary 6-digit pairing code (e.g. `DS-9A3F12`) via `POST /api/v1/connector/pair-code`.
   - On first launch, the connector starts a local UI on `http://localhost:9123` and auto-launches the user's browser.
   - User inputs pairing code; connector calls `POST /api/v1/connector/pair` to exchange code for a persistent authentication token and `companyId`.
   - Persistent credentials saved locally in `%APPDATA%/DistroSync/config.json`.
3. **Bi-directional RPC Over WebSocket**:
   - Connector authenticates WebSocket handshake via bearer token / query param.
   - Cloud dispatches commands (`FETCH_STOCK_ITEMS`, `FETCH_LEDGERS`, `FETCH_SALES_ORDERS`, `EXECUTE_XML`).
   - Connector calls local Tally HTTP XML server at `http://localhost:9000` via HTTP POST and streams normalized JSON results back over the socket.
4. **Resilience**:
   - Heartbeat ping/pong intervals verify connectivity.
   - Automatic reconnect with exponential backoff on disconnect.
5. **Zero Dependency Packaging**:
   - Packaged as a standalone Windows executable (`tally-connector.exe`) using `esbuild` and `pkg`.
   - No requirement for customer to install Node.js, npm, or Python.


## Timeline

- time: 2026-09-11T17:31:25
  kind: decision
  summary: "Created this page: Outbound WebSocket Bridge for On-Premise Tally ERP Integration"
  source: "connector/README.md; ERP-service/src/modules/connector"
  affects: [tally-connector-websocket-bridge]

- time: 2026-09-11T17:31:53
  kind: decision
  summary: Decided on outbound persistent WebSocket architecture with local 9123 pairing UI and Tally 9000 XML bridge
  source: brain update-truth
  affects: [tally-connector-websocket-bridge]

- time: 2026-09-11T18:50:17
  kind: decision
  summary: "Implemented comprehensive Tally write pipeline: sales vouchers, masters (customers, suppliers, stock items), receipts, credit notes, voucher cache idempotency, and automated ERP order confirmation hook"
  affects: [tally-connector-websocket-bridge]
