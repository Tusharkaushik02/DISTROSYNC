---
id: known-bugs-tech-debt
title: Known Bugs and Technical Debt
category: project
status: active
tags: [bugs, debt, quality]
created: "2026-09-09T19:46:18"
updated: "2026-09-11T17:33:36"
---

<!-- compiled_truth -->
Active bugs and tech debt items as of September 2026 audit.

## Resolved Items

### BUG-1: user-service `getCurrentUser` missing export (RESOLVED)
- **Status:** Resolved. `getCurrentUser` is properly exported in `user-service/src/services/auth.service.js`.

### DEBT-2: Twilio provider Jest mock scope error (RESOLVED)
- **Status:** Resolved. `mockTwilioFactory` defined before `jest.mock()` in `whatsapp-service/tests/providers/twilio.provider.test.js`.

## Active High Severity / Security

### DEBT-3: Hardcoded ERP service API key fallback
- **File:** `AI-service/app/core/config.py` (line ~26)
- **Impact:** Static fallback key `65c47afdd3eff0ebc554035a37dcf700e12c8fd7b634962ebf24126a5c5f08b5` is visible in source code.
- **Risk:** Credential leak if repo is exposed.
- **Fix:** Remove hardcoded fallback; fail startup if `SHARED_SERVICE_API_KEY` is not provided.

### DEBT-4: Missing multi-tenant isolation in Qdrant (RAG)
- **Impact:** Qdrant collections are not partitioned by `tenantId`. A search could potentially retrieve documents from another tenant.
- **Fix:** Add payload filter or collections namespaced by `tenantId`.

## Low Severity / Code Hygiene

### DEBT-5: Singular stub tool files superseded by plural implementations
- **Files:** `AI-service/app/tools/catalog_tool.py`, `customer_tool.py`, `inventory_tool.py`, `order_tool.py`
- **Impact:** Dead code stubs.
- **Fix:** Remove files.

### DEBT-6: Unused standalone intelligence stubs
- **Files:** `AI-service/app/intelligence/intent/intent_classifier.py`, `order_parser.py`, `entity_extractor.py`
- **Status:** Handled via LLM tool-calling schemas.
- **Fix:** Remove or deprecate.


## Timeline

- time: 2026-09-09T19:46:18
  kind: decision
  summary: "Created this page: Known Bugs and Technical Debt"
  source: DISTROSYNC_PROJECT_STATUS.md Part-26
  affects: [known-bugs-tech-debt]

- time: 2026-09-09T19:46:50
  kind: decision
  summary: Seeded 6 active bugs/debt items from September 2026 codebase audit
  source: DISTROSYNC_PROJECT_STATUS.md Part-26
  affects: [known-bugs-tech-debt]

- time: 2026-09-11T17:33:36
  kind: decision
  summary: "Marked BUG-1 and DEBT-2 resolved; confirmed active P0/P1 security and isolation items"
  source: brain update-truth
  affects: [known-bugs-tech-debt]
