---
slug: background
title: Project background
role: project background
updated: "2026-09-09T19:33:07"
---

# Project background

## Why

DISTROSYNC automates the order pipeline between WhatsApp and legacy ERP systems for small/medium distributors, wholesalers, and retailers in emerging markets.

Retailers send unstructured WhatsApp messages (text, voice notes, photos of handwritten lists) like *"Send 10 cartons of 500ml shampoo to store 2 by tomorrow"*. Today, human operators manually read these chats, check paper registers, type sales orders into Tally/SAP/Busy/Marg, and reply on WhatsApp with confirmations. DISTROSYNC replaces this entire manual pipeline with an AI-driven conversational bridge.

**DISTROSYNC is NOT an ERP.** It does not store general ledgers, print tax invoices, or manage balance sheets. It is an **intelligent adapter** that allows existing legacy ERPs to interact naturally over WhatsApp.

## Goals

- **Zero-touch order capture**: a retailer's WhatsApp message becomes a confirmed ERP sales order with no human data entry.
- **Multi-ERP support**: the same AI core connects to Tally, SAP, Busy, Marg, or Oracle NetSuite via a plugin adapter layer.
- **Multi-tenant SaaS**: each distributor company is a fully isolated tenant (data, config, WhatsApp number).
- **Sub-30s response latency**: from WhatsApp message to AI-confirmed reply within one Twilio webhook timeout window.
- **Colloquial language understanding**: handle Hindi-English code-switching, abbreviations, voice notes, and photo-based orders.

## Non-goals

- **Building an ERP**: no invoicing, accounting, GST filing, or balance sheet features ? those stay in the customer's existing ERP.
- **Consumer-facing e-commerce**: this is B2B distributor-to-retailer, not D2C.
- **Self-hosted messaging infrastructure**: WhatsApp delivery is via Twilio / Meta Cloud API, not a custom XMPP stack.
- **Real-time analytics dashboard** (deferred to post-MVP).

## Target user

**Primary**: Small-to-medium Indian distributors / wholesalers (?1?50 Cr annual revenue) who already use WhatsApp as their primary sales channel and a legacy desktop ERP (Tally Prime, Busy, Marg) for accounting.

**Secondary**: Their retailer customers, who interact purely through WhatsApp and need zero onboarding.

**Pain point**: Manual, error-prone, slow order capture that requires dedicated human operators to bridge WhatsApp conversations and ERP data entry.
