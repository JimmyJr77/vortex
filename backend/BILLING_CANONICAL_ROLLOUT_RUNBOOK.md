# Canonical Billing Cohort Rollout Runbook

This is the operator checklist for moving accounts from per-class Stripe
collection to household monthly invoicing. Migration control is CLI-only. Every
mutating command must use one migration run and an explicit account list;
`--all --apply` is forbidden. The sole bootstrap exception is the local-only,
explicit-family repair below: it atomically creates payerless account
containers and returns its own immutable run. It does not repair financial
data or contact Stripe.

## Non-negotiable gates

Before selecting a production cohort:

- Deploy the additive schema first with `npm run migrate:deploy`, then confirm
  `/api/health` reports the required billing schema ready.
- Keep the release version and deploy-manifest checksum fixed for the entire
  run. Do not resume a run from a different application release.
- Use accounts from exactly one facility and facility timezone per run.
- Take and verify the required database snapshot. Confirm Stripe access and
  webhook health without storing card data in migration evidence.
- Run the audit in dry-run mode first. Every selected account must have a valid
  payer, exact parity, unambiguous service periods, and no unresolved blocking
  exception before preparation.
- Confirm the target is the first day of a calendar month in the facility
  timezone and preparation begins at least seven days before that boundary.
- Assign an operator and an independent reviewer. Record the account IDs,
  target month, run ID, release, manifest checksum, eligibility denominator,
  and cohort size in the change ticket.

Use the narrow commands in this order:

```text
npm run billing:migration:audit -- --target-month=<YYYY-MM> --all --dry-run

# Only for active families reported with billing_account_missing. Never add --run.
npm run billing:migration:repair -- --target-month=<YYYY-MM> --family-ids=<ids> --dry-run
npm run billing:migration:repair -- --target-month=<YYYY-MM> --family-ids=<ids> --idempotency-key=<key> --apply

npm run billing:migration:audit -- --target-month=<YYYY-MM> --account-ids=<ids> --cohort=<cohort> --dry-run
npm run billing:migration:audit -- --target-month=<YYYY-MM> --account-ids=<ids> --cohort=<cohort> --idempotency-key=<key> --apply
npm run billing:migration:repair -- --run=<run-id> --target-month=<YYYY-MM> --account-ids=<ids> --dry-run
npm run billing:migration:repair -- --run=<run-id> --target-month=<YYYY-MM> --account-ids=<ids> --apply
npm run billing:migration:prepare -- --run=<run-id> --account-ids=<ids> --dry-run
npm run billing:migration:prepare -- --run=<run-id> --account-ids=<ids> --apply
```

Accounts whose recurring Stripe collectors were already retired outside the
normal saga must not be advanced by inserting or editing migration rows. After
the run-scoped audit exists, use the exceptional forward-adoption command:

```text
npm run billing:migration:adopt -- --run=<run-id> --account-ids=<ids> --dry-run
npm run billing:migration:adopt -- --run=<run-id> --account-ids=<ids> --apply
```

This path accepts only explicitly selected ledger-only/manual or already
household-enabled accounts. It re-audits immutable account, pricing, ledger,
and Stripe evidence; proves zero active local subscriptions, remote
subscriptions, and subscription schedules; verifies payer access, balances,
and any existing target-month household invoice; and records the activation
under the account lock before verification. A manual account is enabled only
by the `--apply` command. An account without a reusable card remains
`payment_method_required`; adoption never creates a Stripe Subscription.

The family bootstrap creates or reuses only an active payerless billing
account, explicitly leaves household collection disabled, and persists a
blocking `payer_missing` exception. Assign the payer with the admin
billing-account editor, then use the returned run and account IDs with the
ordinary account-scoped repair command. Family and account scopes cannot be
mixed, an existing assigned or inactive account is never changed, and Stripe
configuration is not required for this bootstrap.

Review each JSON report before its corresponding `--apply`. An apply report
with `cohortStopped: true`, any account in `error` or `missing`, or a nonzero
exit code is a hard stop. Accounts listed in
`cohortStop.unprocessedAccountIds` have not been advanced and must remain so
until the incident is resolved and the whole cohort is re-audited.

Keep every mutation switch off except for its reviewed command window:

- Audit/shadow comparison: `BILLING_CANONICAL_READ_MODE=shadow`.
- Deterministic repair: additionally enable
  `BILLING_ENROLLMENT_AUTO_REPAIR_ENABLED` only while applying the repair.
- Prepare, schedule, and advance: additionally enable
  `BILLING_COLLECTION_CUTOVER_ENABLED`.
- Boundary activation/invoice creation: additionally enable
  `BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED` and
  `BILLING_HOUSEHOLD_INVOICE_ENABLED` only after the boundary checks pass.

