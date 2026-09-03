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
  `/api/health` reports the required billing schema ready. When the service plan
  supports it, the Render pre-deploy command is the primary release gate;
  `npm start` also invokes the same idempotent migration runner through its
  `prestart` lifecycle hook so every service still fails closed before boot.
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

Before selecting any affected account for adoption, repair a proven duplicate
local representation of one Stripe invoice payment with the dedicated command.
The pair format is `<invoice-linked-payment-id>:<duplicate-intent-payment-id>`.
Never use this repair for two distinct Stripe charges, or as a substitute for a
customer refund:

```text
npm run billing:repair-duplicate-invoice-payments -- --target=production --pairs=<pairs> --dry-run

# Run apply only from the exact deployed release that produced the reviewed dry-run.
# Supply the fresh plan hash and the separately approved environment fingerprints.
npm run billing:repair-duplicate-invoice-payments -- --target=production --pairs=<pairs> --plan-hash=<fresh-hash> --change-ticket=<ticket> --operator=<operator> --confirm=REPAIR_DUPLICATE_STRIPE_INVOICE_PAYMENTS --apply
```

Apply additionally requires `BILLING_DUPLICATE_PAYMENT_REPAIR_ENABLED=true`,
the exact database fingerprint, the exact live Stripe account ID, and a fixed
release version. The preflight proves that each pair is one complete paid
Stripe Invoice Payment and whole-invoice PaymentIntent binding, that there is
no remote refund or dispute, and that the local rows have exact account,
amount, and identity parity. The repair keeps the ledger append-only: it transfers the authoritative
PaymentIntent binding to the invoice-linked row and adds exact reversal
applications where the duplicate had been allocated. Review the mandatory
fresh post-verification before continuing the migration audit.

Accounts whose recurring Stripe collectors were already retired outside the
normal saga must not be advanced by inserting or editing migration rows. After
the run-scoped audit exists, use the exceptional forward-adoption command.
Manual ledger accounts intentionally produce the reviewed
`manual_collection_requires_review` exception while their immutable run is
created, so mark this specific audit purpose explicitly:

```text
npm run billing:migration:audit -- --target-month=<YYYY-MM> --account-ids=<ids> --cohort=forward-adoption-<cohort> --forward-adoption --dry-run
npm run billing:migration:audit -- --target-month=<YYYY-MM> --account-ids=<ids> --cohort=forward-adoption-<cohort> --forward-adoption --idempotency-key=<key> --apply

# Only when the audit reports deterministic fully-waived membership parity repairs.
# Apply scope must exactly equal the immutable run scope; apply derives its month from the run.
npm run billing:migration:repair-waived-memberships -- --run=<run-id> --target-month=<YYYY-MM> --account-ids=<same-run-ids> --dry-run
npm run billing:migration:repair-waived-memberships -- --run=<run-id> --account-ids=<same-run-ids> --apply

npm run billing:migration:adopt -- --run=<run-id> --account-ids=<ids> --dry-run
npm run billing:migration:adopt -- --run=<run-id> --account-ids=<ids> --apply
```

The forward-adoption audit exits successfully with an ineligible account only
when its sole blocking or critical finding is that explicit manual-collection
review, payer access is verified, and canonical parity is matched. Every other
ineligible condition remains a hard stop.

`--forward-adoption` is an immutable run authorization, not a presentation-only
CLI flag. It may create or idempotently resume only the run created with the
same key; it cannot be added to an ordinary existing audit run. The dedicated
waived-membership repair performs no Stripe Subscription creation. Its apply
command requires `BILLING_ENROLLMENT_AUTO_REPAIR_ENABLED=true`, the exact full
run account scope (including unaffected accounts), and no `--target-month`.
Re-run the read-only audit after repair and stop if any parity issue remains.

This path accepts only explicitly selected ledger-only/manual or already
household-enabled accounts. It re-audits immutable account, pricing, ledger,
and Stripe evidence; proves zero active local Stripe-linked collectors, remote
subscriptions, and subscription schedules; verifies payer access, balances,
and any existing target-month household invoice; and records the activation
under the account lock before verification. A manual account is enabled only
by the `--apply` command. An account without a reusable card remains
`payment_method_required`; adoption never creates a Stripe Subscription.
Successful adoption performs its own final verification, moves each account to
`verified`, and completes the run. Do not subsequently run the standalone
`billing:migration:verify --apply` command for that completed adoption run.

An active annual Stripe Subscription is a legacy collector too. The ordinary
audit and the final activation boundary both hard-stop when one remains; do
not treat the annual label as an exclusion. Retire and re-audit that collector
before enabling household collection so its later anniversary cannot overlap
the household ledger renewal.

