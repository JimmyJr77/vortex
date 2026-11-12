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

## Accounting balances and matched bill comparison

The Accounting screen reads the shared account records in one reporting query.
Its family-account cards are facility-wide and independent of table filters:
current unpaid covers the facility-local current service month and earlier;
upcoming covers future service months; available credits are the negative net
account balances remaining after all posted bills. Bills without a service date
use their posted date. Unassigned balance discrepancies are flagged for review.

Each account's available funds reduce its oldest remaining service-month bills
for display only, before filtering or pagination. No payment or credit allocation
is created. The table, detail, period filters and CSV use that same projection.
Original amounts remain in exports; recorded allocations remain available in
expandable history and the API.

The billed/paid cards share one cohort of non-historical, non-voided, non-credit
bills. Billed amounts include bill adjustments. The screen, bill details and CSV
show a single "Paid or credited" amount (billed minus remaining), incorporating
household funds automatically and capped at each bill's amount. They do not ask
users to track applied/unapplied money. Excess money stays in household balances;
standalone credits are not counted again as bills. Imported historical charges
remain in the same table and exports, marked historical and excluded from current
debt. The cash view shows full receipts, refunds and net cash, including imports.

The database and browser regression tests run these reports with database-enforced
read-only connections and compare source/history fingerprints before and after.
This reporting change requires no migration and changes no billing command paths.

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

### Enrollment actions and lead follow-up

Migration 845 adds dated enrollment actions, waitlist timestamps and pause-credit
reversals. Deploy it before starting the updated backend or recurring worker.
Manage enrollment in both admin views uses the same scheduling and billing commands.
Staff can backdate actions, apply them today, or schedule them. A date cannot precede
the enrollment or its latest recorded action. Future status changes keep the current
state until due; the recurring worker applies them before posting/collection, and
opening the student's enrollment also processes due actions. Only one pending status
change is allowed per enrollment; it can be canceled without deleting its history.

Waitlists have stable chronological positions. Activation checks capacity and uses
the existing subscription when present. Reenrollment creates a linked new enrollment
and preserves the canceled/completed original. Class transfers preserve remaining
manual-discount windows, reverse unused billed service, and retain source billing
until a future move date. Backdated transfers credit later source bills and post replacement tuition for
intervening months in the same transaction, using canonical period keys. Existing
invoice and payment history remains intact; no card charge is initiated by a move.

Manual and promotional tuition discounts precede household multi-class discounts.
Manage-enrollment discounts use one billing month, an inclusive number of billing
months, or an open monthly window. Replacing/clearing appends dated price history;
expired replacements never revive older discounts. Discounts set while paused or
waitlisted start no earlier than next month and only affect active tuition. Mid-month
pauses credit unused scheduled sessions against this enrollment's actual billed
tuition for the following month. Reactivation adjusts credits for sessions resumed
and restores the next bill cursor without charging a month twice. Billing failures
roll back the status change and its credit together. Legacy Stripe identifiers are
checked against canonical collection ownership before pause/reactivation updates.

Leads exposes contacted and follow-up flags, the original inquiry, and dated notes
from the linked family account. Existing notes are preserved before form edits;
new notes use the same note table and facility authorization as the original admin.

Regression coverage: `tests/e2e/new-admin-enrollment-actions.spec.ts` and the rollback-only
`backend/billing/__tests__/enrollmentActions.postgres.test.js` (opt in with
`RUN_ENROLLMENT_ACTIONS_LOCAL_TEST=true` after seeding the fictional local demo).
The database test disables Stripe and automatic collection, asserts no remote
subscription exists, and rolls back every fixture, bill and audit change.

New enrollment, cancellation and loss-rate cards share five calendar reporting
periods: the previous three quarters, the current quarter to date, and the previous
four full quarters combined. The current quarter includes the current partial month;
the four-quarter summary excludes the entire current quarter. The Families/Students
selector updates all three rows together using the same shared enrollment snapshot.
New enrollment and cancellation totals sum known observations; monthly averages
divide by their observed-month count. Each loss-rate card shows the arithmetic mean
of known, nonzero-denominator monthly rates within its period. Rates are not summed
or presented as cumulative quarter churn. Cards show how many months contribute
when less than the requested window is available. Unavailable student history never
falls back to family rates. January-to-date trend views remain available. Family
acquisition and lifetime-value estimates still use completed-month family loss rates.
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
zone by cash date. Three rows of five cards show (1) the four previous calendar
quarters and current quarter to date, (2) the four previous completed months and
current month to date, and (3) monthly averages over the previous 3, 6, 9 and 12
completed months, followed by the total for those previous 12 months. The shared
ledger read starts at the beginning of the oldest full quarter; that extra history
does not expand the rolling averages or 13-month chart. Current periods stop at the
as-of date. Older API responses cannot show an incomplete quarter as a full total.
The chart includes the current partial month. Class/gender/age views are computed
locally from the same response. Payment allocations determine attribution; refund
reversals retain original receipt attribution, while non-refund reallocations
move attribution. Refunds use their charge or payment. Unassigned/unspecified
categories are hidden in the trend, selector and table; All and summary cards keep
the full income total. The API retains every category for reconciliation. Ages use
the cash transaction date. Empty recorded months contribute zero.

