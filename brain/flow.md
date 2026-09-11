---
slug: flow
title: Key flows
role: key flows
updated: "2026-09-11T17:35:41"
---

# Key flows

## End-to-End WhatsApp Order Flow

```mermaid
sequenceDiagram
    autonumber
    actor Retailer as Retailer (WhatsApp)
    participant Twilio as Twilio Gateway
    participant WA as whatsapp-service :4001
    participant AI as AI-service :8000
    participant Memory as PostgreSQL (AI DB)
    participant Groq as Groq Cloud LLM
    participant ERP as ERP-service :4002
    participant ERP_DB as PostgreSQL (ERP DB)

    Retailer->>Twilio: "I want 10 boxes of ABC123"
    Twilio->>WA: POST /api/v2/whatsapp/webhook
    Note over WA: 1. Validate Twilio Signature<br/>2. Zod Schema Validation<br/>3. Normalize to CanonicalEvent<br/>4. Classify event -> message, type -> text
    WA->>AI: POST /api/v1/conversation { user_id, message }
    AI->>Memory: Load recent history (LIMIT 20)
    Memory-->>AI: Prior messages
    AI->>Groq: Chat Completion (System Prompt + History + Tools)
    Groq-->>AI: Tool Call: search_products(query="ABC123")
    AI->>ERP: GET /api/v1/products/search?q=ABC123
    ERP->>ERP_DB: Prisma query
    ERP_DB-->>ERP: Product results
    ERP-->>AI: HTTP 200 { products }
    AI->>Groq: Tool result
    Groq-->>AI: Tool Call: get_inventory(product_id)
    AI->>ERP: GET /api/v1/inventory/{id}
    ERP-->>AI: { availableQuantity: 73 }
    AI->>Groq: Tool result
    Groq-->>AI: Final text response
    AI->>Memory: Save user + assistant messages
    AI-->>WA: { response: "ABC123 available (73 in stock at ???50/box)..." }
    WA->>Twilio: sendMessage(to, body)
    Twilio-->>Retailer: WhatsApp reply delivered
```

## Tally Connector Sync Flow (On-Premise WebSocket Bridge)

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Distributor Admin
    participant Dashboard as DistroSync Cloud Web UI
    participant ERP as ERP-service (:4002 /ws/connector)
    participant Connector as On-Premise Connector (:9123)
    participant Tally as TallyPrime (:9000 XML)

    Admin->>Dashboard: Click "Connect Tally"
    Dashboard->>ERP: POST /api/v1/connector/pair-code
    ERP-->>Dashboard: 6-digit Code (e.g. DS-9A3F12)
    Admin->>Connector: Run tally-connector.exe (opens :9123)
    Admin->>Connector: Enter code DS-9A3F12
    Connector->>ERP: POST /api/v1/connector/pair { code }
    ERP-->>Connector: Bearer Secret Token + companyId
    Note over Connector: Save to %APPDATA%/DistroSync/config.json
    Connector->>ERP: Outbound WebSocket Connect /ws/connector
    ERP-->>Connector: WebSocket Handshake Established (Online)
    
    rect rgb(240, 248, 255)
    Note over ERP,Tally: Live Inventory / Ledger Query Execution
    ERP->>Connector: WS JSON Command { action: "FETCH_STOCK_ITEMS" }
    Connector->>Tally: HTTP POST :9000 (EXPORT_STOCK_ITEMS_XML)
    Tally-->>Connector: XML Stock Item Response
    Note over Connector: Parse & Sanitize XML to JSON
    Connector->>ERP: WS Response { success: true, data: stockItems }
    ERP->>ERP: Sync stock levels into DistroSync PostgreSQL
    end
```

## WhatsApp Inbound Pipeline (Detail)

1. **Twilio Webhook** ??? `POST /api/v2/whatsapp/webhook` (URL-encoded body)
2. **Signature Verification** ??? `twilioSignatureMiddleware` validates `X-Twilio-Signature` using `TWILIO_AUTH_TOKEN`
3. **Payload Validation** ??? Zod schema checks required fields
4. **Canonical Normalization** ??? `twilio.adapter.js` maps Twilio form params -> `CanonicalEvent { type, from, body, timestamp }` ([[canonical-event-model]])
5. **Event Classification** ??? event type = message, message type = text
6. **Dispatch** ??? `textHandler` extracts text + WaId (phone number)
7. **AI Call** ??? `POST /api/v1/conversation { user_id: WaId, message: text }`
8. **Outbound** ??? `twilio.provider.js`: `sendMessage()` via Twilio SDK

## AI Orchestrator Loop

The `ConversationOrchestrator` runs up to **6 iterations** of:
1. Load conversation history from PostgreSQL (last 20 messages per `user_id`) ([[persistent-conversation-memory]])
2. Send system prompt + history + user message + 9 tool schemas to Groq
3. If LLM returns tool calls -> execute via `ToolExecutor` against ERP-service REST APIs ([[tool-calling-over-direct-db]])
4. Feed tool results back to LLM
5. Repeat until LLM returns a final text response
6. Persist user message + assistant response to memory

## Tool Execution

9 registered tools, all executing against ERP-service REST APIs with `x-service-key` + `x-tenant-id` headers:
- `search_products`, `get_product_details` ??? catalog lookup
- `get_inventory` ??? stock availability check
- `get_customer`, `get_customer_orders` ??? customer identity & history
- `create_order`, `get_order_status` ??? order lifecycle
- `search_knowledge_base` ??? RAG hybrid search against uploaded PDFs ([[rag-hybrid-search]])
- **Idempotency**: SHA-256 cache prevents duplicate side-effects (e.g., double order creation)
