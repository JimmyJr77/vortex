# Billing Requirements Implementation Log

**Policy source:** [BILLING_OPERATIONS_POLICY.md](./BILLING_OPERATIONS_POLICY.md)

**Started:** July 20, 2026

**Method:** Complete and verify one section before advancing to the next.

## Status legend

- `IN PROGRESS` — implementation or verification is underway.
- `COMPLETE` — code, configuration, and required verification evidence are recorded.
- `PENDING` — work has not started.
- `DECISION NEEDED` — implementation requires an Owner/Admin policy decision.

## Requirements register

| # | Section | Status | Completion evidence |
|---|---|---|---|
| 1 | Centralize financial alerts and replies through `billing@vortexathletics.com` | COMPLETE | PR #4; production commit `330e70f`; Render live and healthy; Stripe support email and Render variables verified; 15 focused tests passed. |
| 2 | Failed-payment alert with staff-reviewed suspend and restore actions | IN PROGRESS | Current alert schema and admin Billing surface under implementation review. |
| 3 | Billing-dashboard cancellation review, including multi-month programs | PENDING | — |
| 4 | Refund exception approval and supporting evidence | PENDING | — |
| 5 | Structured missed-class tracking on athlete profiles | PENDING | — |
| 6 | Dispute ownership, evidence workflow, and deadline visibility | PENDING | — |
| 7 | Automated reconciliation and unresolved operational alerts | PENDING | — |
| 8 | First-live-payment and analytics attribution verification | PENDING | Requires a legitimate customer transaction. |

## Section 1 — Centralized financial communications

### Requirements

- All internal financial alerts are delivered to `billing@vortexathletics.com`.
- Replies to enrollment receipts, payment receipts, payment-failure notices, refund notices, and billing alerts use `billing@vortexathletics.com`.
- Nonfinancial email continues to use its configured monitored reply-to address.
- Production service and reconciliation-job configuration use the billing mailbox explicitly.
- Stripe customer-facing support/financial email is `billing@vortexathletics.com`.

### Implementation log

- Added financial email categories and centralized financial Reply-To enforcement.
- Added a validated billing-mailbox policy with the Vortex billing address as the safe default.
- Classified enrollment receipts as financial mail.
- Routed operational Stripe alerts exclusively to the billing mailbox.
- Updated backend environment and Render Blueprint examples.
- Added automated routing tests.

### Verification evidence

- Fifteen focused email classification, Reply-To routing, and guardrail tests passed.
- Full production frontend build passed.
- GitHub PR [#4](https://github.com/JimmyJr77/vortex/pull/4) passed Vercel CI and merged as `330e70f`.
- Render deployed `330e70f`, reported `Live`, and `/api/health` confirmed email and database connectivity.
- Render production contains `BILLING_ALERT_EMAIL` and `BILLING_REPLY_TO`.
- Stripe public support email displays `billing@vortexathletics.com`.

Section completed July 20, 2026.

## Section 2 — Failed-payment suspension and restoration

Status: `IN PROGRESS`

Approved behavior: honor Stripe Smart Retries for eight attempts over fourteen days, then create a staff alert with reviewed **Suspend access** and **Restore access** actions. Never suspend automatically. Every action must record actor, timestamp, reason, affected enrollments, and customer-notification result.

### Implementation log

- Detects an exhausted Stripe invoice recovery sequence only when at least one attempt occurred and no next retry remains.
- Creates a critical, family-linked `payment_recovery_exhausted` alert without changing access.
- Enriches the staff review with balance due, last failure, athletes, programs, and subscription status.
- Adds confirmed **Suspend access** and **Restore access** actions requiring a staff-entered reason.
- Pauses only active billing subscriptions and confirmed scheduling signups linked to those subscriptions.
- Tags enrollment pauses as `billing_recovery` so restoration cannot overwrite an unrelated pause.
- Synchronizes linked Stripe subscriptions and compensates already-updated Stripe subscriptions if a later update fails.
- Records actor, reason, affected record IDs, Stripe outcomes, timestamps, and customer-notification result in an immutable action table.
- Sends the family a financial notification for suspension or restoration through the centralized billing Reply-To.
- Prevents a suspended alert from being marked resolved until access is restored.

### Verification evidence

- Focused service tests cover final-retry detection and exact subscription/signup suspension targeting.
- TypeScript production build passed.
- Production deployment and authenticated UI verification pending.
