---
slug: stack
title: Tech stack
role: tech-stack choices
updated: "2026-09-11T17:35:50"
---

# Tech stack

## Technology Choices

| Domain | Choice | Rationale |
|--------|--------|-----------|
| **WhatsApp Messaging** | Twilio WhatsApp Sandbox (dev); Meta Cloud API (planned prod) | Twilio provides immediate dev sandbox with webhooks; Meta is the official production path |
| **LLM Provider** | Groq Cloud (`openai/gpt-oss-120b`, Llama3 fallback) | Fast inference latency; OpenAI-compatible function calling API; cost-effective |
| **LLM Orchestration** | Custom Python `ConversationOrchestrator` with multi-turn tool loop | Fine-grained control over tool execution, idempotency, and memory integration |
| **AI Service Framework** | FastAPI (Python 3.12) | Async-native, Pydantic validation, auto-generated OpenAPI docs |
| **Cloud Node Services** | Express.js (Node 20 LTS) | Lightweight, team familiarity, large ecosystem for WhatsApp/ERP integrations |
| **On-Premise Connector** | Node.js, `ws`, Express :9123, `pkg`, `esbuild` | Zero-dependency Windows `.exe` distribution with local web pairing dashboard |
| **Tally Integration** | HTTP XML POST to localhost:9000 (TDL XML templates) | Standard non-intrusive bridge supported by TallyPrime and Tally.ERP 9 |
| **ORM (Node services)** | Prisma | Type-safe schema-first migrations, excellent PostgreSQL support |
| **ORM (AI service)** | Raw asyncpg + Prisma for migrations | asyncpg for maximum async performance; Prisma only for schema migrations |
| **Primary Database** | PostgreSQL 17 (3 isolated instances) | ACID transactions for orders, JSON support, mature ecosystem |
| **Session/Cache Store** | Redis 7 Alpine | Fast OTP expiry, JWT session blacklisting, ephemeral data |
| **Vector Store (RAG)** | Qdrant (local/embedded mode) | No external service dependency; hybrid search support (dense + sparse) |
| **Embedding Model** | SentenceTransformers `BAAI/bge-small-en-v1.5` | Small footprint, good multilingual performance, runs locally |
| **Sparse Ranking** | BM25 Okapi (custom Python implementation) | Combined with dense vectors for hybrid retrieval (0.7 dense + 0.3 sparse weighting) |
| **PDF Extraction** | pypdf | Lightweight, pure Python, no native dependencies |
| **Auth Strategy** | JWT (access + refresh tokens) in HTTP-only cookies + OTP email verification | Stateless verification with Redis-backed refresh token rotation |
| **Connector Auth** | 6-digit one-time pairing code exchanging for persistent secret token | Frictionless SME onboarding without manual API key entry |
| **Containerization** | Docker + Docker Compose | Unified multi-service orchestration for dev and deployment |
| **API Security** | `x-service-key` header for inter-service auth; Twilio signature verification for webhooks | Simple shared secret for service mesh; cryptographic webhook validation |

## Open Technology Questions

- **Message Broker**: RabbitMQ vs. Kafka for async webhook processing (deferred to Milestone 8)
- **API Gateway**: Kong vs. Traefik for unified routing and rate limiting (deferred to production)
- **Monitoring/Observability**: No APM, structured logging, or distributed tracing yet
- **CI/CD**: No pipeline defined; tests run manually
