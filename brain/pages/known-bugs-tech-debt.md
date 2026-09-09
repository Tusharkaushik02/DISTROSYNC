---
id: known-bugs-tech-debt
title: Known Bugs and Technical Debt
category: project
status: active
tags: [bugs, debt, quality]
created: "2026-09-09T19:46:18"
updated: "2026-09-09T19:46:50"
---

<!-- compiled_truth -->
Active bugs and tech debt items as of September 2026 audit. Update this page when items are resolved (append a `kind: reversal` timeline entry).

## High Severity

### BUG-1: user-service `getCurrentUser` missing export
- **File:** `user-service/src/services/auth.service.js` (lines 368-400)
- **Impact:** `GET /auth/me` endpoint always throws a 500 runtime error ??? user profile retrieval is broken
- **Fix:** Add `getCurrentUser` to `module.exports`
- **Complexity:** Low (5-minute fix)

## Medium Severity

### DEBT-2: Twilio provider Jest mock scope error
- **File:** `whatsapp-service/tests/providers/twilio.provider.test.js` (line 17)
- **Impact:** 1 test suite fails (out of 15) ??? `twilioFactory` referenced outside Jest mock factory scope
- **Status:** 175/176 tests pass; this prevents 100% green
- **Fix:** Move the factory variable inside the mock factory function

### DEBT-3: Hardcoded ERP service API key fallback
- **File:** `AI-service/app/core/config.py` (line ~26)
- **Impact:** Static key `65c47afdd3eff0ebc554035a37dcf700e12c8fd7b634962ebf24126a5c5f08b5` is visible in source code as a fallback value
- **Risk:** If repo is ever public, this becomes a credential leak
- **Fix:** Remove hardcoded fallback; require `SHARED_SERVICE_API_KEY` env var to be set; fail startup if missing

### DEBT-4: Missing multi-tenant isolation in Qdrant (RAG)
- **Impact:** All tenants share the same Qdrant vector collection ??? a search from tenant A could potentially return tenant B's documents
- **Fix:** Namespace Qdrant collections by `tenantId` or add payload filter on `tenant_id` metadata field

## Low Severity

### DEBT-5: Singular stub tool files superseded by plural implementations
- **Files:** `AI-service/app/tools/catalog_tool.py`, `customer_tool.py`, `inventory_tool.py`, `order_tool.py`
- **Impact:** Dead code, confusion for new contributors
- **Fix:** Delete these 4 empty stub files

### DEBT-6: Unused standalone intelligence stubs
- **Files:** `AI-service/app/intelligence/intent/intent_classifier.py`, `order_parser.py`, `entity_extractor.py`
- **All contain:** `# Stub ??? not yet implemented.`
- **Status:** LLM function calling handles these natively; standalone stubs are obsolete
- **Fix:** Delete or formally decide to implement; don't leave indefinitely as stubs


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
