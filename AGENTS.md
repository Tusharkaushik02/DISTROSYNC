# DISTROSYNC — Agent Guide

DISTROSYNC is an autonomous AI-powered B2B order orchestration system for FMCG and pharmaceutical distributors. It bridges WhatsApp messaging (Twilio/Meta) with on-premise ERPs (TallyPrime/Tally.ERP 9) via an outbound persistent WebSocket connector and Groq LLM tool calling.

<!-- BEGIN brain.md -->
## Project Brain

This project keeps a **Project Brain**: a persistent memory layer of its durable decisions, requirements, and constraints. Read `./BRAIN.md` for the full read/write contract.

Maintain the brain as part of normal coding work — not as a separate task. While discussing or implementing features:
- **Start of a task:** load relevant context with the `brain` CLI (`list-pages`, `read-page`, `read-root`). Prefer a narrow read over scanning everything.
- **When a decision, requirement, constraint, or durable insight settles** (in chat or while coding): capture it immediately via the `brain` CLI. Do not wait to be asked and do not batch it for later.
- **Pure implementation with no new decision:** do not write to the brain.
- **When overturning a prior conclusion:** update the page (`update-truth` and/or `append-timeline` with `kind: reversal`, or `archive-page`).
- Only store what will still matter in six months and is hard to reconstruct from the code alone.
- All reads and writes go through the `brain` CLI — never hand-edit brain files.

The brain skills (`brain-setup`, `brain-page`, `brain-ingest`, `brain-bootstrap`) are installed in your global skills directory. Prefer `brain init` to scaffold a new project.
<!-- END brain.md -->

## Architecture & Microservices

| Service | Directory | Tech Stack | Port | Primary Responsibility |
|---------|-----------|------------|------|------------------------|
| **User Service** | `user-service/` | Node.js, Express, Prisma, PostgreSQL, Redis | `3000` | Tenant signup, JWT cookie auth, OTP verification, company settings |
| **WhatsApp Service** | `whatsapp-service/` | Node.js, Express, Twilio SDK | `4001` | Inbound webhook validation, CanonicalEvent normalization, outbound message dispatch |
| **ERP Service** | `ERP-service/` | Node.js, Express, Prisma, PostgreSQL, ws | `4002` | Tenant business entities (products, inventory, orders), connector pairing & WebSocket gateway (`/ws/connector`) |
| **AI Service** | `AI-service/` | Python 3.12, FastAPI, asyncpg, Qdrant, Groq LLM | `8000` | Multi-turn tool-calling loop, PostgreSQL conversation memory, RAG hybrid search |
| **Tally Connector** | `connector/` | Node.js, ws, Express, pkg | `9123` | On-premise agent bridging local TallyPrime XML HTTP server (`:9000`) to ERP-service via outbound WebSocket |

## Key Developer & Operational Commands

### 1. Docker Compose (Full Backend Stack)
```powershell
docker-compose up -d
```
Spins up `user-service`, `whatsapp-service`, `ERP-service`, `AI-service`, 3 PostgreSQL databases (`postgres`, `distrosync_erp`, `distrosync_ai`), and Redis.

### 2. Running Individual Services Locally
- **ERP-Service**: `cd ERP-service && npm install && npm run dev`
- **AI-Service**: `cd AI-service && poetry run uvicorn app.main:app --reload --port 8000`
- **WhatsApp-Service**: `cd whatsapp-service && npm install && npm run dev`
- **User-Service**: `cd user-service && npm install && npm run dev`

### 3. Tally Connector Workflow
- **Prerequisites**: TallyPrime running on Windows with ODBC/XML enabled on port `9000` and a company loaded.
- **Generate Pairing Code**: `POST http://localhost:4002/api/v1/connector/pair-code` (returns 6-digit code).
- **Run Connector (Dev)**: `cd connector && npm install && npm start`
- **Build Standalone Exe**: `cd connector && npm run build:exe` (outputs `connector/dist/tally-connector.exe`)
- **Pairing UI**: Opens automatically at `http://localhost:9123`. Enter pairing code to establish persistent connection.
- **Check Status**: `GET http://localhost:4002/api/v1/connector/status`

### 4. Testing
- **AI-Service**: `cd AI-service && poetry run pytest`
- **Connector**: `cd connector && npm test`
- **ERP-Service**: `cd ERP-service && npm test`
- **Brain Integrity**: `brain lint-links` and `brain reindex`

## Core Rules & Memory Synchronization
- **Context Contract**: Always use and keep synchronized the Project Brain (`brain/`), `AGENTS.md`, and `CLAUDE.md`. Any new decision, architectural change, or workflow update must be captured in the brain CLI (`brain update-truth`, `brain append-timeline`, `brain update-root`) and mirrored in agent docs.
- **Order Flow & Tally Entry**:
  - Inbound WhatsApp orders are validated by `AI-service` and persisted transactionally to `distrosync_erp` PostgreSQL database with inventory reservation.
  - Tally live sync operates over the persistent WebSocket gateway (`/ws/connector`) to the on-premise agent. Connector supports inventory/customer read queries and raw XML voucher execution.


