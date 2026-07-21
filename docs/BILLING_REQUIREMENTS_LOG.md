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
| 1 | Centralize financial alerts and replies through `billing@vortexathletics.com` | IN PROGRESS | Code routing and tests added; production environment and Stripe public/support email still require verification. |
| 2 | Failed-payment alert with staff-reviewed suspend and restore actions | PENDING | — |
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

- Pending test run.
- Pending production environment verification.
- Pending Stripe Dashboard verification.

## Section 2 — Failed-payment suspension and restoration

Status: `PENDING`

Approved behavior: honor Stripe Smart Retries for eight attempts over fourteen days, then create a staff alert with reviewed **Suspend access** and **Restore access** actions. Never suspend automatically. Every action must record actor, timestamp, reason, affected enrollments, and customer-notification result.
