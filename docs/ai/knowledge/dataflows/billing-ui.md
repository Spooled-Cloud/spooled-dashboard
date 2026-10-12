# Billing UI

Route `/settings/billing` → `BillingPage.tsx` → `GET /billing/status`, `POST /billing/portal`. Upgrade CTA → marketing pricing URL. No Stripe secrets in dashboard env `PUBLIC_*`.

Manage billing (`handleManageBilling`, `src/components/settings/BillingPage.tsx:122-128`) opens a blank tab synchronously inside the click (`window.open('', '_blank')`, `:123`) and points it at the Stripe URL returned by `POST /billing/portal` (`:102-104`). If that tab was blocked or closed, the page continues in the same tab (`window.location.assign`, `:108`). A portal error closes the pre-opened tab and shows "Failed to open billing portal" (`:112-118`). The page shows no "Popup blocked" toast.
