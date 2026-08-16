# Outgoing Webhooks UI

Route `/settings/webhooks` → `WebhooksListPage.tsx` (+ `CreateWebhookDialog`, `EditWebhookDialog`, `WebhookDeliveriesDialog`). Client in `src/lib/api/webhooks.ts` → `/api/v1/outgoing-webhooks`.

`UpdateWebhookRequest.secret` is three-state and destructive: omitted keeps the stored secret, a string replaces it, `null` **clears** it (deliveries then go out unsigned, no `X-Spooled-Signature`). `JSON.stringify` drops `undefined` but keeps `null`, so never serialise an untouched secret field — `EditWebhookDialog` only sets it when the user typed a new secret or ticked "Remove signing secret".

Backend disables a webhook after 20 consecutive failed deliveries (`enabled=false`, `last_status="auto_disabled"`); `failure_count` counts deliveries, not retry attempts, and any success resets it. Re-enabling is `PUT {"enabled": true}` and is charged against the plan webhook cap, so it can return 429 `QUOTA_EXCEEDED` — surface it via `APIError.isQuotaExceeded()`.

Delivery history is a rolling window: newest 100 per webhook, swept at the plan's `history_retention_days` (free 1, starter 7, pro 30, enterprise 90).