Unpaid lists use posted service-month charges after payments and credits, grouped
as this month or last month and earlier. Account-level funds reduce oldest remaining
debt first for display only; future bills stay outside both lists. Net negative
ledger balances appear as credits. Imported transactions contribute cash history
but never create a second current debt/credit balance. Family links open the
existing billing workspace. These views do not provision, reconcile, allocate,
charge, refund or update any billing records.

### Lead invitations and class reservations

New Admin keeps inquiry edits in `registrations`, account notes in the existing
`note` table, invitations in `account_invite`, and reserved class places in
`scheduling_signup`. Migration 846 adds invitation metadata and the `pending_setup`
signup status; it does not create a second account or enrollment dataset.

Contacted and follow-up are independently editable in the lead list. Kid ages
are calculated from birthdays; legacy reported ages remain visible as original
form information. Notes opens the inquiry information and shared account history
in independently scrolling panels. Inquiry editing is available inside Notes.

Conversion can send account setup only, program links, class links, or exact
class/time reservations for multiple children. Exact reservations consume capacity
immediately. The default deadline is seven days, editable from one to thirty;
expired holds stop consuming capacity without deleting their history. Other
admission paths and waitlist promotion respect pending holds.

The existing Vortex email sender delivers the username, temporary password, setup
link, and ordered class links. Temporary credentials authorize only the invitation
setup flow. Setup requires a different password and allows a username change.
Canonical family signup creates shared family/member records and waiver signatures,
then hands reserved selections to the existing authenticated checkout. Setup creates
no charges, payments, or subscriptions. Checkout reuses the held signup ID. Retrying
conversion or account setup does not duplicate invitations, accounts, or holds.
Failed email delivery remains visible and can be retried with the same invitation.

Migration 847 guards program archiving in the database: every active class must
first be closed or archived. An archived program cannot gain an active class until
it is restored. Class archiving uses the existing class archive endpoint; program
archiving is available at the bottom left of Edit program. Archive operations
preserve enrollment, account, payment, and billing history.

Local verification includes `tests/e2e/lead-registration.spec.ts` and
`tests/e2e/new-admin-enrollment-actions.spec.ts`. The rollback-only PostgreSQL
rehearsal is `backend/newAdmin/__tests__/leadRegistration.postgres.test.js`, enabled
with `RUN_LEAD_REGISTRATION_LOCAL_TEST=true` against the fictional local
`vortex_new_admin_dev` database. Its email sender is injected; it sends no email.

## Staff timesheets

Timesheets opens to the current Monday–Sunday week. Users enter daily hours and
notes, choose a week with a date picker or arrows, and see admin-assigned times
highlighted separately. Moving between weeks or people first saves pending edits.
Assignments never count as actual hours and never limit what the person may log.
Admins with `timesheets.view_all` can view everyone or one person and assign/remove
work times in the same facility. Everyone edits only their own actual hours.

Migration 849 adds the original time log and retained change history. Migration 850
adds weekly daily totals, assignments, and their before/after audit history. These
records use canonical `app_user` IDs and require no payroll profile. Existing detailed
logs populate daily totals until a user explicitly records a daily total; that total
then takes precedence, so hours are never counted twice. Explicit zero and blank
are retained with version numbers. Concurrent stale saves are rejected atomically.
Assignments are soft removed; actual hours and history remain unchanged.

The interface defaults to self and uses facility-local dates. Existing portal access
rules still apply. The `timesheets.view_all` permission is granted to admin roles by
default, with explicit permission overrides respected. Staff without it receive no
staff directory. There are no payroll, enrollment, or billing writes.

PostgreSQL/HTTP coverage is in `timesheets.postgres.test.js`; browser coverage is in
`tests/e2e/new-admin-timesheets.spec.ts`.

## Pricing and billing workspaces

Both admin portals now render the same flat class-cost list. Pricing and Create/Edit
Class share the canonical form-price writer. Price-only changes never overwrite class
metadata; the class list, edit dialog, legacy scheduling reads, and registration
pricing use the same saved amounts and default drop-in formula. Existing subscription
amounts, enrollments, discounts, and financial records are preserved. There is no
editable program default price.

Discounts, rules, promo codes, class/program benefit assignments, and additional fees
use the existing records. Free Passes is removed from pricing navigation, selectors,
and rule/promo listings; historical grants and redemptions are not deleted.

New Admin Billing includes Account Billing & Enrollments, the existing billing review
panels, and Stripe Payments. Existing permission checks and owner-only access to the
Stripe-wide payment list are retained. Family-to-billing navigation still opens the
requested account. Coverage: `new-admin-pricing-billing.spec.ts`,
`family-workspace.spec.ts`, and `classPricing.postgres.test.js`.
