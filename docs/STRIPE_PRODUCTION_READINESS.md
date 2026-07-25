# Stripe production readiness and operations

Last reviewed: July 25, 2026

This document is the operator contract for Vortex billing. The application ledger remains
the business source of truth; Stripe is the collection, subscription, refund, and dispute
processor. A green deployment alone does not prove that live payments are ready.

## Customer transparency

Customers can:

- review the server-calculated enrollment order before leaving for Stripe Checkout;
- see recurring versus one-time pricing, discounts, fees, credits, payments, refunds,
  upcoming billing dates, and the current balance in the member portal;
- manage payment methods through a short-lived Stripe Customer Portal session;
- return from paid, cancelled, recovery, and portal-management flows to an explicit status
  banner and refreshed billing context;
- receive registration, payment, failed-payment, refund, access-change, and secure
  payment-request emails with a monitored billing reply address;
- request cancellation without silently changing access or billing before staff review.

## Admin controls

The Billing admin provides:

- server-authoritative family search, balances, ledger, statements, subscriptions, passes,
  charges, payments, credits, and refunds;
- secure balance-link delivery using the exact current ledger balance and a 24-hour Stripe
  Checkout session—staff cannot type an arbitrary card amount;
- explicit payment- and refund-receipt resend actions;
- an immutable customer-service action history recording action type, initiating user,
  family billing account, amount, related payment/refund, Stripe object, outcome, and error;
- evidence-gated refunds, subscription pause/resume/cancel controls, dispute ownership,
  cancellation review, access recovery, and manual reconciliation;
- a non-secret production-readiness checklist showing Stripe mode, webhook signing,
  reconciliation freshness, webhook failures, critical alerts, and customer-email domain
  verification.
- recent reconciliation history and failed/stale webhook incident details, including
  attempts and a bounded error summary, without requiring database access.
- resolution notes and authenticated resolver identity for every manually closed billing
  operations alert.
- strict manual-ledger validation: credits must be negative, refunds use the refund workflow,
  gross/discount/net values must reconcile, and every manual payment preserves method, note,
  and authenticated recorder.

All mutating controls require `billing.manage`; read-only billing visibility requires
`billing.view`.

## Automated safety invariants

- Live-mode webhooks require a signing secret, signature, and unparsed request body.
- Webhook event IDs are claimed once and failed events may be retried without replaying
  completed work.
- PaymentIntent, Checkout Session, invoice, and refund identifiers have uniqueness guards.
- Stripe-generated ledger payments and purchase analytics are emitted only for the first
  successful insert.
- Refunds validate the refundable remainder and use a stable Stripe idempotency key.
- Admin-created Stripe refunds do not send a second receipt when their webhook arrives.
- Reconciliation recovers mappable missing payments and raises alerts for amount drift,
  unmapped money, disputes, stale processing, and failures.
- No secret values are returned by an admin API or displayed in the browser.

## Go-live checklist

The Stripe operations card must show every automated check passing:

1. Stripe collection enabled.
2. Live API key detected.
3. At least one `whsec_` webhook signing secret configured.
4. Successful reconciliation completed within 26 hours.
5. Zero failed webhook events in the last seven days.
6. Zero unresolved critical billing alerts.
7. Stripe customer email domain verified.

Deployment configuration must also contain:

- `STRIPE_ENABLED=true`
- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...` (or a rotation list in
  `STRIPE_WEBHOOK_SECRETS`)
- `STRIPE_EMAIL_DOMAIN` and `STRIPE_EMAIL_DOMAIN_VERIFIED=true`
- the public app URL used by Checkout, Customer Portal, and email links
- the monitored `BILLING_REPLY_TO` / `BILLING_ALERT_EMAIL`

Stripe must deliver, at minimum:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.finalization_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`
- `refund.created`
- `refund.updated`
- `refund.failed`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`

## Live acceptance gate

Production acceptance still requires one legitimate customer transaction. For that
transaction, confirm the same Stripe transaction context across:

1. Stripe PaymentIntent and Checkout Session;
2. local payment, charge, subscription, and enrollment records;
3. exactly one customer payment/registration receipt;
4. exactly one GA4 `purchase`;
5. acquisition-only conversion behavior documented in
   [FIRST_LIVE_PAYMENT_VERIFICATION.md](./FIRST_LIVE_PAYMENT_VERIFICATION.md).

Do not fabricate a payment to claim this gate. Record the real transaction date and
evidence in `BILLING_REQUIREMENTS_LOG.md`.

## Incident response

1. Disable new collection with `STRIPE_ENABLED=false` if money integrity is uncertain.
2. Leave webhook signing enabled and retain event history.
3. Review open critical alerts, failed webhooks, disputes, and the latest reconciliation.
4. Reconcile a bounded lookback from the admin after correcting the root cause.
5. Restore customer access only through the recovery control so the action is audited.
6. Never manually insert a Stripe payment merely to clear an alert; recovery must use the
   Stripe identifier and the reconciliation path.
