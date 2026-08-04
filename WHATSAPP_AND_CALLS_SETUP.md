# WhatsApp and Calls Setup

This guide explains the simple customer-facing setup and the owner-level setup for automated WhatsApp and browser calling.

## WhatsApp

### Manual / wa.me

Use this first.

- Users only add their public WhatsApp number in Setup.
- Lujunal opens WhatsApp Web or the phone app with the message prepared.
- The CRM logs the message against the lead.
- No Meta approval, backend key, or Render access is needed.

### WhatsApp Cloud API

Use this when you want messages sent directly from the CRM.

- Each sending number needs a Meta Phone Number ID.
- The access token must stay server-side.
- Users should not add tokens in Render.
- Owner/admin can wire a brand to a server env var name and check setup from the CRM.

If one business has multiple WhatsApp numbers, each number usually has its own Phone Number ID under a WhatsApp Business Account.

### Easy Connect

This is the best long-term flow.

The platform owner configures Meta once, then users connect from inside Lujunal like Gmail:

1. User clicks Connect WhatsApp.
2. Meta opens Embedded Signup.
3. User chooses their WhatsApp Business Account and number.
4. Lujunal stores the brand's WABA ID and Phone Number ID.
5. Lujunal uses server-side credentials to send and receive messages.

Required owner env vars:

```env
META_APP_ID=
META_APP_SECRET=
WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID=
WHATSAPP_EMBEDDED_SIGNUP_REDIRECT_URI=
```

## Calls

### Manual Click-To-Call

Use this first.

- User adds the brand calling number.
- Agents click Call now.
- The device phone app opens with the lead number.
- Agents save outcome, duration, notes, objections, and follow-up date.

No backend phone provider is required.

### Browser Phone

Use this when you want agents to call inside the CRM.

The owner configures one voice provider centrally. Users do not edit server keys.

Required owner env vars for the Twilio-ready foundation:

```env
TWILIO_ACCOUNT_SID=
TWILIO_API_KEY_SID=
TWILIO_API_KEY_SECRET=
TWILIO_TWIML_APP_SID=
TWILIO_CALLER_ID=
```

Twilio is the first supported browser-phone backend. The UI is worded as a provider layer so another provider can be added later without changing the customer setup model.
