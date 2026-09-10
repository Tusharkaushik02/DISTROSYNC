---
slug: roadmap
title: Roadmap
role: milestones
updated: "2026-09-09T20:19:19"
---

# Roadmap

`mermaid
gantt
    title DISTROSYNC Implementation Roadmap
    dateFormat YYYY-MM-DD
    section Completed
    M1 LLM WhatsApp Conversation       :done, m1, 2026-08-01, 2026-08-15
    M2 PostgreSQL Conversation Memory   :done, m2, 2026-08-16, 2026-08-25
    M3 LLM Tool Calling and ERP Sync    :done, m3, 2026-08-26, 2026-09-02
    M4 Wire RAG Tool to AI Orchestrator :done, m4, 2026-09-03, 2026-09-06
    M6 First ERP Plugin Tally XML       :done, m6, 2026-09-07, 2026-09-09
    section Current
    M5 Unified Docker Compose and Tests :active, m5, 2026-09-07, 2026-09-18
    section Upcoming
    M7 Meta Cloud API Production        :m7, 2026-10-06, 2026-10-20
    M8 Async Message Queue RabbitMQ     :m8, 2026-10-21, 2026-11-10
`

## Milestone Details

### M1 ? LLM WhatsApp Conversation (DONE)
Twilio webhook pipeline, FastAPI AI-service, Groq LLM integration, bidirectional WhatsApp messaging.

### M2 ? PostgreSQL Conversation Memory (DONE)
asyncpg connection pooling, per-user message history keyed by WhatsApp phone number (WaId), configurable history limit (default 20).

### M3 ? LLM Tool Calling and ERP Sync (DONE)
8 Pydantic-validated tools (search_products, get_inventory, get_customer, create_order, etc.) calling ERP-service REST APIs. SHA-256 idempotency cache. Anti-hallucination system prompt policies.

### M4 ? RAG Tool Integration (DONE)
Exposed search_knowledge_base hybrid vector search as a callable tool in the LLM tool registry. 74 AI-service tests passing.

### M5 ? Unified Docker Compose and Integration Tests (ACTIVE)
Single docker-compose up spins up all 4 services + 3 PostgreSQL DBs + Redis. Healthchecks across all ports. End-to-end integration test suite.

### M6 ? First ERP Plugin: Tally XML (DONE)
Connector Gateway on ERP-service (/ws/connector). Tally Prime HTTP XML bridge on port 9000. Outbound WebSocket persistent connection for firewall/NAT traversal. Standalone Windows executable packager and pairing dashboard on port 9123.

### M7 ? Meta WhatsApp Cloud API (PLANNED)
Official Meta Graph API adapter for production WhatsApp. Replace Twilio Sandbox for real business phone numbers.

### M8 ? Async Message Queue (PLANNED)
RabbitMQ or Kafka for decoupling webhook ingestion from AI processing. Prevents Twilio webhook timeouts during slow LLM completions.
