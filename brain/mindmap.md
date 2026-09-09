---
slug: mindmap
title: Feature mindmap
role: feature mindmap
updated: "2026-09-09T19:34:49"
---

# Feature mindmap

```mermaid
mindmap
  root((DISTROSYNC))
    WhatsApp Gateway
      Twilio Sandbox Adapter
      Meta Cloud API Adapter planned
      CanonicalEvent Normalization
      Signature Verification
      Outbound Messaging
    AI Intelligence Engine
      Groq LLM Client
      Conversation Orchestrator
      System Prompt and Anti-Hallucination
      Multi-Turn Tool Calling 9 tools
      Idempotency Cache SHA-256
    Conversation Memory
      PostgreSQL asyncpg
      Per-User History by WaId
      Sliding Window LIMIT 20
    RAG Document Search
      PDF Text Extraction pypdf
      Chunking and Embedding SentenceTransformers
      Qdrant Vector Store
      BM25 Sparse Ranking
      Hybrid Dense plus Sparse Search
    ERP Service Core Mock
      Product Catalog CRUD
      Inventory Management and Reservation
      Customer Registry
      Order Lifecycle PENDING to DELIVERED
      Document Upload and PDF Parsing
    User and Tenant Management
      OTP Signup and Email Verification
      JWT Cookie Auth Access plus Refresh
      Redis Session Storage
      Company Configuration
      WhatsApp Config per Company
      ERP Config per Company schema only
    ERP Plugin Layer planned
      Tally XML HTTP Adapter
      SAP BAPI RFC Adapter
      Busy REST Adapter
      Marg JSON Adapter
      Oracle NetSuite Adapter
    Infrastructure
      Docker Compose unified
      3x PostgreSQL Databases
      Redis Cache
      Qdrant Local Vector Store
```
