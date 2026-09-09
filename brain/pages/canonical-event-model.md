---
id: canonical-event-model
title: Provider-Agnostic CanonicalEvent Model for WhatsApp
category: decision
status: active
tags: [architecture, whatsapp, messaging]
created: "2026-09-09T19:36:37"
updated: "2026-09-09T19:43:41"
---

<!-- compiled_truth -->
Inbound WhatsApp payloads differ significantly between providers (Twilio URL-encoded form, Meta Cloud API JSON, 360dialog JSON). Rather than writing provider-specific logic into domain handlers, all inbound payloads are normalized immediately at the boundary into a shared `CanonicalEvent` model.

**Structure:** `CanonicalEvent { type, from (WaId/phone), body (text), timestamp, provider }`

**Why this matters:**
- Switching from Twilio Sandbox to Meta Cloud API (planned for M7) requires only adding a new adapter (`meta.adapter.js`) ??? zero changes to `textHandler`, `ConversationOrchestrator`, or any downstream logic.
- Domain handlers are completely decoupled from provider-specific quirks (URL encoding, nested JSON, signature formats).

**Current state:** Only the Twilio adapter is implemented (`twilio.adapter.js`). The Meta Cloud API adapter is planned as Milestone 7.

**Signature verification** remains provider-specific and runs *before* normalization ??? Twilio uses `X-Twilio-Signature` HMAC, Meta uses `X-Hub-Signature-256`. This is intentional: different security models don't belong in the canonical model.


## Timeline

- time: 2026-09-09T19:36:37
  kind: decision
  summary: "Created this page: Provider-Agnostic CanonicalEvent Model for WhatsApp"
  source: "DISTROSYNC_PROJECT_STATUS.md ADR-2; code: whatsapp-service/src/modules/whatsapp/domain/models/"
  affects: [canonical-event-model]

- time: 2026-09-09T19:43:41
  kind: decision
  summary: "Seeded compiled truth: CanonicalEvent abstraction and Twilio/Meta adapter rationale"
  source: "DISTROSYNC_PROJECT_STATUS.md ADR-2; whatsapp-service/src/modules/whatsapp/"
  affects: [canonical-event-model]
