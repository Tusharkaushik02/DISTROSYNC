---
id: multi-tenant-data-model
title: Multi-Tenant Data Model and Isolation Strategy
category: concept
status: active
tags: [architecture, multi-tenant, database, security]
created: "2026-09-09T19:47:01"
updated: "2026-09-09T19:47:28"
---

<!-- compiled_truth -->
Each distributor business is a **tenant**, identified by a `tenantId` (Company UUID). All business data in ERP-service is partitioned by `tenantId`.

**Tenant identity:**
- A `Company` record in the `user-service` database defines the tenant
- `Company.id` (UUID) is the canonical `tenantId` used across all services
- The default dev tenant is `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` (set as `DEFAULT_TENANT_ID` env var)

**Isolation in ERP-service (enforced):**
Every model (`Customer`, `Product`, `Inventory`, `Order`, `Document`) has a `tenantId` column. All queries include `WHERE tenantId = $tenantId`. Uniqueness constraints are scoped: e.g., `@@unique([tenantId, sku])` for products, `@@unique([tenantId, phone])` for customers.

**Isolation in AI-service (partial):**
- `Conversation` and `ConversationMessage` have a `tenant_id` column
- Memory queries currently filter only by `user_id` (WaId), not `tenant_id` ??? cross-tenant isolation is not yet enforced at query level (tracked in [[known-bugs-tech-debt]] as DEBT-4 variant)

**Isolation in Qdrant (missing):**
All tenants share the same vector collection. A search from one tenant could return another tenant's document chunks. Fix: partition by collection name per tenant, or add `tenant_id` payload filter to every search.

**Isolation in user-service:**
- `User` is linked 1:1 to a `Company` (`companyId` field)
- All auth tokens carry the company identity; config endpoints scope to the authenticated user's company

**HTTP propagation:**
The `tenantId` is propagated in service-to-service calls via the `x-tenant-id` header. The AI-service `ConversationOrchestrator` reads `tenant_id` from the conversation request and forwards it with every ERP tool call.

**Per-company WhatsApp and ERP configuration:**
- `WhatsAppConfiguration` (1:1 with Company) ??? stores Twilio/Meta credentials, webhook tokens, connection status
- `ERPConfiguration` (1:1 with Company) ??? stores `erpType`, `pluginName`, `connectionConfig JSON`, connection status


## Timeline

- time: 2026-09-09T19:47:01
  kind: decision
  summary: "Created this page: Multi-Tenant Data Model and Isolation Strategy"
  source: "DISTROSYNC_PROJECT_STATUS.md Part-11; ERP-service/prisma/schema.prisma; user-service/prisma/schema.prisma"
  affects: [multi-tenant-data-model]

- time: 2026-09-09T19:47:28
  kind: decision
  summary: "Seeded concept: tenantId propagation, ERP isolation (enforced), AI/Qdrant isolation (partial/missing)"
  source: "ERP-service/prisma/schema.prisma; user-service/prisma/schema.prisma; AI-service/app/memory/"
  affects: [multi-tenant-data-model]
