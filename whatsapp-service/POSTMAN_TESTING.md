# Postman Testing Guide — WhatsApp Inbound Webhook Pipeline

This document is a practical testing guide for the **inbound WhatsApp webhook ingestion pipeline** (`POST /api/v2/whatsapp/webhook`).

---

## 1. Environment & Base URL

Set up the following in your Postman Environment:

| Variable | Example Value | Description |
| :--- | :--- | :--- |
| `baseUrl` | `http://localhost:4001` | Local service host and port (`PORT` in `.env`) |
| `webhookPath` | `/api/v2/whatsapp/webhook` | Canonical pipeline endpoint |

---

## 2. Available Endpoints

The inbound pipeline is hosted at a single dedicated ingestion endpoint:

| Method | Endpoint | Purpose | Body Type |
| :--- | :--- | :--- | :--- |
| `POST` | `{{baseUrl}}/api/v2/whatsapp/webhook` | Ingests, authenticates, validates, normalizes, classifies, and dispatches incoming Twilio WhatsApp webhooks. | `x-www-form-urlencoded` |

> **Note**: Legacy endpoint `POST /api/whatsapp/webhook` is also mounted for backwards compatibility. All tests below target the canonical v2 pipeline (`/api/v2/whatsapp/webhook`).

---

## 3. Twilio Signature & Authentication in Postman

The pipeline enforces Twilio HMAC-SHA1 authentication via `X-Twilio-Signature`.

* **Missing Signature**: Returns `401 Unauthorized`.
* **Invalid Signature**: Returns `403 Forbidden`.
* **Testing Signature Verification**:
  * **Option 1 (Real Webhook / ngrok)**: Send messages from a live WhatsApp sandbox connected to your ngrok tunnel URL (`TWILIO_WEBHOOK_URL`). Twilio calculates and includes the authentic signature automatically.
  * **Option 2 (Postman Pre-request Script)**: You can calculate a valid `X-Twilio-Signature` in Postman using the CryptoJs library if testing directly against local URLs.
  * **Option 3 (Negative Testing)**: Sending requests without the header verifies that unauthorized requests are blocked before schema validation or normalization.

---

## 4. Test Requests

### A. Valid Text Message

Verifies: **Authentication → Schema Validation (Text) → Normalization → Classification (`message.text`) → Dispatcher**

* **Method**: `POST`
* **URL**: `{{baseUrl}}/api/v2/whatsapp/webhook`
* **Headers**:
  * `Content-Type`: `application/x-www-form-urlencoded`
  * `X-Twilio-Signature`: `{{twilioSignature}}`
* **Body** (`x-www-form-urlencoded`):

| Key | Value |
| :--- | :--- |
| `MessageSid` | `SM1234567890abcdef1234567890abcdef` |
| `AccountSid` | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `From` | `whatsapp:+14155238886` |
| `To` | `whatsapp:+14155238886` |
| `Body` | `Send me 10 boxes of Coke` |
| `ProfileName` | `John Doe` |
| `WaId` | `14155238886` |
| `NumMedia` | `0` |

* **Expected Response (`200 OK`)**:
```json
{
  "success": true,
  "event": "message.text",
  "canonicalEvent": {
    "id": "SM1234567890abcdef1234567890abcdef",
    "provider": "twilio",
    "channel": "whatsapp",
    "eventType": "message",
    "messageType": "text",
    "sender": {
      "phone": "+14155238886",
      "name": "John Doe",
      "waId": "14155238886"
    },
    "recipient": {
      "phone": "+14155238886"
    },
    "content": {
      "text": "Send me 10 boxes of Coke",
      "media": [],
      "caption": null
    }
  }
}
```
* **Server Console Log**: `[Webhook] message.text from +14155238886`

---

### B. Image / Media Message

Verifies: **Media Schema Validation (`NumMedia`, `MediaUrl0`, `MediaContentType0`) → Normalization → Classification (`message.image`) → Dispatcher**

* **Method**: `POST`
* **URL**: `{{baseUrl}}/api/v2/whatsapp/webhook`
* **Headers**:
  * `Content-Type`: `application/x-www-form-urlencoded`
  * `X-Twilio-Signature`: `{{twilioSignature}}`
* **Body** (`x-www-form-urlencoded`):

| Key | Value |
| :--- | :--- |
| `MessageSid` | `MM1234567890abcdef1234567890abcdef` |
| `AccountSid` | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `From` | `whatsapp:+14155238886` |
| `To` | `whatsapp:+14155238886` |
| `Body` | `Here is my store receipt` |
| `NumMedia` | `1` |
| `MediaUrl0` | `https://api.twilio.com/2010-04-01/Accounts/AC/Messages/MM/Media/ME1` |
| `MediaContentType0` | `image/jpeg` |

* **Expected Response (`200 OK`)**:
```json
{
  "success": true,
  "event": "message.image",
  "canonicalEvent": {
    "eventType": "message",
    "messageType": "image",
    "content": {
      "text": "Here is my store receipt",
      "media": [
        {
          "index": 0,
          "url": "https://api.twilio.com/2010-04-01/Accounts/AC/Messages/MM/Media/ME1",
          "contentType": "image/jpeg"
        }
      ],
      "caption": "Here is my store receipt"
    }
  }
}
```
* **Server Console Log**: `[Webhook] message.image from +14155238886`

---

### C. Audio Message

Verifies: **Audio MIME recognition (`audio/ogg`) → Classification (`message.audio`) → Dispatcher**

