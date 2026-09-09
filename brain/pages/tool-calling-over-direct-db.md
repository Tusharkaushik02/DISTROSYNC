---
id: tool-calling-over-direct-db
title: Decoupled LLM Tool Calling over Direct Database Access
category: decision
status: active
tags: [architecture, ai, erp]
created: "2026-09-09T19:35:55"
updated: "2026-09-09T19:36:28"
---

<!-- compiled_truth -->
The AI service never has direct SQL access to ERP databases. Instead, all business operations are abstracted into Pydantic-validated tool schemas that the LLM calls via the OpenAI function-calling protocol. The `ToolExecutor` then translates these calls into HTTP REST requests against the ERP-service.

**Why this matters:**
- **Backend ERP replacements** (swapping mock ERP for real Tally/SAP) require zero changes to AI prompts or orchestration code.
- **Security boundary**: the LLM cannot execute arbitrary SQL; it can only invoke pre-defined, validated tool functions.
- **Testability**: tools can be mocked independently of ERP infrastructure.

**Current tool inventory (9 tools):**
- `search_products` ??? catalog search by name/SKU
- `get_product_details` ??? full product info by ID
- `get_inventory` ??? stock availability check
- `get_customer` ??? customer lookup by phone
- `get_customer_orders` ??? order history for a customer
- `create_order` ??? place a new order (with inventory reservation)
- `get_order_status` ??? check order status
- `search_knowledge_base` ??? RAG hybrid search against uploaded documents

**Idempotency**: a SHA-256 cache on tool call arguments prevents duplicate side-effects (e.g., double order creation within the same orchestrator turn).

This decision is foundational ??? the entire ERP Plugin architecture ([[erp-plugin-architecture]]) depends on this abstraction layer remaining stable.


## Timeline

- time: 2026-09-09T19:35:55
  kind: decision
  summary: "Created this page: Decoupled LLM Tool Calling over Direct Database Access"
  source: "DISTROSYNC_PROJECT_STATUS.md ADR-1; code: AI-service/app/tools/"
  affects: [tool-calling-over-direct-db]

- time: 2026-09-09T19:36:28
  kind: decision
  summary: Seeded compiled truth from codebase analysis and ADR-1
  source: "DISTROSYNC_PROJECT_STATUS.md; AI-service/app/tools/registry.py"
  affects: [tool-calling-over-direct-db]
