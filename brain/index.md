# Brain Index

_Auto-generated. Last updated 2026-09-11T12:09:07.823Z._

- [canonical-event-model](pages/canonical-event-model.md) — category: decision | tags: [architecture, whatsapp, messaging] | Inbound WhatsApp payloads differ significantly between providers (Twilio URL-encoded form, Meta Cloud API JSON, 360dialog JSON).
- [erp-plugin-architecture](pages/erp-plugin-architecture.md) — category: concept | tags: [erp, plugins, architecture, connector, tally] | The ERP Plugin layer is the mechanism by which DISTROSYNC's normalized order data is synced into a customer's actual on-premise or cloud ERP
- [known-bugs-tech-debt](pages/known-bugs-tech-debt.md) — category: project | tags: [bugs, debt, quality] | Active bugs and tech debt items as of September 2026 audit.
- [multi-tenant-data-model](pages/multi-tenant-data-model.md) — category: concept | tags: [architecture, multi-tenant, database, security] | Each distributor business is a **tenant**, identified by a `tenantId` (Company UUID).
- [persistent-conversation-memory](pages/persistent-conversation-memory.md) — category: decision | tags: [architecture, ai, memory, database] | Conversation history is NOT kept in-process memory. Every user message and assistant response is immediately persisted to PostgreSQL (`distr
- [rag-hybrid-search](pages/rag-hybrid-search.md) — category: concept | tags: [ai, rag, search, vector] | The RAG (Retrieval-Augmented Generation) pipeline allows the AI to answer questions from uploaded business documents (product catalogs, pric
- [synchronous-http-service-mesh](pages/synchronous-http-service-mesh.md) — category: decision | tags: [architecture, infrastructure, scalability] | Services communicate synchronously via HTTP REST ??? no message broker or event queue is currently deployed.
- [tally-connector-websocket-bridge](pages/tally-connector-websocket-bridge.md) — category: decision | tags: [architecture, erp, connector, websocket, tally] | On-premise ERP instances (TallyPrime / Tally.ERP 9) run inside local office or warehouse networks behind NAT and corporate firewalls. They d
- [tool-calling-over-direct-db](pages/tool-calling-over-direct-db.md) — category: decision | tags: [architecture, ai, erp] | The AI service never has direct SQL access to ERP databases. Instead, all business operations are abstracted into Pydantic-validated tool sc
