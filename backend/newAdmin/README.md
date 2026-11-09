# Shared family records

New Admin reads Jackrabbit and Vortex enrollments, charges, payments, and refunds
from the same physical `account_enrollment`, `account_charge`, `account_payment`,
and `account_refund` tables. The `*_current` views only filter tombstones; they do
not join separate source datasets. `record_source` and the organization/source ID
retain provenance. Families and people continue using the existing canonical
`family` and `member` identities.

Migration 843 backfills these tables and installs transactional capture triggers.
A native change updates its shared record in the same database transaction.
Reviewed import corrections update the same shared ID. Related ownership, billing
account creation, and class-date changes refresh affected records. There is no
external API fan-out, background polling, or second billing process.

## Billing boundary

The existing `billing_*` and scheduling command tables remain the inputs to
registration, invoice creation, collection, allocation, and refund execution.
The shared tables are the common read model, not a second collector. Synchronization
is one-way. Imported records have negative IDs and `historical_only=true`, never
enter the operational billing tables, and have no collectible/unapplied balance.
Native IDs and payment/allocation links retain their existing values. Importing
historical financial facts never creates an invoice, subscription, payment attempt,
or Stripe request.

Account history, accounting reports/exports, net revenue, family history, member
enrollment history, and the monthly family-retention dashboard read the shared
records. Current balance and payment/refund command decisions intentionally retain
the existing operational ledger. History without a billing account remains visible
in the shared data and facility reports without creating a collectible account.

## History and integrity

The original import remains unchanged as audit evidence. `account_record_source`
retains source identity mappings and raw payloads for all imported kinds, including
family/person records. Business calculations use normalized shared columns rather
than parsing source exports. Invalid dates are flagged, unresolved identities are
not guessed, and cross-facility identities are not assigned to a household.
Deleted records retain tombstones. Existing billing audit events are not rewritten.

The deployment migration runs in one transaction after acquiring the normal deploy
migration lock. Source-table locks use NOWAIT: an active writer aborts the migration
instead of waiting behind a payment operation; retry deployment after it completes.
Capture triggers are installed before the backfill, preventing a
concurrent source write from escaping capture. Database assertions verify that all
native payloads and imported provenance/history are present before commit. A failed
migration rolls back its tables, triggers, and data. Reapplying the backfill is
idempotent; the deploy runner also records its checksum and applies it once.

For rollback after deployment, restore the previous application release and keep
the additive shared tables/triggers. Do not delete or replay billing transactions.
For a future native schema change, update the shared table shape alongside it;
complete native payloads are also retained in `record_source_data` for audit.

## Verification

`sharedAccountRecords.postgres.test.js` verifies physical storage, both sources,
complete raw facts, idempotence, atomic writes/rollback, tombstones, dependency
updates, corrected classifications, invalid dates, facility isolation and unchanged
operational billing inputs. CI also runs real PostgreSQL accounting, refund,
collection, family history and monthly retention regressions plus the deploy
migration apply/no-op/checksum checks. All database fixtures are synthetic and local.
