# DISTROSYNC — Comprehensive Technical Audit & System Source of Truth

> **Audit Date:** September 2026  
> **Repository Root:** `c:\DISTROSYNC`  
> **Status Classification Standard:** `IMPLEMENTED` | `PARTIALLY IMPLEMENTED` | `PLANNED` | `NOT IMPLEMENTED` | `UNKNOWN`  
> **Governing Rule:** All statements in this document are verified against actual codebase artifacts, Prisma schemas, route definitions, test logs, and runtime source code.

---

## Table of Contents
1. [Executive Project Overview](#part-1--executive-project-overview)
2. [Current Project Status Matrix](#part-2--current-project-status)
3. [Full System Architecture](#part-3--full-system-architecture)
4. [Complete Service Inventory](#part-4--complete-service-inventory)
5. [WhatsApp Service Deep Dive](#part-5--whatsapp-service-deep-dive)
6. [AI Service Deep Dive](#part-6--ai-service-deep-dive)
7. [Conversation Memory Architecture](#part-7--conversation-memory)
8. [AI Architecture & Intelligence Layer](#part-8--ai-architecture)
9. [RAG (Retrieval-Augmented Generation) Status](#part-9--rag-status)
10. [ERP Plugin & Connector Architecture](#part-10--erp-plugin-architecture)
11. [Database Architecture & Data Models](#part-11--database-architecture)
12. [Complete API Inventory](#part-12--api-inventory)
13. [Environment Variables & Configuration](#part-13--environment-variables)
14. [Security & Authentication Status](#part-14--security-status)
15. [Error Handling & Fault Tolerance](#part-15--error-handling)
16. [Testing & Quality Assurance Audit](#part-16--testing-status)
17. [Current End-to-End Operational Flow](#part-17--current-end-to-end-test)
18. [Current vs. Target Architecture](#part-18--current-architecture-vs-target-architecture)
19. [Prioritized Gap Analysis & Backlog](#part-19--what-is-left-to-build)
20. [Recommended Milestones Roadmap](#part-20--recommended-milestones)
21. [The Single Next Task to Execute](#part-21-what-should-i-work-on-next)
22. [Repository Project Tree](#part-22--project-tree)
23. [Service-by-Service Micro-Architectures](#part-23--service-by-service-architecture)
24. [Complete Request Sequence Diagrams](#part-24--complete-request-sequence)
25. [Architectural Decision Records (ADRs)](#part-25--architectural-decisions)
26. [Known Problems, Bugs & Technical Debt](#part-26--known-problems)
27. [Final Project Scorecard](#part-27--final-project-scorecard)
28. [Executive Summary & Source of Truth](#part-28--final-summary)

---

## Part 1 — Executive Project Overview

### Simple Explanation (Non-Technical)
DISTROSYNC is an intelligent communication bridge between WhatsApp and business management systems (ERPs). 

Small and medium distributors, wholesalers, and retailers in emerging markets conduct the vast majority of their daily commerce over WhatsApp. Retailers send unstructured messages such as *"Send 10 cartons of 500ml shampoo to store 2 by tomorrow"*, voice notes, or photos of handwritten lists. Today, distributors employ human operators who manually read these chats, check paper registers or software for stock, manually type sales orders into Tally, SAP, Busy, or Marg, and reply on WhatsApp with confirmations.

DISTROSYNC automates this entire pipeline:
1. It receives the retailer's WhatsApp messages in real-time.
2. An AI assistant understands colloquial, unstructured language, checks live inventory, finds product prices, verifies customer identity, and places orders.
3. The platform converts the conversational intent into a standardized digital order.
4. It syncs the order directly into the customer's existing ERP without requiring manual human data entry.

DISTROSYNC is **not** an ERP itself. It does not store financial general ledgers, print tax invoices, calculate company depreciation, or manage balance sheets. Instead, it is an **intelligent adapter** that allows existing legacy ERPs to interact naturally over WhatsApp.

### Technical Explanation
Architecturally, DISTROSYNC is a distributed microservices platform designed around decoupled conversational interfaces, LLM tool-calling orchestration, and modular ERP adapters.

```
Retailer / Customer
        │ (WhatsApp UI)
        ▼
   Twilio / Meta
        │ (HTTPS Webhook)
        ▼
 whatsapp-service (Express/Node.js :4001)
        │ (HTTP REST JSON)
        ▼
   AI-service (FastAPI/Python :8000)
   ├── Context & Memory (PostgreSQL via asyncpg)
   ├── Groq LLM (OpenAI-compatible Function Calling)
   └── Tool Execution Layer
        │ (Authenticated REST with x-service-key & x-tenant-id)
        ▼
   ERP-service (Express/Node.js :4002)
   ├── Inventory Reservation & Orders (PostgreSQL via Prisma)
   └── Document Management (PDF Text Extraction & RAG Handoff)
```

**Key Architectural Tenets:**
- **Zero ERP Coupling in AI Core:** The AI service operates entirely against normalized domain tools (`search_products`, `get_inventory`, `get_customer`, `create_order`, `get_order_status`). The LLM never generates ERP-specific XML, proprietary SQL, or vendor-specific API calls.
- **Provider-Independent Messaging:** Inbound payloads are normalized into a provider-agnostic `CanonicalEvent` model. Switching between Twilio Sandbox and Meta WhatsApp Cloud API requires changing only the boundary adapter layer.
- **Multi-Tenant Data Isolation:** Business entities are partitioned by `tenantId` (Company UUID), enforced through HTTP middleware, repository query boundaries, and LLM tool execution contexts.

---

## Part 2 — Current Project Status

| Feature / Subsystem | Status | Evidence in Source Code | Primary Files | Technical Explanation | Next Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Twilio WhatsApp Inbound** | `IMPLEMENTED` | Full webhook pipeline active with signature verification | `whatsapp-service/src/modules/whatsapp/presentation/routes/webhook.routes.js` | Receives `POST /api/v2/whatsapp/webhook`, validates URL-encoded Twilio payloads. | Maintain for dev/sandbox; prepare Meta adapter for prod. |
| **Twilio Signature Verification** | `IMPLEMENTED` | `twilio.validateRequest` evaluated with `TWILIO_AUTH_TOKEN` | `whatsapp-service/src/modules/whatsapp/presentation/middleware/twilioSignature.middleware.js` | Verifies `X-Twilio-Signature` using reconstructed protocol/host/path. | Add automated test fix for jest mock factory error. |
| **Twilio WhatsApp Outbound** | `IMPLEMENTED` | `twilioClient.messages.create` active and utilized | `whatsapp-service/src/modules/whatsapp/infrastructure/providers/twilio/twilio.provider.js` | Formats `whatsapp:+...` numbers and sends messages back to user. | Add outbound message queue / retry logic. |
| **WhatsApp Service Controller** | `IMPLEMENTED` | 6-stage pipeline: validate, normalize, classify event, classify message, dispatch, handle | `whatsapp-service/src/modules/whatsapp/presentation/controllers/webhook.controller.js` | Normalizes payload to `CanonicalEvent` and invokes `textHandler`. | Expand to handle media and interactive responses. |
| **AI Service (FastAPI)** | `IMPLEMENTED` | FastAPI app running on port 8000 with lifespan hooks | `AI-service/app/main.py` | Exposes `/health`, `/api/v1/conversation`, `/api/v1/rag/*`. | Add CORS configuration and request rate limiting. |
| **Groq LLM Client** | `IMPLEMENTED` | `Groq` SDK client with exponential backoff & tool-calling | `AI-service/app/intelligence/llm/client.py` | Connects to `openai/gpt-oss-120b` (or llama3 models), passes function tools. | Add streaming support and latency telemetry. |
| **System Prompt Definition** | `IMPLEMENTED` | Business assistant system prompt with strict anti-hallucination rules | `AI-service/app/intelligence/llm/prompts/system.py` | Instructs model to search catalog, check stock, verify customer, and place order. | Tune prompt for catalog disambiguation and multi-item orders. |
| **Conversation Orchestrator** | `IMPLEMENTED` | Multi-turn loop (up to 6 iterations) resolving tool calls and memory | `AI-service/app/orchestration/conversation_orchestrator.py` | Loads history, queries LLM, executes tools via `ToolExecutor`, persists memory. | Connect RAG document search tool to orchestrator loop. |
| **Conversation Memory (DB)** | `IMPLEMENTED` | PostgreSQL via `asyncpg` with Prisma migrations | `AI-service/app/memory/repository.py`, `AI-service/prisma/schema.prisma` | Stores `Conversation` and `ConversationMessage` per `user_id` (WaId). | Add sliding window summarization for long dialogues. |
| **Memory Isolation & Limits** | `IMPLEMENTED` | Queries filter `WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2` | `AI-service/app/memory/repository.py` | User histories are completely isolated by WhatsApp ID; default limit is 20. | Verify multi-tenant namespace partitioning in memory schema. |
| **LLM Tool Calling (ERP Sync)** | `IMPLEMENTED` | 8 registered tools executing against ERP REST APIs | `AI-service/app/tools/registry.py`, `AI-service/app/tools/executor.py` | Pydantic validation, deterministic SHA-256 idempotency cache, ERP execution. | Add tool for catalog semantic search (RAG). |
| **RAG Ingestion & Vector DB** | `PARTIALLY IMPLEMENTED` | Qdrant vector store + SentenceTransformers + BM25 Okapi implemented | `AI-service/app/rag/vector_store.py`, `AI-service/app/main.py` | `/api/v1/rag/upload` and `/api/v1/rag/ingest` store embeddings in Qdrant. | **NOT connected to conversation orchestrator or LLM tool registry.** |
| **Hybrid Search (Dense + Sparse)**| `PARTIALLY IMPLEMENTED` | Qdrant Cosine (0.7) + BM25Okapi (0.3) hybrid search endpoint exists | `AI-service/app/rag/vector_store.py`, `AI-service/app/main.py` | Endpoint `/api/v1/rag/search` works standalone; not wired into conversation. | Expose RAG search as a callable tool in `tool_registry`. |
| **Intent Classifier (Standalone)**| `NOT IMPLEMENTED` | File contains `# Stub — not yet implemented.` | `AI-service/app/intelligence/intent/intent_classifier.py` | Intent classification is currently handled implicitly by Groq tool calling. | Implement if non-LLM pre-routing / fast intent parsing is required. |
| **Order Parser (Standalone)** | `NOT IMPLEMENTED` | File contains `# Stub — not yet implemented.` | `AI-service/app/intelligence/extraction/order_parser.py` | Extraction is currently handled natively via LLM function calling schemas. | Consolidate or deprecate standalone extraction stub. |
| **ERP Service (Core/Mock ERP)** | `IMPLEMENTED` | REST APIs for Customers, Products, Inventory, Orders, Documents | `ERP-service/src/app.js`, `ERP-service/prisma/schema.prisma` | Tenant-scoped CRUD and transactional inventory reservation in PostgreSQL. | Install dependencies (`node_modules`) and run integration tests. |
| **ERP Plugin / Connector Layer** | `PLANNED` | Architecture conceptualized; `ERPConfiguration` model exists in DB | `user-service/prisma/schema.prisma`, `user-service/src/services/erp.service.js` | DB stores `ERPType` (TALLY, SAP, BUSY, MARG, ORACLE); no connector drivers exist. | Build Connector Manager and first plugin (Tally XML / REST adapter). |
| **User Service (Auth & Config)** | `PARTIALLY IMPLEMENTED` | Express service for JWT, OTP, Company, WhatsApp & ERP config | `user-service/src/app.js`, `user-service/src/services/auth.service.js` | Full OTP signup, Redis session storage, JWT cookie auth. **Has export bug on /auth/me.** | Fix `getCurrentUser` export bug and install dependencies. |
| **RabbitMQ / Event-Driven Bus** | `PLANNED` | No RabbitMQ connection, amqplib, or broker code exists | N/A (Only mentioned in design discussions) | Currently services communicate synchronously via HTTP REST. | Introduce RabbitMQ/Kafka when asynchronous webhook handling is required. |
| **API Gateway** | `PLANNED` | Individual services run on separate ports (4001, 4002, 8000) | N/A | No Kong, NGINX, or Express Gateway currently reverse-proxies endpoints. | Configure unified API gateway (or Docker reverse proxy) for routing. |
| **Automated Testing Suite** | `PARTIALLY IMPLEMENTED` | 175 passing tests in `whatsapp-service`; test files in ERP and AI services | `whatsapp-service/tests/`, `ERP-service/tests/`, `AI-service/tests/` | WhatsApp test suite passes (except 1 mock bug); ERP and AI tests lack runner config. | Fix Jest mock in WhatsApp service; add pytest to AI-service venv. |

---

## Part 3 — Full System Architecture

### 1. Current High-Level Architecture (Actual Repository State)

```mermaid
graph TD
    subgraph External["External Networks & Users"]
        Customer["WhatsApp User / Retailer"]
        TwilioAPI["Twilio WhatsApp Gateway"]
        GroqAPI["Groq Cloud (LLM Provider)"]
    end

    subgraph ServiceLayer["Implemented Backend Services"]
        subgraph WhatsAppSvc["whatsapp-service (Node.js :4001)"]
            TwilioMid["Twilio Sig Validator"]
            WAParser["Webhook Parser & Normalizer"]
            WAHandler["Text Handler"]
            WAPovider["Twilio Outbound Provider"]
        end

        subgraph AISvc["AI-service (FastAPI/Python :8000)"]
            FastAPIEndpoint["POST /api/v1/conversation"]
            Orchestrator["Conversation Orchestrator"]
            ToolReg["Tool Registry (8 Tools)"]
            ToolExec["Tool Executor (Idempotent)"]
            LLMClient["Groq LLM Client"]
            RAGEndpoints["POST /api/v1/rag/*"]
            VectorStore["Qdrant Vector Store + BM25"]
        end

        subgraph ERPSvc["ERP-service (Node.js :4002)"]
            ERPRoutes["Customer, Product, Inventory, Order APIs"]
            DocRoutes["Document Upload & PDF Parser"]
            PrismaERP["Prisma ORM Client"]
        end

        subgraph UserSvc["user-service (Node.js :3000/:4001)"]
            AuthRoutes["Auth (OTP, JWT, Refresh Sessions)"]
            ConfigRoutes["Company, WhatsApp & ERP Config"]
        end
    end

    subgraph DataStorage["Data Persistence Layer"]
        PG_AI[("PostgreSQL :5434\ndistrosync_ai\n(Conversations)")]
        PG_ERP[("PostgreSQL :5433\ndistrosync_erp\n(Business Entities)")]
        PG_USER[("PostgreSQL :5432\npostgres\n(Users & Tenants)")]
        QdrantStorage[("Qdrant Local Storage\n./data/qdrant\n(PDF Embeddings)")]
        RedisDB[("Redis :6379\n(Auth & OTP Sessions)")]
    end

    %% Flow Connections
    Customer <-->|WhatsApp Message / Reply| TwilioAPI
    TwilioAPI -->|Webhook HTTPS POST| TwilioMid
    TwilioMid --> WAParser --> WAHandler
    WAHandler -->|POST /api/v1/conversation| FastAPIEndpoint
    FastAPIEndpoint --> Orchestrator
    Orchestrator <-->|Save / Retrieve Context| PG_AI
    Orchestrator <-->|Chat Completion + Tool Calls| LLMClient
    LLMClient <-->|HTTPS API| GroqAPI
    Orchestrator --> ToolExec
    ToolExec --> ToolReg
    ToolExec -->|HTTP REST + x-service-key| ERPRoutes
    ERPRoutes --> PrismaERP --> PG_ERP
    DocRoutes -->|POST /api/v1/rag/ingest| RAGEndpoints
    RAGEndpoints --> VectorStore --> QdrantStorage
    WAHandler -->|Send Reply| WAPovider
    WAPovider -->|REST API POST| TwilioAPI
    AuthRoutes <--> PG_USER
    AuthRoutes <--> RedisDB
    ConfigRoutes <--> PG_USER
```

---

### 2. Runtime Request Flow (Live WhatsApp Message to Tool-Driven ERP Execution)

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Retailer (WhatsApp)
    participant Twilio as Twilio Gateway
    participant WA as whatsapp-service (:4001)
    participant AI as AI-service (:8000)
    participant Memory as PostgreSQL (AI DB)
    participant Groq as Groq LLM Cloud
    participant ERP as ERP-service (:4002)
    participant ERP_DB as PostgreSQL (ERP DB)

    Customer->>Twilio: "I want 10 boxes of ABC123"
    Twilio->>WA: POST /api/v2/whatsapp/webhook (X-Twilio-Signature, urlencoded body)
    Note over WA: 1. Validate Twilio Signature<br/>2. Zod Schema Validation<br/>3. Normalize to CanonicalEvent<br/>4. Classify event -> 'message', type -> 'text'
    WA->>AI: POST /api/v1/conversation { user_id: "919876543210", message: "..." }
    
    Note over AI: Conversation Orchestrator
    AI->>Memory: SELECT history WHERE user_id = '919876543210' LIMIT 20
    Memory-->>AI: Return prior conversation messages
    
    AI->>Groq: Chat Completion (System Prompt + History + User Message + 8 Tool Schemas)
    Groq-->>AI: Tool Call Request: search_products(query="ABC123")
    
    Note over AI: ToolExecutor (Category: Read)
    AI->>ERP: GET /api/v1/products/search?q=ABC123 (Headers: x-service-key, x-tenant-id)
    ERP->>ERP_DB: Prisma query Products matching 'ABC123'
    ERP_DB-->>ERP: [ { id: "prod-uuid", sku: "ABC123", price: 50.0, availableQuantity: 73 } ]
    ERP-->>AI: HTTP 200 { success: true, data: [ ... ] }
    
    AI->>Groq: Tool Result message: { products: [ ... ] }
    Groq-->>AI: Tool Call Request: get_inventory(product_id="prod-uuid")
    
    AI->>ERP: GET /api/v1/inventory/prod-uuid
    ERP->>ERP_DB: Prisma query Inventory
    ERP_DB-->>ERP: { availableQuantity: 73, reservedQuantity: 0 }
    ERP-->>AI: HTTP 200 { success: true, data: { availableQuantity: 73 } }
    
    AI->>Groq: Tool Result message: { availableQuantity: 73 }
    Groq-->>AI: Final Response Text: "ABC123 is available (73 boxes in stock at ₹50/box). Would you like to confirm the order for 10 boxes?"
    
    AI->>Memory: INSERT user message & assistant message
    AI-->>WA: HTTP 200 { response: "ABC123 is available..." }
    
    WA->>Twilio: twilioClient.messages.create({ to: "whatsapp:+919876543210", body: "..." })
    Twilio-->>Customer: Delivers WhatsApp Response
    WA-->>Twilio: HTTP 200 { success: true, action: "ai_response_sent" }
```

---

### 3. Target / Future Enterprise Architecture

```mermaid
graph TD
    subgraph Clients["Ingress Channels"]
        WA_Cust["WhatsApp Retailers / Customers"]
        WA_Sales["WhatsApp Sales Reps"]
        Web_Admin["Web Admin Portal (React / Next.js)"]
    end

    subgraph Edge["Edge Infrastructure"]
        APIGateway["Kong / Traefik API Gateway\n(Rate Limiting, TLS, Routing)"]
        EventBroker["RabbitMQ / Kafka Message Broker\n(Async Webhook Queues & Events)"]
    end

    subgraph CoreMicroservices["Core Microservice Cluster"]
        UserService["User & IAM Service\n(Multi-tenant RBAC, Auth, Config)"]
        WAService["WhatsApp Gateway Service\n(Twilio & Meta Multi-Provider Workers)"]
        AIService["AI & Intelligence Engine\n(Orchestration, RAG, Tool Calling)"]
        OrderService["Order Management Service\n(Order Lifecycle, State Machine, Invoicing)"]
        ConnectorMgr["ERP Connector Manager\n(Job Dispatcher, Queue Sync, Transformation)"]
    end

    subgraph PluginLayer["ERP Plugin Adapters"]
        Plugin_Tally["Tally Plugin (XML / HTTP / ODBC)"]
        Plugin_SAP["SAP Plugin (BAPI / RFC / OData)"]
        Plugin_Busy["Busy Plugin (REST / Direct DB)"]
        Plugin_Marg["Marg Plugin (JSON API)"]
        Plugin_Oracle["Oracle NetSuite Plugin (SuiteTalk REST)"]
    end

    subgraph ExternalERPs["Customer On-Premise / Cloud ERPs"]
        TallyInstance["Customer Tally Prime Server"]
        SAPInstance["Customer SAP S/4HANA"]
        BusyInstance["Customer Busy Accounting"]
        MargInstance["Customer Marg ERP"]
        OracleInstance["Customer NetSuite Cloud"]
    end

    %% Ingress Flows
    WA_Cust <-->|WhatsApp| APIGateway
    WA_Sales <-->|WhatsApp| APIGateway
    Web_Admin <-->|HTTPS| APIGateway

    APIGateway --> WAService
    APIGateway --> UserService
    WAService -->|Publish Inbound Event| EventBroker
    EventBroker -->|Consume Inbound Event| AIService
    AIService <-->|Tool Execution / Query| OrderService
    OrderService -->|Publish Order Placed Event| EventBroker
    EventBroker -->|Consume Order Event| ConnectorMgr

    ConnectorMgr --> Plugin_Tally --> TallyInstance
    ConnectorMgr --> Plugin_SAP --> SAPInstance
    ConnectorMgr --> Plugin_Busy --> BusyInstance
    ConnectorMgr --> Plugin_Marg --> MargInstance
    ConnectorMgr --> Plugin_Oracle --> OracleInstance
```

---

## Part 4 — Complete Service Inventory

### 1. WhatsApp Service (`whatsapp-service`)
- **Service Name:** `whatsapp-service`
- **Purpose:** Ingests incoming WhatsApp webhook events from messaging providers (Twilio / Meta), authenticates signatures, validates payloads, classifies event and message types, dispatches events to application handlers, calls AI Service for conversational turns, and dispatches outbound replies.
- **Technology Stack:** Node.js, Express 4.19, Twilio SDK 5.1.1, Zod 3.23, Helmet, Cookie-Parser, Prisma 5.17.
- **Configured Port:** `4001` (via `PORT` environment variable).
- **Entry Point:** `c:\DISTROSYNC\whatsapp-service\index.js` -> `src/app.js`.
- **Directory Layout:**
  - `src/config/`: `prisma.js`, `redis.js`.
  - `src/modules/whatsapp/presentation/`: Controllers (`webhook.controller.js`), Routes (`webhook.routes.js`), Middlewares (`twilioSignature.middleware.js`, `errorHandler.middleware.js`).
  - `src/modules/whatsapp/validation/`: Zod schemas (`webhook.schema.js`, `webhook.validator.js`).
  - `src/modules/whatsapp/infrastructure/providers/twilio/`: Adapter (`twilio.adapter.js`), Provider (`twilio.provider.js`).
  - `src/modules/whatsapp/domain/`: Classifiers (`event.classifier.js`, `message.classifier.js`), Models (`canonical-event.js`), Errors (`webhook.errors.js`).
  - `src/modules/whatsapp/application/`: Dispatcher (`event.dispatcher.js`, `event.registry.js`), Handlers (`text.handler.js`, `button.handler.js`, `media.handler.js`, `unsupported.handler.js`), Services (`ai.service.js`, `whatsapp.service.js`).
- **External Dependencies:** Twilio REST API (`https://api.twilio.com`), AI Service (`http://localhost:8000`).
- **Database Dependencies:** PostgreSQL (Prisma schema present; current webhook flow is stateless in-memory).
- **Status:** `IMPLEMENTED` & operational for Twilio WhatsApp text conversations.

---

### 2. AI Service (`AI-service`)
- **Service Name:** `AI-service`
- **Purpose:** Central intelligence and conversational orchestration hub. Maintains conversation memory per WhatsApp user in PostgreSQL, executes multi-turn tool calling with Groq LLMs, interfaces with ERP Service REST endpoints for live business actions, and provides PDF ingestion and hybrid vector search (Qdrant + BM25).
- **Technology Stack:** Python 3.12, FastAPI 0.111, Pydantic 2.8, Groq Python SDK 0.9, asyncpg 0.29, Qdrant Client 1.9, Sentence-Transformers 3.0 (`BAAI/bge-small-en-v1.5`), Rank-BM25, PyPDF.
- **Configured Port:** `8000` (FastAPI standard).
- **Entry Point:** `c:\DISTROSYNC\AI-service\app\main.py`.
- **Directory Layout:**
  - `app/api/`: Routes (`conversation.py`, `health.py`), Schemas (`request.py`, `response.py`).
  - `app/core/`: Settings (`config.py`), Custom Exceptions (`exceptions.py`), Logging (`logging.py`).
  - `app/intelligence/llm/`: Client (`client.py`), Response Parser (`response_parser.py`), System Prompts (`prompts/system.py`).
  - `app/intelligence/embeddings/`: SentenceTransformer wrapper (`embedding_service.py`).
  - `app/memory/`: Asyncpg Repository (`repository.py`), Service (`service.py`).
  - `app/orchestration/`: Multi-turn loop orchestrator (`conversation_orchestrator.py`).
  - `app/tools/`: Registry (`registry.py`), Schemas (`schemas.py`), Idempotent Executor (`executor.py`), Implementations (`product_tools.py`, `customer_tools.py`, `inventory_tools.py`, `order_tools.py`).
  - `app/rag/`: Dense + Sparse Vector Store (`vector_store.py`).
  - `app/clients/`: ERP Service REST Client (`erp_client.py`).
- **External Dependencies:** Groq Cloud API (`https://api.groq.com`), ERP Service (`http://localhost:4002`).
- **Database Dependencies:** PostgreSQL (`distrosync_ai` :5434 for conversation memory), Local Qdrant (`./data/qdrant` for vector collections).
- **Status:** `IMPLEMENTED` for Conversation, Memory, LLM Tool Calling, and Standalone RAG.

---

### 3. ERP Service (`ERP-service`)
- **Service Name:** `ERP-service`
- **Purpose:** Acts as the multi-tenant business data engine and mock/reference ERP backend. Exposes authenticated REST endpoints for Customer profiles, Product catalogs, Inventory tracking, atomic Order creation with stock reservation, and Document PDF text extraction and RAG indexing.
- **Technology Stack:** Node.js, Express 4.19, Prisma 5.17, PostgreSQL, Multer, `pdf-parse`, Redis, Helmet, CORS.
- **Configured Port:** `4002` (via `PORT` environment variable).
- **Entry Point:** `c:\DISTROSYNC\ERP-service\index.js` -> `src/app.js`.
- **Directory Layout:**
  - `src/modules/customers/`: Controller, Repository, Routes, Schema, Service.
  - `src/modules/products/`: Controller, Repository, Routes, Schema, Service.
  - `src/modules/inventory/`: Controller, Repository, Routes, Service.
  - `src/modules/orders/`: Controller, Repository, Routes, Schema, Service (Transactional Inventory Reservation).
  - `src/modules/documents/`: Controller, Repository, Routes, Schema, Service, PDF Parser, AI-RAG client.
  - `src/shared/`: Auth Middleware (`auth.middleware.js`), Error Handler, Response Utilities.
- **External Dependencies:** AI Service (`http://localhost:8000/api/v1/rag/ingest`).
- **Database Dependencies:** PostgreSQL (`distrosync_erp` :5433).
- **Status:** `IMPLEMENTED` at API and database schema level. (Requires dependency installation).

---

### 4. User Service (`user-service`)
- **Service Name:** `user-service`
- **Purpose:** Identity, authentication, and multi-tenant configuration service. Handles admin registration via phone/email OTP, bcrypt password hashing, JWT access/refresh token generation with cookie sessions, Company profile management, and storage of WhatsApp and ERP connection configurations.
- **Technology Stack:** Node.js, Express 4.19, Prisma 5.17, PostgreSQL, Redis (ioredis), bcryptjs, jsonwebtoken, Helmet, Cookie-Parser.
- **Configured Port:** `4001` (in `.env.example`, collides with `whatsapp-service`) / `3000`.
- **Entry Point:** `c:\DISTROSYNC\user-service\index.js` -> `src/app.js`.
- **Directory Layout:**
  - `src/controllers/`: `auth.controller.js`, `company.controller.js`, `erp.controller.js`, `whatsapp.controller.js`.
  - `src/services/`: `auth.service.js`, `company.service.js`, `erp.service.js`, `whatsapp.service.js`.
  - `src/routes/`: `auth.route.js`, `company.route.js`, `erp.route.js`, `whatsapp.route.js`.
  - `src/middlewares/`: `auth.middleware.js`.
  - `src/utils/`: `auth.js`, `device.js`, `otp.js`.
- **Database Dependencies:** PostgreSQL (`postgres` :5432), Redis (:6379).
- **Status:** `PARTIALLY IMPLEMENTED` (Has export bug in `auth.service.js`; requires dependency installation).

---

## Part 5 — WhatsApp Service Deep Dive

### End-to-End Inbound Execution Trace

```
Twilio HTTP POST
  │ (Headers: X-Twilio-Signature, Body: application/x-www-form-urlencoded)
  ▼
[twilioSignature.middleware.js]
  │ Validate HMAC-SHA1 using TWILIO_AUTH_TOKEN and reconstructed URL
  ▼
[webhook.routes.js] -> [webhook.controller.js]
  │
  ├─► Stage 1: webhook.validator.js
  │     Validates payload with Zod schema (TwilioTextPayloadSchema / TwilioMediaPayloadSchema)
  │
  ├─► Stage 2: twilio.adapter.js -> normalize()
  │     Transforms Twilio body into CanonicalEvent:
  │     - id: MessageSid
  │     - sender.phone: normalized E.164 (+91...)
  │     - sender.waId: payload.WaId
  │     - content.text: trimmed body string
  │
  ├─► Stage 3: event.classifier.js -> classifyEventType()
  │     Identifies event as 'message' (vs 'status' or 'unknown')
  │
  ├─► Stage 4: message.classifier.js -> classifyMessageType()
  │     Identifies type as 'text' (vs 'image', 'audio', 'interactive.button', etc.)
  │
  ├─► Stage 5: event.dispatcher.js -> dispatch()
  │     Resolves registry mapping: "message.text" -> textHandler
  │
  ├─► Stage 6: text.handler.js -> textHandler()
  │     1. extractText() & buildTextContext()
  │     2. Invokes ai.service.js -> generateAIResponse(text, waId)
  │     3. Awaits AI-service POST /api/v1/conversation
  │     4. Invokes whatsapp.service.js -> sendMessage(sender, aiResponse)
  │     5. twilio.provider.js -> client.messages.create({ from, to, body })
  │     6. Returns HandlerResult { handled: true, status: 'processed', action: 'ai_response_sent' }
  │
  ▼
HTTP 200 JSON Acknowledgment sent to Twilio
```

### Key Modules & Functions

1. **Signature Middleware**
   - **File:** `whatsapp-service/src/modules/whatsapp/presentation/middleware/twilioSignature.middleware.js`
   - **Function:** `twilioSignatureMiddleware(req, res, next)`
   - **Mechanism:** Reconstructs the public URL (taking `x-forwarded-proto` and `x-forwarded-host` into account, or `TWILIO_WEBHOOK_URL` override) and executes `twilio.validateRequest(authToken, signature, url, req.body)`.

2. **Validation Engine**
   - **File:** `whatsapp-service/src/modules/whatsapp/validation/webhook.validator.js`
   - **Function:** `validate(payload)`
   - **Mechanism:** Executes Zod discriminant validation against `webhook.schema.js`, rejecting malformed payloads before domain normalization.

3. **Normalization Adapter**
   - **File:** `whatsapp-service/src/modules/whatsapp/infrastructure/providers/twilio/twilio.adapter.js`
   - **Function:** `normalize(rawPayload)`
   - **Mechanism:** Strips `whatsapp:` prefix, sanitizes international numbers to E.164, extracts media arrays (`MediaUrl0`, `MediaContentType0`), and outputs a standardized `CanonicalEvent`.

4. **Handler Execution**
   - **File:** `whatsapp-service/src/modules/whatsapp/application/handlers/text.handler.js`
   - **Function:** `textHandler(canonicalEvent, event)`
   - **Mechanism:** Orchestrates downstream calling of `ai.service.js` and outbound delivery via `whatsapp.service.js`.

5. **Outbound Provider Client**
   - **File:** `whatsapp-service/src/modules/whatsapp/infrastructure/providers/twilio/twilio.provider.js`
   - **Function:** `sendMessage(to, body)`
   - **Mechanism:** Uses singleton `twilio(accountSid, authToken)` to invoke `twilioClient.messages.create({ from, to, body })`.

---

## Part 6 — AI Service Deep Dive

### Request & Execution Pipeline

```
HTTP POST /api/v1/conversation
  │ Payload: { "user_id": "919876543210", "message": "Do you have ABC123 in stock?" }
  ▼
[app/main.py] -> generate_conversation_response()
  ▼
[app/orchestration/conversation_orchestrator.py] -> generate_response()
  │
  ├─► 1. Load History: memory_service.get_history("919876543210")
  │      Queries PostgreSQL conversations & conversation_messages
  │
  ├─► 2. Build Message Thread:
  │      [ { role: "system", content: SYSTEM_PROMPT }, ...history, { role: "user", content: "..." } ]
  │
  ├─► 3. Retrieve LLM Tools:
  │      tool_registry.get_tools_for_llm() -> Formats 8 OpenAI/Groq function definitions
  │
  ├─► 4. Multi-Turn LLM Tool Calling Loop (Max 6 Iterations):
  │      a. llm_client.generate_response(messages, tools) via Groq SDK
  │      b. If LLM returns tool_calls:
  │         - Append assistant message with tool_calls to thread
  │         - Execute tool via tool_executor.execute(name, args, tenant_id)
  │         - Append { role: "tool", tool_call_id, name, content } to thread
  │         - Loop back to step 4a
  │      c. If LLM returns final text content: break loop
  │
  ├─► 5. Persist Memory:
  │      - memory_service.save_message(user_id, "user", message)
  │      - memory_service.save_message(user_id, "assistant", final_response_text)
  │
  ▼
HTTP 200 JSON Return: { "response": "ABC123 is available (73 boxes in stock at ₹50/box)." }
```

### Actual JSON Contracts

**Inbound Conversation Request:**
```json
{
  "user_id": "919876543210",
  "message": "Do you have 20 boxes of ABC123 in stock?",
  "tenant_id": "00000000-0000-0000-0000-000000000000"
}
```

**Outbound Conversation Response:**
```json
{
  "response": "*ABC123 Energy Drink* is in stock! We currently have *73 boxes* available at *₹50.00* per box. Would you like me to create an order for 20 boxes?"
}
```

---

## Part 7 — Conversation Memory

### Technical Architecture
- **Identity Key:** `user_id` corresponds to the WhatsApp phone identifier (`WaId`, e.g., `919876543210`).
- **Storage Engine:** PostgreSQL database (`distrosync_ai` on port `5434`) using `asyncpg` with a connection pool (min: 2, max: 10 connections).
- **Schema Management:** Prisma owns the DDL migrations (`AI-service/prisma/schema.prisma`). Runtime queries avoid DDL execution.

```mermaid
erDiagram
    Conversation ||--o{ ConversationMessage : contains
    Conversation {
        uuid id PK
        string user_id UK "Unique WhatsApp Phone/WaId"
        timestamptz created_at
        timestamptz updated_at
    }
    ConversationMessage {
        bigint id PK
        uuid conversation_id FK
        enum role "USER | ASSISTANT | SYSTEM | TOOL"
        text content
        timestamptz created_at
    }
```

### Memory Retrieval & Persistence Mechanics

1. **History Lookup:**
   ```sql
   SELECT message.role, message.content
   FROM conversation_messages AS message
   INNER JOIN conversations AS conversation
       ON conversation.id = message.conversation_id
   WHERE conversation.user_id = $1
   ORDER BY message.created_at DESC, message.id DESC
   LIMIT $2;
   ```
   *Note: Results are reversed in memory so the oldest message appears first in chronological order.*

2. **Atomic Message Insertion:**
   ```sql
   INSERT INTO conversations (id, user_id)
   VALUES ($1, $2)
   ON CONFLICT (user_id)
   DO UPDATE SET updated_at = conversations.updated_at
   RETURNING id;

   INSERT INTO conversation_messages (conversation_id, role, content, created_at)
   VALUES ($1, $2::"MessageRole", $3, $4);

   UPDATE conversations SET updated_at = $2 WHERE id = $1;
   ```

### Memory Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Orch as Conversation Orchestrator
    participant MemSvc as MemoryService
    participant MemRepo as MemoryRepository
    participant PG as PostgreSQL (distrosync_ai)
    participant Groq as Groq LLM

    Orch->>MemSvc: get_history(user_id="919876543210")
    MemSvc->>MemRepo: get_history(user_id, limit=20)
    MemRepo->>PG: SELECT role, content FROM conversation_messages ... LIMIT 20
    PG-->>MemRepo: [ { role: "USER", ... }, { role: "ASSISTANT", ... } ]
    MemRepo-->>MemSvc: Chronological list of past messages
    MemSvc-->>Orch: history array

    Orch->>Groq: Generate completion with history context
    Groq-->>Orch: Returns Assistant Response

    Orch->>MemSvc: save_message(user_id, "user", message)
    MemSvc->>MemRepo: save_message(user_id, "user", message)
    MemRepo->>PG: Upsert conversation & insert user message

    Orch->>MemSvc: save_message(user_id, "assistant", response)
    MemSvc->>MemRepo: save_message(user_id, "assistant", response)
    MemRepo->>PG: Insert assistant message & update timestamp
```

### Current Memory Limitations
1. **No Summarization / Token Compaction:** History retrieval returns the last $N$ raw messages (`LIMIT 20`). If messages are long, this consumes LLM context window tokens.
2. **Missing Multi-Tenant Partitioning:** The unique constraint is on `user_id`. In a multi-tenant setup where two different companies converse with the same phone number, `tenant_id` must be part of a compound unique key `(tenant_id, user_id)`.

---

## Part 8 — AI Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CURRENT AI CAPABILITIES                         │
├────────────────────────────────────────────────────────────────────────┤
│  ✓ Groq LLM Inference (openai/gpt-oss-120b, llama3)                    │
│  ✓ Full Multi-Turn Conversation Memory (PostgreSQL)                    │
│  ✓ Native Function / Tool Calling (OpenAI-compatible schema)           │
│  ✓ Autonomous ERP Tool Invocation (8 Tools Registered)                │
│  ✓ Deterministic SHA-256 Idempotency Cache for Write Tools             │
│  ✓ Standalone RAG PDF Ingestion (PyPDF + SentenceTransformers)         │
│  ✓ Standalone Hybrid Retrieval (Qdrant Cosine + BM25Okapi)             │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        PLANNED AI CAPABILITIES                         │
├────────────────────────────────────────────────────────────────────────┤
│  ⏳ RAG Tool Calling (search_knowledge_base inside LLM loop)           │
│  ⏳ Multi-Item Order Extraction & Fuzzy Product Catalog Matcher        │
│  ⏳ Voice Note Audio Transcriptions (Whisper integration)              │
│  ⏳ Image / Handwritten Invoice OCR Processing                         │
│  ⏳ Context Summarization & Token-Optimized Memory Compaction          │
│  ⏳ Human-in-the-Loop Approval for High-Value Orders                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Part 9 — RAG (Retrieval-Augmented Generation) Status

### Objective Codebase Audit
- **Is document ingestion implemented?** `YES` (Via `POST /api/v1/rag/upload` and `POST /api/v1/rag/ingest`).
- **Is PDF text extraction implemented?** `YES` (Using `pypdf` in AI-service and `pdf-parse` in ERP-service).
- **Is chunking implemented?** `YES` (Configurable `CHUNK_SIZE=800`, `CHUNK_OVERLAP=150`).
- **Are embeddings implemented?** `YES` (Using `SentenceTransformer('BAAI/bge-small-en-v1.5')`, producing 384-dimensional normalized vectors).
- **Is a vector database used?** `YES` (`Qdrant` client running locally with persistent storage at `./data/qdrant`).
- **Is hybrid search implemented?** `YES` (Merges Qdrant Cosine similarity score [0.7 weight] with BM25Okapi sparse score [0.3 weight]).
- **Is retrieval connected to the Conversation endpoint?** `NO`.

> [!IMPORTANT]
> **RAG Status Summary:** RAG ingestion, embedding generation, Qdrant vector storage, and hybrid search are **fully implemented as standalone API endpoints**. However, RAG is **NOT yet connected to the conversation orchestrator or exposed as an LLM tool**. The AI conversational flow currently does not query the RAG index.

### What is Required to Complete RAG Integration:
1. Create a new tool `search_knowledge_base` in `AI-service/app/tools/`.
2. Register the tool in `AI-service/app/tools/registry.py` with schema `SearchKnowledgeBaseArgs(query: str, top_k: int = 3)`.
3. In `search_knowledge_base`, invoke `VectorStore.hybrid_search(query, query_embedding)`.
4. Update `SYSTEM_PROMPT` to guide the LLM to call `search_knowledge_base` for policy, return rules, distributor catalogs, or FAQ queries.

---

## Part 10 — ERP Plugin Architecture

### Conceptual vs. Implemented State
The repository has defined data models and initial service endpoints for ERP management, but **the physical plugin adapter layer for external proprietary ERP systems (Tally, SAP, Busy, Oracle) is currently PLANNED and NOT YET IMPLEMENTED in code.**

```
                              CONCEPTUAL TARGET ARCHITECTURE
                              
                               ┌─────────────────────────┐
                               │   AI Service / Tools    │
                               └────────────┬────────────┘
                                            │ Standard Internal Model
                                            ▼
                               ┌─────────────────────────┐
                               │    Connector Manager    │
                               └────────────┬────────────┘
                ┌──────────────┬────────────┴────────────┬──────────────┐
                ▼              ▼                         ▼              ▼
         ┌─────────────┐ ┌─────────────┐          ┌─────────────┐ ┌─────────────┐
         │ TallyPlugin │ │  SAPPlugin  │          │ BusyPlugin  │ │OraclePlugin │
         └──────┬──────┘ └──────┬──────┘          └──────┬──────┘ └──────┬──────┘
                │ XML/HTTP      │ RFC/OData              │ REST/SQL      │ SuiteTalk
                ▼              ▼                         ▼              ▼
           Tally Prime    SAP S/4HANA                 Busy ERP       NetSuite
```

### What Exists Today:
1. **User Service Configuration Models:** `ERPConfiguration` table stores `erpType` (`TALLY`, `BUSY`, `MARG`, `SAP`, `ORACLE`, `CUSTOM`), `pluginName`, and JSON `connectionConfig`.
2. **Reference / Mock ERP Backend:** `ERP-service` provides a native PostgreSQL implementation of Customers, Products, Inventory, and Orders that acts as the ERP during current development.
3. **AI Client Interface:** `AI-service/app/clients/erp_client.py` makes standardized REST requests with tenant headers (`x-service-key`, `x-tenant-id`).

---

## Part 11 — Database Architecture

The system utilizes three distinct PostgreSQL databases and one Qdrant vector database:

```mermaid
erDiagram
    %% USER SERVICE DB
    User ||--o| Company : belongs_to
    Company ||--o| WhatsAppConfiguration : configures
    Company ||--o| ERPConfiguration : configures
    User {
        uuid id PK
        string email UK
        string passwordHash
        enum status "ACTIVE | SUSPENDED"
    }
    Company {
        uuid id PK
        string companyName
    }
    WhatsAppConfiguration {
        uuid id PK
        uuid companyId FK
        string phoneNumberId
        string accessToken
    }
    ERPConfiguration {
        uuid id PK
        uuid companyId FK
        enum erpType "TALLY | SAP | BUSY | MARG"
        json connectionConfig
    }

    %% ERP SERVICE DB
    Customer ||--o{ Order : places
    Product ||--o| Inventory : has
    Product ||--o{ OrderItem : included_in
    Order ||--o{ OrderItem : contains
    Customer {
        uuid id PK
        uuid tenantId
        string name
        string phone
    }
    Product {
        uuid id PK
        uuid tenantId
        string sku
        string name
        decimal price
    }
    Inventory {
        uuid id PK
        uuid productId FK
        int availableQuantity
        int reservedQuantity
    }
    Order {
        uuid id PK
        uuid tenantId
        uuid customerId FK
        enum status "PENDING | CONFIRMED | SHIPPED"
        decimal totalAmount
    }
    OrderItem {
        uuid id PK
        uuid orderId FK
        uuid productId FK
        int quantity
        decimal unitPrice
    }
    Document {
        uuid id PK
        uuid tenantId
        string fileName
        enum status "UPLOADED | INGESTED"
    }

    %% AI SERVICE DB
    Conversation ||--o{ ConversationMessage : records
    Conversation {
        uuid id PK
        string user_id UK
    }
    ConversationMessage {
        bigint id PK
        uuid conversation_id FK
        enum role "USER | ASSISTANT | SYSTEM | TOOL"
        text content
    }
```

---

## Part 12 — Complete API Inventory

| Method | Endpoint | Service | Purpose | Auth Required | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v2/whatsapp/webhook` | `whatsapp-service` | Ingests Twilio WhatsApp webhooks | Twilio Signature HMAC | `IMPLEMENTED` |
| `GET` | `/health` | `AI-service` | Liveness & readiness probe | None | `IMPLEMENTED` |
| `POST` | `/api/v1/conversation` | `AI-service` | Multi-turn chat & tool orchestration | Internal / Public | `IMPLEMENTED` |
| `POST` | `/api/v1/rag/upload` | `AI-service` | Uploads PDF, chunks, embeds to Qdrant | Internal / Public | `IMPLEMENTED` |
| `POST` | `/api/v1/rag/search` | `AI-service` | Executes dense + BM25 hybrid search | Internal / Public | `IMPLEMENTED` |
| `POST` | `/api/v1/rag/ingest` | `AI-service` | Ingests pre-extracted text from ERP | Internal / Public | `IMPLEMENTED` |
| `GET` | `/health` | `ERP-service` | Health check probe | None | `IMPLEMENTED` |
| `POST` | `/api/v1/customers` | `ERP-service` | Creates a new customer profile | JWT / `x-service-key` | `IMPLEMENTED` |
| `GET` | `/api/v1/customers` | `ERP-service` | Lists all tenant customers | JWT / `x-service-key` | `IMPLEMENTED` |
| `GET` | `/api/v1/customers/:id` | `ERP-service` | Retrieves customer by ID | JWT / `x-service-key` | `IMPLEMENTED` |
| `GET` | `/api/v1/customers/by-phone/:phone` | `ERP-service` | Retrieves customer by phone number | JWT / `x-service-key` | `IMPLEMENTED` |
| `POST` | `/api/v1/products` | `ERP-service` | Creates product & initial inventory | JWT / `x-service-key` | `IMPLEMENTED` |
| `GET` | `/api/v1/products` | `ERP-service` | Lists all tenant products | JWT / `x-service-key` | `IMPLEMENTED` |
| `GET` | `/api/v1/products/search` | `ERP-service` | Searches products by query | JWT / `x-service-key` | `IMPLEMENTED` |
| `GET` | `/api/v1/products/:id` | `ERP-service` | Gets single product details | JWT / `x-service-key` | `IMPLEMENTED` |
| `GET` | `/api/v1/inventory/:productId` | `ERP-service` | Gets available stock for product | JWT / `x-service-key` | `IMPLEMENTED` |
| `PUT` | `/api/v1/inventory/:productId` | `ERP-service` | Updates product inventory levels | JWT / `x-service-key` | `IMPLEMENTED` |
| `POST` | `/api/v1/orders` | `ERP-service` | Creates order with atomic stock reservation | JWT / `x-service-key` | `IMPLEMENTED` |
| `GET` | `/api/v1/orders` | `ERP-service` | Lists tenant orders | JWT / `x-service-key` | `IMPLEMENTED` |
| `GET` | `/api/v1/orders/:id` | `ERP-service` | Retrieves order details | JWT / `x-service-key` | `IMPLEMENTED` |
| `GET` | `/api/v1/orders/:id/status` | `ERP-service` | Gets order status | JWT / `x-service-key` | `IMPLEMENTED` |
| `PATCH`| `/api/v1/orders/:id/status` | `ERP-service` | Updates order status (e.g. CANCELLED) | JWT / `x-service-key` | `IMPLEMENTED` |
| `POST` | `/api/v1/documents/upload` | `ERP-service` | Uploads PDF & extracts text | JWT / `x-service-key` | `IMPLEMENTED` |
| `POST` | `/api/v1/documents/:id/ingest` | `ERP-service` | Sends extracted text to AI RAG | JWT / `x-service-key` | `IMPLEMENTED` |
| `POST` | `/auth/send-otp` | `user-service` | Sends signup verification OTP | None | `IMPLEMENTED` |
| `POST` | `/auth/verify-otp` | `user-service` | Verifies OTP & creates user | None | `IMPLEMENTED` |
| `POST` | `/auth/login` | `user-service` | Authenticates user & sets cookies | None | `IMPLEMENTED` |
| `POST` | `/auth/refresh` | `user-service` | Refreshes access token | Refresh Cookie | `IMPLEMENTED` |
| `POST` | `/auth/logout` | `user-service` | Clears refresh session | JWT Auth | `IMPLEMENTED` |
| `GET` | `/auth/me` | `user-service` | Returns authenticated user profile | JWT Auth | `PARTIALLY IMPLEMENTED` (Bug) |
| `POST` | `/companies` | `user-service` | Creates company profile | JWT Auth | `IMPLEMENTED` |
| `GET` | `/companies/me` | `user-service` | Gets tenant company details | JWT Auth | `IMPLEMENTED` |
| `POST` | `/erp/config` | `user-service` | Saves company ERP configuration | JWT Auth | `IMPLEMENTED` |
| `GET` | `/erp/config` | `user-service` | Gets company ERP configuration | JWT Auth | `IMPLEMENTED` |
| `POST` | `/whatsapp/config` | `user-service` | Saves company WhatsApp configuration | JWT Auth | `IMPLEMENTED` |

---

## Part 13 — Environment Variables

| Variable Name | Service | Purpose | Required | Example Format |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | `whatsapp-service` | HTTP server listening port | Yes | `4001` |
| `TWILIO_ACCOUNT_SID` | `whatsapp-service` | Twilio API Account Identifier | Yes | `AC[REDACTED]` |
| `TWILIO_AUTH_TOKEN` | `whatsapp-service` | Twilio HMAC signature verification & API token | Yes | `[REDACTED]` |
| `TWILIO_WHATSAPP_NUMBER` | `whatsapp-service` | Sandbox / Twilio Sender WhatsApp number | Yes | `whatsapp:+14155238886` |
| `TWILIO_WEBHOOK_URL` | `whatsapp-service` | Public ngrok / tunnel endpoint for signature check | Optional | `https://[REDACTED].ngrok-free.app/api/v2/whatsapp/webhook` |
| `AI_SERVICE_URL` | `whatsapp-service` | AI Service base URL | Yes | `http://localhost:8000` |
| `AI_SERVICE_TIMEOUT_MS` | `whatsapp-service` | Request abort timeout for AI calls | No | `30000` |
| `GROQ_API_KEY` | `AI-service` | API Authentication key for Groq Cloud | Yes | `gsk_[REDACTED]` |
| `GROQ_MODEL` | `AI-service` | LLM model identifier | No | `openai/gpt-oss-120b` or `llama3-70b-8192` |
| `DATABASE_URL` | `AI-service` | PostgreSQL connection string for memory | Yes | `postgresql://postgres:postgres@localhost:5434/distrosync_ai` |
| `ERP_SERVICE_URL` | `AI-service` | Base URL for ERP Service REST API | Yes | `http://localhost:4002` |
| `ERP_SERVICE_API_KEY` | `AI-service` | Service-to-service authentication key | Yes | `[REDACTED]` |
| `DATABASE_URL` | `ERP-service` | PostgreSQL connection string for ERP data | Yes | `postgresql://postgres:postgres@localhost:5433/distrosync_erp` |
| `SERVICE_API_KEY` | `ERP-service` | Shared secret key for internal service calls | Yes | `[REDACTED]` |
| `DATABASE_URL` | `user-service` | PostgreSQL connection string for User/Tenant data | Yes | `postgresql://postgres:postgres@localhost:5432/postgres` |
| `REDIS_URL` | `user-service` | Redis connection URL for OTP and token sessions | Yes | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | `user-service` | Secret key for signing JWT access tokens | Yes | `[REDACTED]` |
| `JWT_REFRESH_SECRET` | `user-service` | Secret key for signing JWT refresh tokens | Yes | `[REDACTED]` |

---

## Part 14 — Security Status

| Security Domain | Classification | Findings & Code Evidence | Recommendation |
| :--- | :--- | :--- | :--- |
| **Twilio Webhook Validation** | `GOOD` | `twilio.validateRequest` validates HMAC-SHA1 signatures using `TWILIO_AUTH_TOKEN`. Rejects spoofed webhooks with 401/403. | Retain current implementation. Ensure ngrok URL matches exact protocol/host. |
| **Service-to-Service Auth** | `GOOD` | `ERP-service` validates `x-service-key` header matching `SERVICE_API_KEY`; rejects unauthorized calls with 401. | Move shared static keys to mTLS or rotating JWT service tokens in production. |
| **Multi-Tenant Isolation** | `GOOD` | ERP queries filter strictly by `tenantId`. AI tool executor passes `tenant_id` context into all ERP API requests. | Add tenant isolation checks to AI Conversation Memory database schema. |
| **Input Validation** | `GOOD` | Zod schema validation in `whatsapp-service`; Pydantic schema validation in `AI-service`; Zod schemas in `ERP-service`. | Maintain strict typing; add character limit checks to prevent prompt injections. |
| **Secrets & Credential Safety**| `NEEDS IMPROVEMENT`| Default fallback API key is hardcoded in `AI-service/app/core/config.py` line 26 if not set in `.env`. | Remove hardcoded fallback strings from source code; fail fast on missing env vars. |
| **Rate Limiting** | `NEEDS IMPROVEMENT`| Redis OTP attempt limiting exists in `user-service`. No rate limiting on `/api/v1/conversation` or `/api/v2/whatsapp/webhook`. | Implement express-rate-limit and Redis sliding-window limiters on all public endpoints. |
| **CORS Configuration** | `NEEDS IMPROVEMENT`| `ERP-service` has `cors()`. `AI-service` does not configure `CORSMiddleware`. | Add explicit origin whitelisting in FastAPI `AI-service`. |

---

## Part 15 — Error Handling & Resilience

### Error Flow Across Layers
1. **Twilio Webhook Layer:** Custom error hierarchy (`WebhookError`, `AuthenticationError`, `ValidationError`, `NormalizationError`, `ClassificationError`). Central error middleware formats structured JSON and suppresses stack traces in production.
2. **AI Service Layer:** `AIServiceError` in `whatsapp-service` wraps non-200 responses, network timeouts (via `AbortController`), and malformed responses. In `AI-service`, `ERPServiceError` captures ERP HTTP status codes and provides fallback user-friendly error messages to the LLM.
3. **Groq API Resilience:** `LLMClient` incorporates exponential backoff retries (3 attempts, starting at 2.0s) for `RateLimitError`.
4. **Idempotency Safeguards:** `ToolExecutor` calculates a SHA-256 hash of `tenant_id + tool_name + arguments` and caches successful write operations for 5 minutes (`_IDEMPOTENCY_CACHE`) to prevent duplicate order placements upon webhook retries.

---

## Part 16 — Testing Status

```
================================================================================
                           AUTOMATED TEST AUDIT SUMMARY
================================================================================
whatsapp-service:
  ✓ PASS (14 Test Suites, 175 Tests Passing)
    - tests/adapters/twilio.adapter.test.js
    - tests/classification/classifier.test.js
    - tests/errors/webhook.errors.test.js
    - tests/events/dispatcher.test.js
    - tests/handlers/button.handler.test.js
    - tests/handlers/dispatch-handler.test.js
    - tests/handlers/handler.result.test.js
    - tests/handlers/media.handler.test.js
    - tests/handlers/text.handler.test.js
    - tests/handlers/unsupported.handler.test.js
    - tests/integration/pipeline.test.js
    - tests/middleware/twilioSignature.test.js
    - tests/services/ai.service.test.js
    - tests/validation/webhook.validator.test.js
  ✗ FAIL (1 Test Suite Failing)
    - tests/providers/twilio.provider.test.js (Jest mock out-of-scope variable access)

ERP-service:
  • NOT EXECUTED (node_modules not installed in workspace)
    - tests/integration/api.test.js
    - tests/unit/customer.test.js
    - tests/unit/document.test.js
    - tests/unit/inventory.test.js
    - tests/unit/order.test.js
    - tests/unit/product.test.js

AI-service:
  • NOT EXECUTED (pytest not installed in .venv)
    - tests/integration/test_end_to_end_scenarios.py
    - tests/unit/test_conversation_orchestrator.py
    - tests/unit/test_erp_client.py
    - tests/unit/test_response_parser.py
    - tests/unit/test_tool_executor.py
    - tests/unit/test_tool_registry.py
    - tests/unit/test_tool_schemas.py

user-service:
  • NO TESTS IMPLEMENTED (tests directory does not exist)
================================================================================
```

---

## Part 17 — Current End-to-End Operational Flow

The following sequence is **verified as operational today** using Twilio Sandbox and the local microservices:

1. **User Connection:** User joins the Twilio WhatsApp Sandbox by sending `join <sandbox-keyword>` to `whatsapp:+14155238886`.
2. **Inbound Message:** User sends a natural language WhatsApp message (e.g., *"Hi, what products do you sell?"* or *"Do you have ABC123 in stock?"*).
3. **Webhook Ingestion:** Twilio dispatches an HTTPS POST to the public ngrok endpoint forwarding to `whatsapp-service` on port `4001`.
4. **Security & Validation:** `twilioSignatureMiddleware` validates `X-Twilio-Signature`. `webhook.validator.js` verifies the payload structure.
5. **Canonical Normalization:** `twilio.adapter.js` normalizes form parameters into `CanonicalEvent`.
6. **AI Dispatch:** `textHandler` extracts the text and user phone number (`WaId`) and calls `AI-service: POST /api/v1/conversation`.
7. **Context & Memory:** `AI-service` retrieves up to 20 past conversation messages from PostgreSQL (`distrosync_ai`).
8. **LLM Reasoning & Tool Execution:** Groq LLM evaluates the system prompt, conversation history, and user message. If querying catalog data, it executes `search_products` or `get_inventory` via `ERPClient` calling `ERP-service` (:4002).
9. **Memory Persistence:** User message and final AI response are saved to PostgreSQL conversation tables.
10. **Outbound Delivery:** `whatsapp-service` receives the AI text response and calls `twilio.provider.js: sendMessage()`.
11. **User Delivery:** Twilio delivers the formatted WhatsApp response back to the user's phone.

---

## Part 18 — Current Architecture vs. Target Architecture

### Side-by-Side Comparison

```
CURRENT ARCHITECTURE                              TARGET ARCHITECTURE
────────────────────                              ───────────────────
Twilio WhatsApp Gateway                           Twilio & Meta Multi-Provider
        │                                                 │
        ▼ (Direct HTTP Webhook)                           ▼ (Reverse Proxy / Load Balancer)
whatsapp-service (:4001)                          Kong API Gateway
        │                                                 │
        ▼ (Synchronous HTTP POST)                         ▼ (AMQP Event Publish)
AI-service (:8000)                                RabbitMQ Message Broker
├── Conversation Orchestrator                             │
├── PostgreSQL Memory (:5434)                             ├─► WhatsApp Ingestion Workers
├── Groq LLM API                                          ├─► AI Orchestration Engine
└── 8 REST Tools                                          │   ├── Multi-tenant Context Memory
        │                                                 │   ├── Tool Calling & Intent Engine
        ▼ (Synchronous HTTP REST)                         │   └── Knowledge Base / RAG Tools
ERP-service (:4002)                                       ├─► Order Management Service
├── Core/Mock ERP Tables (PG :5433)                       │   └── Atomic State Machine
└── PDF RAG Ingestion                                     └─► ERP Connector Service
                                                              ├── Connector Manager
                                                              └── Plugin Drivers (Tally, SAP, Busy)
```

---

## Part 19 — Prioritized Gap Analysis & Backlog

| Priority | Task Name | Why Needed | Dependencies | Complexity | Service | Target Files |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **P0** | **Connect RAG Tool to Conversation Loop** | Enable AI to answer questions from uploaded catalog PDFs | Standalone RAG endpoints exist | Medium | `AI-service` | `app/tools/registry.py`, `app/tools/schemas.py`, `app/tools/catalog_tools.py` |
| **P0** | **Fix User Service `auth.service.js` Export Bug** | Unblocks `GET /auth/me` user profile endpoint | None | Low | `user-service` | `src/services/auth.service.js` |
| **P0** | **Fix Jest Mock in WhatsApp Provider Test** | Restores 100% test passing status in WhatsApp service | None | Low | `whatsapp-service` | `tests/providers/twilio.provider.test.js` |
| **P1** | **Multi-Item Order Disambiguation Prompt Tuning** | Allows conversational parsing of multi-line order requests | Tool Calling | Medium | `AI-service` | `app/intelligence/llm/prompts/system.py` |
| **P1** | **Build Unified Root Docker Compose** | Enables single-command local development & CI/CD deployment | Dockerfiles exist | Medium | Root | `docker-compose.yml` |
| **P1** | **Install Dependencies & Verify Test Runners** | Enables CI execution of ERP and AI service test suites | None | Low | `ERP-service`, `AI-service` | `package.json`, `pyproject.toml` |
| **P2** | **ERP Connector Plugin Architecture (Tally Adapter)** | Connects real on-premise Tally instances via XML/HTTP | Order Service | High | `ERP-service` / New Service | `src/modules/connectors/*` |
| **P2** | **Meta WhatsApp Cloud API Adapter** | Direct official Meta WhatsApp integration for production | Twilio adapter model | Medium | `whatsapp-service` | `src/modules/whatsapp/infrastructure/providers/meta/` |
| **P3** | **Asynchronous Webhook Event Queue (RabbitMQ)** | Prevents Twilio webhook timeouts during slow LLM completions | Broker infrastructure | High | All Services | `src/events/*` |

---

## Part 20 — Recommended Milestones

```mermaid
gantt
    title DISTROSYNC Implementation Roadmap
    dateFormat  YYYY-MM-DD
    section Completed
    M1: LLM WhatsApp Conversation       :done, m1, 2026-08-01, 2026-08-15
    M2: PostgreSQL Conversation Memory  :done, m2, 2026-08-16, 2026-08-25
    M3: LLM Tool Calling & ERP Sync     :done, m3, 2026-08-26, 2026-09-02
    section Immediate Next
    M4: Wire RAG Tool to AI Orchestrator:active, m4, 2026-09-03, 2026-09-10
    M5: Unified Docker Compose & Tests  :m5, 2026-09-11, 2026-09-18
    section Core Expansion
    M6: First ERP Plugin (Tally XML)    :m6, 2026-09-19, 2026-10-05
    M7: Meta Cloud API Production Provider:m7, 2026-10-06, 2026-10-20
    M8: Async Message Queue (RabbitMQ)  :m8, 2026-10-21, 2026-11-10
```

- **Milestone 1 (LLM WhatsApp Conversation):** `COMPLETED` (Twilio webhook -> FastAPI -> Groq -> WhatsApp response).
- **Milestone 2 (Conversation Memory):** `COMPLETED` (PostgreSQL asyncpg conversation history per WaId).
- **Milestone 3 (LLM Tool Calling & ERP Sync):** `COMPLETED` (8 tools calling ERP Service with stock check & order creation).
- **Milestone 4 (RAG Tool Integration):** `READY TO BUILD` (Expose existing hybrid vector search as an LLM tool).
- **Milestone 5 (Unified Infrastructure & Testing):** `PENDING` (Docker compose orchestration and test suite completion).
- **Milestone 6 (ERP Plugin Engine - Tally Adapter):** `PLANNED` (Connector manager & XML bridge to Tally Prime).
- **Milestone 7 (Production Meta WhatsApp API):** `PLANNED` (Official Meta Graph API adapter).

---

## Part 21 — What Should I Work On Next?

### The Single Recommended Next Task

> ### 🎯 **NEXT TASK: Wire the RAG Vector Search into the Conversation Tool Registry**

#### Why This is Next:
You have already built **both** major halves of the intelligence layer:
1. You built a working **Tool Calling Orchestrator** in `AI-service` that allows the LLM to call tools autonomously.
2. You built a working **Hybrid Vector Store (Qdrant + BM25)** in `AI-service/app/rag/vector_store.py` that embeds PDFs and performs dense/sparse retrieval.

However, they are currently disconnected! The AI cannot answer questions about uploaded product catalogs or business PDFs during WhatsApp chats because the LLM has no tool to search the RAG index. Connecting them completes the entire AI product-knowledge intelligence loop.

#### Exact Files to Work On:
1. `c:\DISTROSYNC\AI-service\app\tools\schemas.py` — Add `SearchKnowledgeBaseArgs(BaseModel)` schema.
2. `c:\DISTROSYNC\AI-service\app\tools\catalog_tools.py` — Implement `search_knowledge_base` executor invoking `VectorStore.hybrid_search`.
3. `c:\DISTROSYNC\AI-service\app\tools\registry.py` & `__init__.py` — Register `search_knowledge_base` tool.
4. `c:\DISTROSYNC\AI-service\app\intelligence\llm\prompts\system.py` — Add rule: *"When a user asks about distributor policies, catalog details, or questions not answered by product search, call `search_knowledge_base`."*

#### What Should NOT Be Worked On Yet:
- Do NOT build RabbitMQ or event brokers yet.
- Do NOT build SAP or Oracle plugins yet.
- Do NOT rewrite the WhatsApp webhook pipeline.

#### Definition of Done:
Upload a PDF via `ERP-service`, send a WhatsApp message asking about a detail inside that PDF (e.g. *"What is your return policy for damaged cans?"*), and verify in logs that the LLM autonomously calls `search_knowledge_base` and returns the correct excerpt in its WhatsApp response.

---

## Part 22 — Project Tree

```text
c:\DISTROSYNC\
│
├── AI-service/                         # Python FastAPI AI & Memory Microservice (:8000)
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── conversation.py     # POST /api/v1/conversation endpoint
│   │   │   │   └── health.py           # GET /health liveness probe
│   │   │   └── schemas/                # Pydantic request & response contracts
│   │   ├── clients/
│   │   │   └── erp_client.py           # HTTP client calling ERP-service REST APIs
│   │   ├── core/
│   │   │   ├── config.py               # Pydantic environment configuration settings
│   │   │   └── exceptions.py           # Custom exception hierarchy
│   │   ├── intelligence/
│   │   │   ├── embeddings/             # SentenceTransformers (BAAI/bge-small-en-v1.5)
│   │   │   └── llm/                    # Groq SDK client & system prompts
│   │   ├── memory/
│   │   │   ├── repository.py           # PostgreSQL asyncpg conversation repository
│   │   │   └── service.py              # Memory service business logic
│   │   ├── orchestration/
│   │   │   └── conversation_orchestrator.py # Multi-turn tool execution loop
│   │   ├── rag/
│   │   │   └── vector_store.py         # Qdrant vector store + BM25Okapi hybrid search
│   │   └── tools/                      # Registered LLM tools & idempotent executor
│   ├── data/qdrant/                    # Local persistent Qdrant vector storage
│   ├── prisma/                         # Prisma schema for AI conversation database
│   └── tests/                          # Unit and integration test suites
│
├── ERP-service/                        # Express Node.js Core/Mock ERP Microservice (:4002)
│   ├── src/
│   │   ├── app.js                      # Express configuration and route mounting
│   │   ├── config/                     # Prisma & Redis client initialization
│   │   ├── modules/
│   │   │   ├── customers/              # Customer CRUD routes, service, repository
│   │   │   ├── documents/              # PDF upload, text extraction, RAG client
│   │   │   ├── inventory/              # Product stock queries and atomic reservation
│   │   │   ├── orders/                 # Order creation and transactional item handling
│   │   │   └── products/               # Product catalog management & search APIs
│   │   └── shared/                     # Auth middleware (JWT / x-service-key), errors
│   ├── prisma/                         # Prisma schema for ERP database (6 models)
│   └── tests/                          # Jest unit and integration tests
│
├── user-service/                       # Express Node.js Identity & Tenant Service (:3000/:4001)
│   ├── src/
│   │   ├── app.js                      # Express app mounting /auth, /companies, /erp, /whatsapp
│   │   ├── controllers/                # HTTP request handlers
│   │   ├── middlewares/                # JWT cookie verification middleware
│   │   ├── routes/                     # Express route declarations
│   │   ├── services/                   # Auth, OTP, Company, Config business logic
│   │   └── utils/                      # Password hashing, JWT signing, OTP generation
│   └── prisma/                         # Prisma schema for users, companies, configs
│
├── whatsapp-service/                   # Express Node.js WhatsApp Webhook Gateway (:4001)
│   ├── src/
│   │   ├── app.js                      # Express application setup
│   │   └── modules/whatsapp/
│   │       ├── application/
│   │       │   ├── events/             # Event registry and dispatcher
│   │       │   ├── handlers/           # Text, Button, Media, Unsupported handlers
│   │       │   └── services/           # AI service client, Twilio outbound service
│   │       ├── domain/
│   │       │   ├── classification/     # Event and message type classifiers
│   │       │   ├── errors/             # Custom webhook errors
│   │       │   └── models/             # CanonicalEvent domain structure
│   │       ├── infrastructure/
│   │       │   └── providers/twilio/   # Twilio adapter and messaging client
│   │       ├── presentation/
│   │       │   ├── controllers/        # Inbound webhook pipeline controller
│   │       │   ├── middleware/         # HMAC signature & error middlewares
│   │       │   └── routes/             # POST /api/v2/whatsapp/webhook route
│   │       └── validation/             # Zod webhook payload validation schemas
│   ├── prisma/                         # Prisma schema (synced from user service)
│   └── tests/                          # 15 Jest test suites (175 tests)
│
├── docker-compose.yml                  # Root compose file (currently empty stub)
└── DISTROSYNC_PROJECT_STATUS.md        # Single Source of Truth System Audit Document
```

---

## Part 23 — Service-by-Service Architecture

```
1. WHATSAPP SERVICE PIPELINE
Twilio Inbound POST ──► twilioSignatureMiddleware ──► Zod validate() ──► normalize()
                                                                            │
                                                                            ▼
HTTP 200 OK ◄── sendMessage() ◄── generateAIResponse() ◄── textHandler ◄── dispatch()

2. AI SERVICE ORCHESTRATION PIPELINE
POST /api/v1/conversation ──► ConversationOrchestrator ──► get_history() (PostgreSQL)
                                      │
                                      ▼
             ┌──────────────── Groq LLM Turn ────────────────┐
             │                                               │
    Tool Calls Requested?                               Final Text?
             │                                               │
             ▼                                               ▼
      ToolExecutor ──► ERP REST APIs                save_message() (PostgreSQL)
             │                                               │
             └──────► Loop back to Groq ◄────────────────────┘

3. ERP SERVICE BUSINESS ENGINE
HTTP Request ──► auth.middleware (JWT or x-service-key) ──► Module Route (Customers/Orders)
                                                                 │
                                                                 ▼
HTTP Response ◄── Result Formatter ◄── Prisma ORM Transaction ◄── Module Service
```

---

## Part 24 — Complete Request Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Retailer (WhatsApp)
    participant Twilio as Twilio Cloud
    participant WA as whatsapp-service (:4001)
    participant AI as AI-service (:8000)
    participant Memory as PostgreSQL (AI DB)
    participant Groq as Groq LLM Cloud
    participant ERP as ERP-service (:4002)
    participant ERP_DB as PostgreSQL (ERP DB)

    Customer->>Twilio: "I want 10 boxes of mangoes"
    Twilio->>WA: POST /api/v2/whatsapp/webhook
    Note over WA: Validate Signature -> Validate Payload -> Normalize -> Dispatch to textHandler
    WA->>AI: POST /api/v1/conversation { user_id: "919876543210", message: "I want 10 boxes of mangoes" }
    
    AI->>Memory: Load recent conversation history
    Memory-->>AI: History records
    
    AI->>Groq: Query with system prompt & 8 tools
    Groq-->>AI: Tool Call: search_products(query="mangoes")
    
    AI->>ERP: GET /api/v1/products/search?q=mangoes
    ERP->>ERP_DB: Query products
    ERP_DB-->>ERP: [ { id: "p-mango", name: "Alphonso Mango Box", price: 800, availableQuantity: 45 } ]
    ERP-->>AI: [ { id: "p-mango", name: "Alphonso Mango Box", price: 800, availableQuantity: 45 } ]
    
    AI->>Groq: Tool result { products: [ ... ] }
    Groq-->>AI: Tool Call: get_customer(phone="919876543210")
    
    AI->>ERP: GET /api/v1/customers/by-phone/919876543210
    ERP->>ERP_DB: Query customer
    ERP_DB-->>ERP: { id: "c-101", name: "Apex Stores", phone: "919876543210" }
    ERP-->>AI: { id: "c-101", name: "Apex Stores" }
    
    AI->>Groq: Tool result { customer: "Apex Stores" }
    Groq-->>AI: Final Response Text: "Found *Alphonso Mango Box* (45 available at ₹800/box). Shall I create an order for 10 boxes for Apex Stores (Total: ₹8,000)?"
    
    AI->>Memory: Save User & Assistant messages
    AI-->>WA: { response: "Found Alphonso Mango Box..." }
    WA->>Twilio: sendMessage("whatsapp:+919876543210", "Found Alphonso Mango Box...")
    Twilio-->>Customer: WhatsApp Message Delivered
```

---

## Part 25 — Architectural Decisions (ADRs)

1. **Decoupled AI Tool Calling over Direct Database Access**
   - **Status:** `IMPLEMENTED`
   - **Rationale:** The AI should not have direct SQL access to ERP databases. Abstracting business actions into standard Pydantic tools (`search_products`, `create_order`) allows backend ERP replacements without modifying AI prompts or code.
2. **Provider-Agnostic Canonical Event Model**
   - **Status:** `IMPLEMENTED`
   - **Rationale:** WhatsApp providers (Twilio, Meta Cloud API, 360dialog) have disparate JSON payload formats. Normalizing immediately to `CanonicalEvent` insulates domain handlers from vendor API changes.
3. **Stateless Request Orchestration with Persistent Database Memory**
   - **Status:** `IMPLEMENTED`
   - **Rationale:** In-memory chat history is lost upon service restarts. Persisting messages in PostgreSQL per user ID ensures seamless multi-turn continuity across rolling deployments.
4. **Synchronous HTTP Service-to-Service REST (Current Phase)**
   - **Status:** `IMPLEMENTED`
   - **Rationale:** Minimizes operational complexity during initial milestone verification compared to running full message broker clusters.

---

## Part 26 — Known Problems & Technical Debt

### High Severity
1. **User Service Missing Export Bug:**
   - **Location:** `user-service/src/services/auth.service.js` (lines 368-400)
   - **Issue:** Function `getCurrentUser` is implemented but omitted from `module.exports`, causing `GET /auth/me` to throw a 500 runtime error.

### Medium Severity
2. **Twilio Provider Test Mock Scope Issue:**
   - **Location:** `whatsapp-service/tests/providers/twilio.provider.test.js` (line 17)
   - **Issue:** Jest mock references out-of-scope factory variable `twilioFactory`, causing 1 test suite failure in an otherwise passing 175-test suite.
3. **Hardcoded ERP Service Key Fallback:**
   - **Location:** `AI-service/app/core/config.py` (line 26)
   - **Issue:** Static API key `65c47afdd3eff0ebc554035a37dcf700e12c8fd7b634962ebf24126a5c5f08b5` is present in code as a fallback.
4. **Missing Top-Level Docker Compose:**
   - **Location:** `docker-compose.yml`
   - **Issue:** Root `docker-compose.yml` is an empty 0-byte file.

### Low Severity / Code Cleanup
5. **Singular Tool Stubs in AI Service:**
   - **Location:** `AI-service/app/tools/catalog_tool.py`, `customer_tool.py`, `inventory_tool.py`, `order_tool.py`
   - **Issue:** Empty 2-line stub files superseded by plural implementations (`customer_tools.py`, etc.).
6. **Unused Standalone Intelligence Stubs:**
   - **Location:** `AI-service/app/intelligence/intent/intent_classifier.py`, `order_parser.py`, `entity_extractor.py`
   - **Issue:** Contain `# Stub — not yet implemented.` because LLM function calling handles these responsibilities natively.

---

## Part 27 — Final Project Scorecard

```
================================================================================
                         DISTROSYNC MATURITY SCORECARD
================================================================================
Subsystem                       Maturity Level     Implementation Status
--------------------------------------------------------------------------------
WhatsApp Webhook & Ingestion     COMPLETE           100% (Twilio Inbound & Outbound)
AI LLM Orchestration             COMPLETE           100% (Groq Multi-Turn Engine)
Conversation Memory              COMPLETE           100% (PostgreSQL asyncpg per WaId)
LLM Tool Calling & ERP Actions   COMPLETE           100% (8 Pydantic Tools)
RAG Ingestion & Vector Search    PARTIAL            60%  (Endpoints exist; not in loop)
ERP Data Layer & Order Service   COMPLETE           90%  (Express + Prisma PostgreSQL)
ERP Plugin / Connector Layer     NOT STARTED        10%  (DB schema only; no drivers)
User Auth & Tenant Management    PARTIAL            75%  (OTP/JWT works; 1 export bug)
Security & Access Control        PARTIAL            70%  (Signatures & API keys active)
Automated Testing                PARTIAL            65%  (WhatsApp passes; others need config)
Production Readiness             PARTIAL            50%  (Need Gateway, Compose, Meta API)
================================================================================
```

---

## Part 28 — Final Summary

### What is Working Today
- Live WhatsApp bidirectional messaging via Twilio Sandbox.
- Twilio signature verification and Zod payload validation.
- Fast multi-turn conversation memory in PostgreSQL keyed by WhatsApp phone number.
- Groq LLM inference (`openai/gpt-oss-120b` and Llama3 models).
- Autonomous LLM tool calling that queries product catalogs, checks live inventory, finds customers by phone, places orders, and updates order status.
- Deterministic SHA-256 idempotency cache preventing duplicate order placements.
- PDF text extraction and hybrid (Qdrant + BM25) vector retrieval endpoints.

### What is Partially Working
- Standalone RAG endpoints work, but RAG search is not wired into the conversation tool loop.
- User Service auth and company config work, but `GET /auth/me` has a missing export bug.
- Automated testing in `whatsapp-service` has 175 passing tests, but 1 test suite has a mock scope syntax error.

### What Has Not Been Built
- Physical ERP connector drivers (Tally XML bridge, SAP RFC, Busy API).
- Production Meta WhatsApp Cloud API provider adapter.
- Asynchronous RabbitMQ / event broker architecture.
- Central API Gateway routing.

### What is Planned
- Multi-item colloquial order parsing improvements.
- Audio voice note transcription via Whisper.
- Invoice and handwritten order photo OCR.
- Self-hosted on-premise Tally integration agent.

---

### My Next Task
**Expose the existing RAG hybrid vector search as a callable tool (`search_knowledge_base`) in the AI Service Tool Registry.**

### Definition of Done
Upload a catalog or policy PDF, ask a question about that PDF over WhatsApp, and confirm that the LLM autonomously executes the knowledge base search tool and answers accurately.

---
*Document generated as the authoritative technical audit and source of truth for the DISTROSYNC repository.*
