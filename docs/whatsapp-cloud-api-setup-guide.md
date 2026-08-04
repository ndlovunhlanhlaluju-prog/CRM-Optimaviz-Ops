# WhatsApp Cloud API Setup Guide for Optima CRM

Use this guide when you are ready to connect WhatsApp directly inside the CRM.

The CRM is already prepared for brand-by-brand WhatsApp connections. Each brand can have its own WhatsApp number, Phone Number ID, WhatsApp Business Account ID, access token, and webhook verify token.

## What You Need Per Brand

For each brand, collect these values:

| Item | Where it goes in the CRM |
| --- | --- |
| WhatsApp business phone number | WhatsApp Number |
| Phone Number ID | Phone Number ID |
| WhatsApp Business Account ID, also called WABA ID | WhatsApp Business Account ID |
| Access token environment variable name | Access Token Env Name |
| Webhook verify token | Webhook Verify Token |

The real access token should stay in the server `.env` file, not inside the CRM screen.

## 1. Where To Start

Go to:

- https://whatsappbusiness.com/developers/developer-hub/
- https://developers.facebook.com/

In Meta for Developers:

1. Open **My Apps**.
2. Create or open your Meta app.
3. Add or open the **WhatsApp** product.
4. Go to **WhatsApp > API Setup** or **WhatsApp > Getting Started**.

This is where Meta shows the test number, temporary token, Phone Number ID, and WhatsApp Business Account ID.

## 2. Access Token

There are two kinds of access tokens.

### Temporary Test Token

Use this only for testing.

1. Go to **Meta for Developers**.
2. Open your app.
3. Go to **WhatsApp > API Setup** or **Getting Started**.
4. Click **Generate access token**.
5. Use it only for quick testing because it expires.

### Production Token

Use this for the real CRM connection.

1. Go to https://business.facebook.com/settings
2. Open the correct business portfolio.
3. Go to **Users > System Users**.
4. Create a system user.
5. Give the system user access to:
   - The Meta app
   - The WhatsApp Business Account
6. Generate an access token for that system user.
7. Select these permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
8. Copy the token once and keep it safe.

Put the token in `.env`.

Example:

```env
WHATSAPP_TASKGO_ACCESS_TOKEN=paste_real_taskgo_token_here
WHATSAPP_IDAO_ACCESS_TOKEN=paste_real_idao_token_here
WHATSAPP_NESTWISE_ACCESS_TOKEN=paste_real_nestwise_token_here
WHATSAPP_OPTIMAVIZ_ACCESS_TOKEN=paste_real_optimaviz_token_here
WHATSAPP_OPTIMACLEAN_ACCESS_TOKEN=paste_real_optimaclean_token_here
```

Then in the CRM, go to:

**Integrations > select brand > WhatsApp Provider > WhatsApp Cloud API**

For TaskGo, the **Access Token Env Name** should be:

```text
WHATSAPP_TASKGO_ACCESS_TOKEN
```

For IDAO:

```text
WHATSAPP_IDAO_ACCESS_TOKEN
```

## 3. Phone Number ID

The Phone Number ID is not the actual phone number. It is a Meta ID for that WhatsApp number.

You can usually find it in:

**Meta for Developers > Your App > WhatsApp > API Setup**

or inside:

**WhatsApp Manager > Phone Numbers**

Copy the ID and paste it into the CRM field:

```text
Phone Number ID
```

Do this separately for each brand.

## 4. WhatsApp Business Account ID

This is also called the WABA ID.

You can usually find it in:

**Meta for Developers > Your App > WhatsApp > API Setup**

or:

**Business Settings > Accounts > WhatsApp Accounts**

Paste it into:

```text
WhatsApp Business Account ID
```

## 5. Webhook Verify Token

The webhook verify token is not given by Meta.

You create it yourself.

Example tokens:

```text
taskgo_whatsapp_verify_2026
idao_whatsapp_verify_2026
nestwise_whatsapp_verify_2026
```

Put the same token in two places:

1. In the CRM brand integration field:

```text
Webhook Verify Token
```

2. In Meta when configuring the webhook:

```text
Verify Token
```

The values must match exactly.

## 6. Webhook Callback URL

The CRM webhook path is:

```text
/api/webhooks/whatsapp
```

When the CRM is deployed publicly, the full URL will look like:

```text
https://your-crm-domain.com/api/webhooks/whatsapp
```

Meta cannot send webhooks to a CRM that is only running locally on your computer. The CRM needs a public URL, or a temporary testing tunnel.

## 7. What To Subscribe To In Meta

In Meta webhook settings, subscribe to WhatsApp message events so the CRM can receive:

- Incoming replies
- Sent status
- Delivered status
- Read status
- Failed delivery status

## 8. CRM Setup Checklist

For each brand:

1. Go to **Integrations** in the CRM.
2. Select the brand.
3. Set **WhatsApp Provider** to **WhatsApp Cloud API**.
4. Enter the brand WhatsApp number.
5. Enter the Phone Number ID.
6. Enter the WhatsApp Business Account ID.
7. Enter the access token environment variable name.
8. Enter the webhook verify token.
9. Save the integration profile.
10. Add the real token to `.env`.
11. Restart the CRM server after changing `.env`.

## 9. Example: TaskGo

CRM fields:

```text
WhatsApp Provider: WhatsApp Cloud API
WhatsApp Number: +27...
Phone Number ID: from Meta
WhatsApp Business Account ID: from Meta
Access Token Env Name: WHATSAPP_TASKGO_ACCESS_TOKEN
Webhook Verify Token: taskgo_whatsapp_verify_2026
```

`.env`:

```env
WHATSAPP_TASKGO_ACCESS_TOKEN=paste_real_token_here
```

Meta webhook callback URL:

```text
https://your-crm-domain.com/api/webhooks/whatsapp
```

Meta verify token:

```text
taskgo_whatsapp_verify_2026
```

## 10. Important Notes

- Do not paste real access tokens into screenshots, emails, or the CRM visible fields.
- Keep real access tokens only in `.env` or a proper secret manager.
- Each brand can use a different WhatsApp number and token.
- If the CRM says Manual Mode, the brand is not fully connected yet.
- If the CRM says API Ready, the brand has the needed CRM-side API settings.
- If messages send but replies do not appear, check the public webhook URL and webhook subscription in Meta.

