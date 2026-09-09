---
slug: architecture
title: System architecture
role: system architecture
updated: "2026-09-09T19:33:36"
---

# System architecture

## High-Level Architecture

`mermaid
graph TD
    subgraph External["External Services"]
        Customer["Retailer (WhatsApp)"]
        Twilio["Twilio / Meta WhatsApp Gateway"]
        Groq["Groq Cloud LLM"]
    end

    subgraph Services["Backend Microservices"]
        WA["whatsapp-service<br/>Node.js Express :4001"]
        AI["AI-service<br/>FastAPI Python :8000"]
        ERP["ERP-service<br/>Node.js Express :4002"]
        User["user-service<br/>Node.js Express :3000"]
    end

    subgraph Data["Persistence Layer"]
        PG_AI[("PostgreSQL<br/>distrosync_ai<br/>Conversations")]
        PG_ERP[("PostgreSQL<br/>distrosync_erp<br/>Business Entities")]
        PG_User[("PostgreSQL<br/>postgres<br/>Users & Tenants")]
        Qdrant[("Qdrant Local<br/>Vector Embeddings")]
        Redis[("Redis<br/>Sessions & OTP")]
    end

    Customer <-->|WhatsApp| Twilio
    Twilio -->|Webhook POST| WA
    WA -->|POST /api/v1/conversation| AI
    AI <-->|Tool Execution REST| ERP
    AI <-->|Chat Completion| Groq
    AI <--> PG_AI
    AI <--> Qdrant
    ERP <--> PG_ERP
    User <--> PG_User
    User <--> Redis
    WA -->|Send Reply| Twilio
`

## Service Responsibilities

| Service | Language / Framework | Port | Responsibility |
|---------|---------------------|------|----------------|
| **whatsapp-service** | Node.js / Express | :4001 | Twilio webhook ingestion, signature verification, payload normalization to CanonicalEvent, outbound messaging |
| **AI-service** | Python / FastAPI | :8000 | Conversation orchestration, Groq LLM multi-turn tool calling (up to 6 iterations), conversation memory (PostgreSQL asyncpg), RAG hybrid search (Qdrant + BM25) |
| **ERP-service** | Node.js / Express | :4002 | Tenant-scoped CRUD for Customers, Products, Inventory, Orders, Documents; transactional inventory reservation via Prisma |
| **user-service** | Node.js / Express | :3000 | OTP signup, JWT cookie auth, Redis session storage, Company/WhatsApp/ERP configuration management |

## Key Architectural Tenets

1. **Zero ERP Coupling in AI Core** ? The LLM operates against normalized domain tools (search_products, get_inventory, create_order). It never generates ERP-specific XML, SQL, or vendor API calls.
2. **Provider-Agnostic Messaging** ? Inbound payloads are normalized into a CanonicalEvent model. Switching from Twilio Sandbox to Meta Cloud API requires only a new boundary adapter.
3. **Multi-Tenant Data Isolation** ? Business entities are partitioned by 	enantId (Company UUID), enforced through HTTP middleware, repository query boundaries, and LLM tool execution contexts.
4. **Synchronous HTTP REST (Current Phase)** ? Services communicate via direct HTTP. Asynchronous message broker (RabbitMQ/Kafka) is planned for production scale.

## Database Isolation

Each service owns its own PostgreSQL database. There is no shared database ? services communicate only through HTTP REST APIs:
- distrosync_ai ? conversation history (AI-service)
- distrosync_erp ? business entities (ERP-service)
- postgres ? users, companies, config (user-service)
- Redis ? auth sessions and OTP codes (user-service)
- Qdrant local ? PDF/document vector embeddings (AI-service)