The recurring worker honors the verified migration's effective collection
month. For a cohort adopted ahead of its boundary, normal enrollment lifecycle,
pause-credit, annual-renewal, and canonical ledger processing continues, but no
household Stripe invoice is published or collected before that month. At the
first run in that month, the household invoice includes the account's entire
positive unpaid, unreserved balance. Record and approve that exact open balance
per account before adoption so historical debt is never collected by surprise.

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

Before any production cutover or forward adoption, inventory every still-open
Stripe Checkout Session and prove that no subscription-mode Session remains
payable. Run the inventory with the same live Stripe account used by the
cohort, record its complete JSON output in the change ticket, and stop if the
count is nonzero:

```text
npm run billing:subscription-checkouts:audit
```

For every reported Session, first dry-run only the explicit reviewed IDs. The
command deliberately has no bulk apply mode. If the dry-run reports an attached
Subscription, do not expire or detach it with this command; retire that live
collector through the reviewed legacy-subscription cancellation workflow and
then re-audit the account.

```text
npm run billing:subscription-checkouts:audit -- --session-ids=<cs_id,cs_id>
npm run billing:subscription-checkouts:audit -- --session-ids=<same-cs-ids> --confirm=EXPIRE_OPEN_SUBSCRIPTION_CHECKOUTS --apply
npm run billing:subscription-checkouts:audit
```

The final inventory must report `count: 0` immediately before activation. A
new open ID, an incomplete page, a nonzero exit, or any live Subscription or
Subscription Schedule is a hard stop; keep household collection disabled until
the explicit IDs are resolved and both the Checkout inventory and migration
Stripe audit are clean.

Treat the production cutoff as irreversible. `legacy` remains an accepted
class-mode value only so old deployment configuration and migration evidence
can be inspected; it cannot re-enable a creator. Do not use it as incident
rollback. Pause collection and follow the explicit account
rollback/forward-recovery procedure instead.

`STRIPE_ENABLED` and the production Stripe credential are required for the
remote preflights. Return the repair, cutover, and auto-activation mutation
switches to `false` when the controlled operation finishes or stops. Keep
`BILLING_HOUSEHOLD_INVOICE_ENABLED=true` on the recurring worker after verified
household collection goes live; its final payment boundary re-verifies
canonical authority and zero legacy collectors before every charge.

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

- zero active legacy Stripe collectors of any kind, locally and in Stripe;
- exactly one household invoice for the account/month and exact local-to-Stripe
  line parity;
- no unexpected target-month Stripe invoice or duplicate collection;
- canonical balance, pricing, enrollments, memberships, transactions, history,
  and bundle parity remain exact; and
- schema readiness, webhooks, recurring billing, and reconciliation are healthy.

After resuming, run reconciliation once under observation and inspect alerts
before closing the window.

The scheduled reconciliation uses the prior 168 hours as its normal minimum
window. Keep `STRIPE_RECONCILIATION_LOOKBACK_HOURS=168` (or a larger explicitly
reviewed window). It also resumes from the latest **successful** persisted
`stripe_reconciliation_run.window_ended_at`, with a one-hour overlap. Failed or
still-running rows never advance that high-water mark, so an outage longer than
seven days is scanned completely after service resumes rather than permanently
stranding an exact paid Checkout owner.

The rolling PaymentIntent window is not the only recovery boundary. Every run
also performs a no-age, database-driven sweep of exact Stripe IDs still owned by
unfinished enrollment, annual-membership, and store Checkout records; incomplete
household invoices; fulfillment-pending annual legacy invoice payments; and
active payment attempts. Completed enrollment and annual owners remain eligible
until the exact Checkout payment is applied to the immutable Session-tagged
purchase charges; a merely settled or generically allocated payment is not
fulfillment proof. A late success remains eligible even when its Stripe object
was created before the lookback window, and a per-object failure remains eligible
on the next run. A freshly retrieved, exact enrollment Session that is
conclusively expired and unpaid is compare-and-set to expired so it cannot leave
a carried-balance collection guard active. Ambiguous/open Sessions remain
blocked; historical subscription-mode Sessions are either cash-recorded and
quarantined when paid, or raised as critical reviewed-retirement incidents.
Refund-required enrollment payments and quarantined annual owners are
deliberately excluded from automatic fulfillment. Treat any
`durable_stripe_owner_reconciliation_failed` alert as a billing stop condition;
review its exact Session or Invoice binding instead of recording a generic
payment or manually advancing the owner row.

Refund reconciliation fully paginates Stripe's all-age Refund inventory on
every run, then merges exact local pending/treatment-approved refund IDs and
failed or lease-expired refund webhook events. This full inventory is the
bootstrap guard for pre-deploy refunds that have no usable webhook/local row.
Each refund is resolved only through its immutable Charge/PaymentIntent owner.
Approved succeeded refunds also complete the idempotent ledger/application and
entitlement treatment; external refunds without an approved treatment remain
`reconciliation_required` and block collection. A transient failure persists a
critical exact-Refund-ID retry alert, so it cannot age out of later runs.

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
