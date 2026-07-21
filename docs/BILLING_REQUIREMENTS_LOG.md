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
| 2 | Failed-payment alert with staff-reviewed suspend and restore actions | COMPLETE | PR #5; production commit `f2194d8`; Vercel passed; Render live and healthy; focused tests and production build passed. |
| 3 | Billing-dashboard cancellation review, including multi-month programs | COMPLETE | PR #6; production commit `1835efc`; Vercel passed; Render live; eight focused tests and production build passed. |
| 4 | Refund exception approval and supporting evidence | IN PROGRESS | Owner/Admin identity, approved-exception classification, and evidence validation implemented locally; release verification underway. |
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

Status: `COMPLETE`

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
- GitHub PR [#5](https://github.com/JimmyJr77/vortex/pull/5) passed Vercel CI and merged as `f2194d8`.
- Render deployed `f2194d8`, reported `Live`, and `/api/health` confirmed email and database connectivity.

Section completed July 20, 2026.

## Section 3 — Cancellation review

Status: `COMPLETE`

Approved behavior: member cancellation requests go to the Billing dashboard for review. Recurring memberships normally remain active through the paid period and end without proration; fixed-term or multi-month programs must be visibly flagged for individual review. Waitlisted enrollments may be removed immediately because they have no active billing.

### Implementation log

- Added a durable cancellation-request record with pending, approved, declined, and withdrawn lifecycle states.
- Kept enrollment access and billing unchanged while a request is pending.
- Added family-entered cancellation context and clear member-portal language explaining review status.
- Added a Billing dashboard queue showing athlete, class, billing email, requested reason, recommended end date, and fixed-term program end date.
- Requires a staff review note for approval or decline and allows an authorized effective-date override.
- On approval, schedules local enrollment and subscription termination without proration and synchronizes the Stripe subscription end date.
- Preserves immediate cancellation for unbilled waitlist positions.

### Verification evidence

- Five focused enrollment cancellation tests passed.
- Full TypeScript production build passed.
- GitHub PR [#6](https://github.com/JimmyJr77/vortex/pull/6) passed Vercel CI and merged as `1835efc`.
- Render deployed `1835efc` and reported `Live` after its database migration and health checks.

Section completed July 20, 2026.

## Section 4 — Refund exception approval

Status: `IN PROGRESS`

Approved behavior: fees are non-refundable except duplicate charges, a Vortex cancellation, documented medical issues, relocation, or Owner discretion. Only an Owner/Admin may approve a refund, and every refund must preserve its exception category, supporting evidence or approval note, approver identity, and approval time.

### Implementation log

- Added structured exception categories matching the approved policy.
- Requires supporting evidence or an Owner/Admin approval note before refund creation.
- Requires the authenticated approving user and records approver identity and timestamp with the refund.
- Blocks the Billing UI from issuing a refund until both exception and evidence fields are complete.
- Retains Stripe idempotency, refundable-balance validation, and webhook synchronization.

### Verification evidence

- Focused validation tests and the full production build pass locally.
- Release and production verification pending.