* **Method**: `POST`
* **URL**: `{{baseUrl}}/api/v2/whatsapp/webhook`
* **Headers**:
  * `Content-Type`: `application/x-www-form-urlencoded`
  * `X-Twilio-Signature`: `{{twilioSignature}}`
* **Body** (`x-www-form-urlencoded`):

| Key | Value |
| :--- | :--- |
| `MessageSid` | `MM2234567890abcdef1234567890abcdef` |
| `AccountSid` | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `From` | `whatsapp:+14155238886` |
| `To` | `whatsapp:+14155238886` |
| `NumMedia` | `1` |
| `MediaUrl0` | `https://api.twilio.com/2010-04-01/Accounts/AC/Messages/MM/Media/ME2` |
| `MediaContentType0` | `audio/ogg` |

* **Expected Response (`200 OK`)**:
```json
{
  "success": true,
  "event": "message.audio",
  "canonicalEvent": {
    "eventType": "message",
    "messageType": "audio"
  }
}
```
* **Server Console Log**: `[Webhook] message.audio from +14155238886`

---

### D. Document Message

Verifies: **Document MIME detection (`application/pdf`) → Classification (`message.document`) → Dispatcher**

* **Method**: `POST`
* **URL**: `{{baseUrl}}/api/v2/whatsapp/webhook`
* **Headers**:
  * `Content-Type`: `application/x-www-form-urlencoded`
  * `X-Twilio-Signature`: `{{twilioSignature}}`
* **Body** (`x-www-form-urlencoded`):

| Key | Value |
| :--- | :--- |
| `MessageSid` | `MM3234567890abcdef1234567890abcdef` |
| `AccountSid` | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `From` | `whatsapp:+14155238886` |
| `To` | `whatsapp:+14155238886` |
| `Body` | `Purchase Order PDF` |
| `NumMedia` | `1` |
| `MediaUrl0` | `https://api.twilio.com/2010-04-01/Accounts/AC/Messages/MM/Media/ME3` |
| `MediaContentType0` | `application/pdf` |

* **Expected Response (`200 OK`)**:
```json
{
  "success": true,
  "event": "message.document",
  "canonicalEvent": {
    "eventType": "message",
    "messageType": "document"
  }
}
```
* **Server Console Log**: `[Webhook] message.document from +14155238886`

---

### E. Invalid Request (Validation Failure)

Verifies: **Zod Schema Rejection & Structured Field Error Output**

* **Method**: `POST`
* **URL**: `{{baseUrl}}/api/v2/whatsapp/webhook`
* **Headers**:
  * `Content-Type`: `application/x-www-form-urlencoded`
  * `X-Twilio-Signature`: `{{twilioSignature}}`
* **Body** (`x-www-form-urlencoded`): Missing `From` and `MessageSid`.

| Key | Value |
| :--- | :--- |
| `AccountSid` | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `To` | `whatsapp:+14155238886` |
| `Body` | `Testing invalid missing fields` |

* **Expected Response (`400 Bad Request`)**:
```json
{
  "error": true,
  "type": "ValidationError",
  "code": "VALIDATION_ERROR",
  "message": "Webhook payload validation failed",
  "details": [
    {
      "field": "MessageSid",
      "code": "MISSING_FIELD",
      "message": "SID is required"
    },
    {
      "field": "From",
      "code": "MISSING_FIELD",
      "message": "Phone number is required"
    }
  ]
}
```

---

### F. Status Event / Unknown Event

#### 1. Status Event
* **Body**: `MessageSid=SM123&AccountSid=AC123&MessageStatus=delivered`
* **Expected Response (`200 OK`)**:
```json
{
  "success": true,
  "event": "status",
  "canonicalEvent": {
    "eventType": "status",
    "messageType": null,
    "content": {
      "status": "delivered"
    }
  }
}
```

#### 2. Unknown / Unsupported Event
* **Body**: Payload passing validation with non-standard content.
* **Expected Response (`200 OK`)**:
```json
{
  "success": true,
  "event": "unknown",
  "canonicalEvent": {
    "eventType": "unknown",
    "messageType": null
  }
}
```

---

### G. Missing or Invalid Twilio Signature

#### 1. Missing Signature
* **Headers**: Do NOT include `X-Twilio-Signature`.
* **Expected Response (`401 Unauthorized`)**:
```json
{
  "error": true,
  "type": "AuthenticationError",
  "code": "AUTHENTICATION_ERROR",
  "message": "Missing X-Twilio-Signature header"
}
```

#### 2. Invalid Signature
* **Headers**: `X-Twilio-Signature: invalid_test_signature_string`
* **Expected Response (`403 Forbidden`)**:
```json
{
  "error": true,
  "type": "AuthenticationError",
  "code": "AUTHENTICATION_ERROR",
  "message": "Invalid Twilio signature"
}
```

---

## 5. Recommended Postman Collection Organization

```text
DistroSync WhatsApp Webhook
├── 01 Valid Text Message        [POST /api/v2/whatsapp/webhook]
├── 02 Image Message             [POST /api/v2/whatsapp/webhook]
├── 03 Audio Message             [POST /api/v2/whatsapp/webhook]
├── 04 Document Message          [POST /api/v2/whatsapp/webhook]
├── 05 Status Callback           [POST /api/v2/whatsapp/webhook]
├── 06 Invalid Request (Missing) [POST /api/v2/whatsapp/webhook]
├── 07 Missing Signature         [POST /api/v2/whatsapp/webhook]
└── 08 Invalid Signature         [POST /api/v2/whatsapp/webhook]
```
