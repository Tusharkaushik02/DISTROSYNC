---
id: synchronous-http-service-mesh
title: "Synchronous HTTP REST for Inter-Service Communication (Current Phase)"
category: decision
status: active
tags: [architecture, infrastructure, scalability]
created: "2026-09-09T19:44:28"
updated: "2026-09-09T19:44:52"
---

<!-- compiled_truth -->
Services communicate synchronously via HTTP REST ??? no message broker or event queue is currently deployed.

**Topology:**
- `whatsapp-service` ??? `AI-service`: `POST /api/v1/conversation` (synchronous, blocks until AI responds)
- `AI-service` ??? `ERP-service`: individual REST calls per tool execution (synchronous)
- `user-service` ??? independent (no cross-service calls yet)

**Auth between services:** `x-service-key` header with a shared secret (`SHARED_SERVICE_API_KEY`) + `x-tenant-id` header for tenant scoping. The fallback default key is hardcoded in `AI-service/app/core/config.py` (known security debt).

**Why synchronous now:**
- Minimizes operational complexity during initial milestone verification ??? no broker infrastructure to run, no consumer group management, no DLQ.
- Twilio expects an HTTP 200 ACK within ~15 seconds. Current LLM latency fits this window.
- Milestone scope: prove the product works end-to-end before adding operational overhead.

**Known problem:** as LLM inference latency grows or traffic spikes, synchronous Twilio webhook calls will start timing out. This is the primary driver for Milestone 8 (RabbitMQ/Kafka async queue).

**Planned evolution (M8):**
- WhatsApp service publishes an inbound event to RabbitMQ, immediately ACKs Twilio with HTTP 200.
- AI service consumes events asynchronously, processes, and publishes response events.
- WhatsApp service consumes response events and delivers outbound messages.

This decision will be reversed when M8 is implemented ??? update this page with `kind: reversal` at that time.


## Timeline

- time: 2026-09-09T19:44:28
  kind: decision
  summary: "Created this page: Synchronous HTTP REST for Inter-Service Communication (Current Phase)"
  source: "DISTROSYNC_PROJECT_STATUS.md ADR-4; docker-compose.yml"
  affects: [synchronous-http-service-mesh]

- time: 2026-09-09T19:44:52
  kind: decision
  summary: "Seeded compiled truth: sync REST rationale, topology, known timeout risk, M8 migration plan"
  source: "DISTROSYNC_PROJECT_STATUS.md ADR-4; docker-compose.yml"
  affects: [synchronous-http-service-mesh]
