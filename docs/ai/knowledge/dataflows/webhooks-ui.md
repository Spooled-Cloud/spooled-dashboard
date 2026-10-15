# Outgoing Webhooks UI

Route `/settings/webhooks` → `WebhooksListPage.tsx` (+ `CreateWebhookDialog`, `EditWebhookDialog`, `WebhookDeliveriesDialog`, `InboundWebhookLog`). Client in `src/lib/api/webhooks.ts` → `/api/v1/outgoing-webhooks` (`webhooksAPI`) and `/api/v1/webhooks/deliveries` (`inboundWebhooksAPI`).

`UpdateWebhookRequest.secret` is three-state and destructive: omitted keeps the stored secret, a string replaces it, `null` **clears** it (deliveries then go out unsigned, no `X-Spooled-Signature`). `JSON.stringify` drops `undefined` but keeps `null`, so never serialise an untouched secret field — `EditWebhookDialog` only sets it when the user typed a new secret or ticked "Remove signing secret".

Backend disables a webhook after 20 consecutive failed deliveries (`enabled=false`, `last_status="auto_disabled"`); `failure_count` counts deliveries, not retry attempts, and any success resets it. Re-enabling is `PUT {"enabled": true}` and is charged against the plan webhook cap, so it can return 429 `QUOTA_EXCEEDED` — surface it via `APIError.isQuotaExceeded()`.

Delivery history is a rolling window: newest 100 per webhook, swept at the plan's `history_retention_days` (free 1, starter 7, pro 30, enterprise 90).

## Events and formats (backend 0.1.122)

`WEBHOOK_EVENTS` lists the 14 events the backend accepts: the original ten plus `job.deadlettered`, `job.retried`, `workflow.completed` and `workflow.failed`. `job.deadlettered` is derived by the backend from any `job.failed` whose data status is `deadletter`; workflow outcomes are sent by the scheduler within about 10 s and only for outcomes seen within an hour; `job.retried` is sent by workflow retry and, once the backend's cross-file change lands, by job and DLQ retry. A backend before 0.1.122 answers 400 for the new names, and the dialogs show that message.

`format` selects the body: `json` (default, the signed envelope), `slack` (`{"text"}`), `discord` (`{"content"}`, at most 2000 characters, mentions never ping) and `teams` (legacy MessageCard; Power Automate Workflows URLs reject it). `WebhookFormatField` is the select of the create and edit dialogs; the list shows a badge with the format. Compatibility: create sends `format` only when it is not `json`, edit only when it changed; a webhook object without `format` (backend before 0.1.122) hides the select in the edit dialog, and a create that asked for a chat format but got a webhook back without one shows a warning toast. Chat services do not verify signatures; a secret is still sent as `X-Spooled-Signature`. The delivery log keeps the JSON envelope whatever the format.

## Deep link

`/settings/webhooks/{id}` has no page of its own: `src/pages/settings/webhooks/[id].astro` answers 302 to `/settings/webhooks?webhook={id}`. Once the list is loaded, `WebhooksListPage` opens that webhook's delivery history (`WebhookDeliveriesDialog`, the detail view) — once per visit — and the address stays `?webhook={id}` while the dialog is open, so a reload or a copied link opens it again. The History button sets the same query and closing the dialog drops it (the `#incoming-webhook-log` hash is kept). An id that is not in the list (deleted, another organization's) leaves the plain list with a "Webhook not found" toast. The server cannot check the id: the list needs the browser's token.

## Retry delivery

`WebhookDeliveriesDialog` shows **Retry** on a `failed` delivery: `POST /outgoing-webhooks/{id}/retry/{delivery_id}` (`webhooksAPI.retryDelivery`). HTTP 200 only means the retry was attempted; `success: false` means the endpoint still refused (error toast with the message). A delivered delivery, or one with 10 attempts already (`WEBHOOK_MANUAL_RETRY_MAX_ATTEMPTS`, the button is disabled), is a 400 with the reason in the message. A manual retry re-renders the delivery with the webhook's current format. The webhook list and the history are refetched afterwards (failure count and last status change).

## Incoming webhook log

`InboundWebhookLog` (below the outgoing webhooks on `/settings/webhooks`, anchor `#incoming-webhook-log`, linked from Organization Settings) reads `GET /api/v1/webhooks/deliveries`: accepted requests to `POST /webhooks/{org_id}/custom`, newest first, as a bare array with no total. Columns: received, event, queue, job (linked), outcome (`created` or `duplicate`; a dash for entries recorded before 0.1.122, which have no job and no outcome). Filters: outcome, a since preset (last hour, 24 hours, 7 days, measured when the list is read), queue (debounced). Paging is `limit` 26 / `offset`, the extra row only tells whether Next is enabled. It never has a payload or signature, and requests with a wrong token or over the rate limit are not logged. It is organization-wide: the backend answers 403 `ACCESS_DENIED` to a queue-scoped key and a backend before 0.1.122 has no route (404), so the section hides itself for a queue-scoped session (without asking) and on 403/404/405.
