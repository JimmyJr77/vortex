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
| 4 | Refund exception approval and supporting evidence | COMPLETE | PR #7; production commit `3b66c0d`; Vercel passed; Render live; focused tests and production build passed. |
| 5 | Structured missed-class tracking on athlete profiles | COMPLETE | PR #8; production commit `4d4e4a2`; Vercel passed; Render live; production build passed. |
| 6 | Dispute ownership, evidence workflow, and deadline visibility | COMPLETE | PR #9; production commit `d3d34f5`; Vercel passed; Render live; focused tests and production build passed. |
| 7 | Automated reconciliation and unresolved operational alerts | IN PROGRESS | Daily reconciliation job, mismatch recovery, failed-webhook alerts, manual action, and dashboard implemented; deployment/config verification underway. |
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

Status: `COMPLETE`

Approved behavior: fees are non-refundable except duplicate charges, a Vortex cancellation, documented medical issues, relocation, or Owner discretion. Only an Owner/Admin may approve a refund, and every refund must preserve its exception category, supporting evidence or approval note, approver identity, and approval time.

### Implementation log

- Added structured exception categories matching the approved policy.
- Requires supporting evidence or an Owner/Admin approval note before refund creation.
- Requires the authenticated approving user and records approver identity and timestamp with the refund.
- Blocks the Billing UI from issuing a refund until both exception and evidence fields are complete.
- Retains Stripe idempotency, refundable-balance validation, and webhook synchronization.

### Verification evidence

- Focused validation tests and the full production build pass locally.
- GitHub PR [#7](https://github.com/JimmyJr77/vortex/pull/7) passed Vercel CI and merged as `3b66c0d`.
- Render deployed `3b66c0d`, ran the refund evidence migration, and reported `Live`.

Section completed July 20, 2026.

## Section 5 — Missed-class tracking

Status: `COMPLETE`

Approved behavior: missed classes are allowed only when approved, and every missed class is retained on the athlete profile.

### Implementation log

- Added an athlete-linked missed-class ledger with class date, optional enrollment, reason, and approval status.
- Records the creating staff user and, for reviewed absences, reviewer identity and timestamp.
- Added pending, approved, and declined lifecycle states; approvals and declines require a staff note.
- Added a dedicated **Missed Classes** tab to each athlete account with entry history and review actions.

### Verification evidence

- Full TypeScript production build passes locally.
- GitHub PR [#8](https://github.com/JimmyJr77/vortex/pull/8) passed Vercel CI and merged as `4d4e4a2`.
- Render deployed `4d4e4a2`, ran the missed-class migration, and reported `Live`.

Section completed July 20, 2026.

## Section 6 — Dispute ownership and evidence

Status: `COMPLETE`

Approved behavior: `billing@vortexathletics.com` owns dispute responses and all financial matters.

### Implementation log

- Mirrors Stripe dispute events into durable cases owned by the billing mailbox.
- Records family mapping, amount, currency, reason, Stripe status, and Stripe evidence deadline.
- Adds evidence lifecycle states with required notes and authenticated reviewer audit.
- Adds a Billing dashboard case queue ordered by open status and nearest response deadline.
- Automatically closes the operational alert when Stripe reports a won or lost dispute while retaining the case history.

### Verification evidence

- Focused dispute deadline, ownership, and evidence-audit tests pass.
- Full production build passes locally.
- GitHub PR [#9](https://github.com/JimmyJr77/vortex/pull/9) passed Vercel CI and merged as `d3d34f5`.
- Render deployed `d3d34f5`, ran the dispute-case migration, and reported `Live`.

Section completed July 20, 2026.

## Section 7 — Reconciliation and operational alerts

Status: `IN PROGRESS`

### Implementation log

- Added an idempotent daily Stripe-to-ledger reconciliation job with a configurable lookback window.
- Recovers successful Stripe payments missing from the local ledger when a family can be identified.
- Creates critical alerts for amount mismatches, unmapped payments, open disputes, failed reconciliation runs, failed webhooks, and webhooks stuck processing.
- Added persistent reconciliation run history and summary counters.
- Added an authorized manual reconciliation action and Billing operations dashboard for latest-run, webhook, and alert status.
- Added a Render cron blueprint scheduled daily at 07:15 UTC with explicit billing alert routing.

### Verification evidence

- Focused amount comparison test and full production build pass locally.
- Release, Render cron creation, first successful run, and production dashboard verification pending.
