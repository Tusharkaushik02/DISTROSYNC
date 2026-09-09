---
id: persistent-conversation-memory
title: Stateless Orchestration with Persistent PostgreSQL Conversation Memory
category: decision
status: active
tags: [architecture, ai, memory, database]
created: "2026-09-09T19:43:48"
updated: "2026-09-09T19:44:20"
---

<!-- compiled_truth -->
Conversation history is NOT kept in-process memory. Every user message and assistant response is immediately persisted to PostgreSQL (`distrosync_ai` database, `ConversationMessage` table), keyed by WhatsApp phone number (`user_id` = `WaId`).

**At the start of every orchestrator turn:** `SELECT ... WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20` loads the last 20 messages and injects them into the LLM context window.

**Why PostgreSQL, not in-process:**
- In-process chat history is lost on any service restart, container redeploy, or crash ??? unacceptable for a production conversation product.
- PostgreSQL gives ACID durability, easy query debugging, and future analytics/audit capabilities.

**Why asyncpg (not Prisma) for AI-service reads/writes:**
- The AI service is Python/FastAPI. Prisma JS ORM doesn't run natively in Python.
- asyncpg is used for runtime queries (maximum async performance, no ORM overhead).
- Prisma is used only for schema migrations (via the `prisma` Node.js CLI invoked in the Dockerfile).

**Schema:**
- `Conversation { id, user_id (WaId), tenant_id, created_at }`
- `ConversationMessage { id, conversation_id, role (user|assistant), content, created_at }`

**Memory isolation:** Each `user_id` is a distinct WhatsApp number ??? histories are completely isolated. Multi-tenant partitioning by `tenant_id` is also present in schema but not yet fully enforced at query level (tracked as known gap).

**History limit:** Configurable via `CONVERSATION_HISTORY_LIMIT` env var (default: 20). Sliding window summarization for long dialogues is planned but not yet implemented.


## Timeline

- time: 2026-09-09T19:43:48
  kind: decision
  summary: "Created this page: Stateless Orchestration with Persistent PostgreSQL Conversation Memory"
  source: "DISTROSYNC_PROJECT_STATUS.md ADR-3; AI-service/app/memory/repository.py"
  affects: [persistent-conversation-memory]

- time: 2026-09-09T19:44:20
  kind: decision
  summary: "Seeded compiled truth: asyncpg + PostgreSQL rationale, schema, isolation model"
  source: "DISTROSYNC_PROJECT_STATUS.md ADR-3; AI-service/app/memory/repository.py; AI-service/prisma/schema.prisma"
  affects: [persistent-conversation-memory]