Future Stripe Subscription creation is a separate, permanent invariant from
those command permissions. Deploy
`BILLING_STRIPE_SUBSCRIPTION_CREATION_MODE=disabled` and
`BILLING_CLASS_SUBSCRIPTION_CREATION_MODE=household_only` across every
enrollment and reconciliation worker before selecting the pilot accounts.
Apply-mode `prepare` and `advance` commands still require the household-only
class phase before loading a run, claiming an account lease, changing migration
state, or calling Stripe. New class enrollments retain their local subscription
and ledger amount; annual memberships retain their local renewal schedule.
Neither path creates a new Stripe Subscription. Checkout can still save a
reusable payment method for canonical household/balance collection. These
switches do not auto-enable an account, select a payer, or bypass migration
parity, and missing payment methods continue through the canonical
`payment_method_required` flow.

Treat the production cutoff as irreversible. `legacy` remains an accepted
class-mode value only so old deployment configuration and migration evidence
can be inspected; it cannot re-enable a creator. Do not use it as incident
rollback. Pause collection and follow the explicit account
rollback/forward-recovery procedure instead.

`STRIPE_ENABLED` and the production Stripe credential are required for the
remote preflights. Return the four mutation switches to `false` when the
controlled operation finishes or stops.

## Cohort sequence

1. Rehearse in staging with mixed legacy fixtures and injected Stripe failures.
2. Pilot at most five explicitly selected production accounts. Together the
   pilot must cover a single enrollment, multi-member discounts, an annual
   membership, a bundle, and refund/credit history.
3. After one complete, structurally verified billing cycle, select no more than
   10% of the currently eligible production population for the next boundary.
4. After that cohort completes one successful cycle, select no more than 25%
   of the currently eligible population for the following boundary.
5. Move the remaining eligible accounts at the next boundary. Blocked accounts
   stay out of scope until an administrator resolves and re-audits them.

Recompute and record the eligible denominator at every stage. Do not silently
add accounts to an existing run or use an account from a later cohort to replace
a blocked one.

## Boundary window

At least one day before the boundary:

- Re-run `prepare` in dry-run mode and verify frozen local/remote mappings,
  customer ownership, prices, periods, payment method, and target-month invoice
  state have not drifted.
- Defer an account to the following month if a target-month legacy invoice is
  paid or processing. Draft/open invoice handling requires explicit review.
- Confirm no other deployment, manual subscription edit, or invoice job is
  scheduled for the window.

Before the first boundary mutation, pause both Render jobs:

- `vortex-recurring-billing`
- `vortex-stripe-reconciliation`

Record who paused them and the timestamps. Keep them paused while running:

```text
npm run billing:migration:advance -- --run=<run-id> --account-ids=<ids> --dry-run
npm run billing:migration:advance -- --run=<run-id> --account-ids=<ids> --apply
npm run billing:migration:verify -- --run=<run-id> --account-ids=<ids> --dry-run
npm run billing:migration:verify -- --run=<run-id> --account-ids=<ids> --apply
```

Resume the two jobs only after every selected account is verified or explicitly
removed from the window, and the reviewer confirms:

- zero active non-annual legacy collectors, locally and in Stripe;
- exactly one household invoice for the account/month and exact local-to-Stripe
  line parity;
- no unexpected target-month Stripe invoice or duplicate collection;
- canonical balance, pricing, enrollments, memberships, transactions, history,
  and bundle parity remain exact; and
- schema readiness, webhooks, recurring billing, and reconciliation are healthy.

After resuming, run reconciliation once under observation and inspect alerts
before closing the window.

## Automatic and manual stop conditions

Stop the cohort and leave both billing jobs paused for any unexplained parity
delta, duplicate collection, unexpected Stripe invoice, schema-readiness
failure, local/remote subscription mismatch, migration-state corruption, or
nonzero migration command. Do not continue with later account IDs from the same
report. Ordinary card declines remain invoice alerts and are not structural
cutover failures.

Before any remote subscription is irreversibly cancelled, use the explicit
rollback command after reviewing its dry run:

```text
npm run billing:migration:rollback -- --run=<run-id> --account-ids=<ids> --dry-run
npm run billing:migration:rollback -- --run=<run-id> --account-ids=<ids> --apply
```

After irreversible cancellation, do not treat a database restore as Stripe
rollback. Quarantine the account, keep it on the forward-only recovery path,
and use reviewed append-only credits/refunds for compensation.

## Cycle evidence and legacy retirement

For every verified account, record structural verification after each complete
billing cycle with:

```text
npm run billing:retirement:verify-cycle -- --run=<run-id> --billing-month=<YYYY-MM> --account-ids=<ids>
npm run billing:retirement:verify-cycle -- --run=<run-id> --billing-month=<YYYY-MM> --account-ids=<ids> --apply
npm run billing:retirement:audit
```

Legacy retirement cannot
begin until the final cohort has two complete successful cycles and the
retirement audit proves 30 consecutive healthy days with zero legacy endpoint
traffic. Run the retirement audit without `--apply` and preserve its report in
the release evidence.
