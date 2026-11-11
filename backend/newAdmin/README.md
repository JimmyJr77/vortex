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

## Enrollment & Loss Data

The dashboard's seven summary cards use the 12 calendar months preceding the
facility-local current month. The last-month card is the last completed month.
New-family and cancellation totals sum known observations; monthly averages divide
by their observed-month count. Loss-rate averages are arithmetic means of known,
nonzero-denominator monthly rates. Cards show how many months contribute when less
than the requested window is available. January-to-date trend views remain available.
The UI no longer shows provisional markers or the recorded-history banner.

The frontend retains the existing timeline when an older backend response lacks
expanded metrics. Deploy the backend (including migration 844) to enable the new
cards and marketing editor; refreshing then loads the expanded dashboard.

Current families/students come from effective live enrollment intervals, excluding
future starts, expired/canceled enrollments, requests, waitlists and test/error
records. Paused enrollments remain enrolled. Students are distinct member IDs;
classes count distinct students, so a student in two classes appears in each.
Gender and age retain unspecified buckets. Age is calculated on the facility-local
as-of date. There is no authoritative team flag in the present model: a student is
classified as team when a current class or program name contains the word “Team”
(excluding the phrase “Non-team”). The card states this rule.

Financial metrics require `billing.view`. Monthly membership cost means net active
recurring enrollment tuition divided by all current students, not household dues.
It excludes annual memberships and one-time purchases; paused subscriptions add no
revenue. Only subscriptions belonging to the same current enrollment, student and
canonical family contribute. No Stripe calls or billing mutations occur on read.

Migration 844 adds facility-scoped monthly marketing spend. The editor requires
`members.view`, `billing.view`, and `marketing.manage`. Amounts are stored in cents;
blank and explicit zero are different. Version-checked upserts prevent an old page
from silently overwriting another administrator's edits. Clearing an entry keeps
its version. A save refreshes the same dashboard read for recalculated values.

Blended family acquisition cost is total recorded marketing spend divided by new
families in the same completed months, including spend in zero-acquisition months.
Blank-spend and unknown-enrollment months are excluded. Current-month inputs appear
in the chart/table but do not enter the summary. Estimated retention in months is
1 / average monthly family loss rate. Expected family lifetime revenue is monthly
student tuition × current students per family × estimated retention. Revenue per
marketing dollar divides that family revenue by family acquisition cost. These are
revenue estimates assuming the present mix and retention continue, not profit or
campaign attribution. Unknown/zero loss or acquisition-cost denominators yield an
unavailable estimate rather than infinity.

### Student trends and billing dashboard

Enrollment trend population switches between unique families (default) and unique
students. The API returns both series from the same shared enrollment snapshot;
changing population or chart view performs no additional request. Student intervals
merge by resolved member ID, including imported history. Siblings are independent;
multiple classes, transfers and returns do not create extra new students. The
membership-per-family card divides the same net recurring tuition by current
families, including all their enrolled students and classes.

`GET /api/admin/new-admin/billing-dashboard` requires `billing.view` and returns one
facility-scoped, database-enforced read-only snapshot. It reuses the accounting
ledger CTE over shared account records, including Jackrabbit cash history. No new
migration, billing worker, collection schedule or payment API is introduced.

Income means successful payments minus successful refunds, grouped in the facility
zone by cash date. Cards show the previous 12 completed months, their monthly
average, the last three completed months and their monthly average, and last month.
The chart includes the current partial month. Class/gender/age views are computed
locally from the same response. Payment allocations determine attribution; refund
reversals retain original receipt attribution, while non-refund reallocations
move attribution. Refunds use their charge or payment. Unassigned amounts remain
visible; cent-preserving allocation ensures all category totals reconcile. Ages
use the cash transaction date. Empty recorded months contribute zero.

Unpaid lists use posted service-month charges after payments and credits, grouped
as this month or last month and earlier. Account-level funds reduce oldest remaining
debt first for display only; future bills stay outside both lists. Net negative
ledger balances appear as credits. Imported transactions contribute cash history
but never create a second current debt/credit balance. Family links open the
existing billing workspace. These views do not provision, reconcile, allocate,
charge, refund or update any billing records.
