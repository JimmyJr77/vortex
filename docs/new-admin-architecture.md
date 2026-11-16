# New Admin: assessment and implementation plan

Assessment date: November 1, 2026. This plan was recorded before implementation. Existing uncommitted contact/inquiry changes are outside this work and must be preserved. Production deployment, destructive production data changes, and cutover are separate approval steps.

## Findings and evidence

Read-only review covered `server.js`, canonical access, account directory, family relationships, program/scheduling handlers, customer billing, Stripe lifecycle/reconciliation, migrations, and the React portal/screens.

| Area | Verified finding | Consequence |
| --- | --- | --- |
| Classes | `AdminClasses.tsx` has two effects loading the same four catalog resources; `classSchedulingSummary.ts` adds form→offerings/full-form requests per class. | About 9 + 6N screen requests before shared shell requests; dev StrictMode can repeat effects further. |
| Members | Legacy `/members` probes schema, returns unbounded detailed rows, then loads enrollments and roles. | Oversized responses and sequential DB work. |
| Directory | `/account-directory` already has bounded pagination, filters, and aggregate summaries. | Reuse it; no replacement identity database is justified. |
| Member detail | Profile then family are loaded sequentially. | Add a focused profile/household/enrollment read. |
| Leads | Full registrations then newsletter lists; local search/sort. No facility ownership or durable conversion mapping. | Paginate leads, explicitly assign ownership, and preserve conversion provenance. |
| Enrollments | Legacy signup lists are unbounded; some reads run due-cancellation or compatibility updates. | New reads must not mutate business state or discover/alter schema. |
| Class overview | Five schema ensure helpers, repeated schema discovery, and sequential class/schedule/count queries. | Query known deployed schema with bounded joins. |
| Billing | Overview then transaction/activity reads; overview fetches Stripe customer/default method live and fans out enrollment reads by household member. | Local payment-method projection and bounded aggregate reads; retain collection-time verification. |
| Authentication | Canonical database access context is authoritative; some routes repeat its lookup. | Use current permissions and facility, never trust a selected UI role or mutable JWT role claim. |
| Tenant scope | Legacy registrations/class overview and several scheduling handlers lack facility predicates. | Enforce scope before sharing mutations; test cross-facility IDs. |
| Stripe | Durable claim leases, payment reservations, invoice/payment/refund identity constraints, reconciliation, and migration tools already exist. | Extend these mechanisms instead of creating a competing ledger. |
| Webhooks | Live-mode signatures required, but unsigned test-mode payloads currently accepted. Ordinary legacy subscription events apply their payload directly. | Require signatures in enabled modes; reconcile current remote subscription state for delayed events. |

Existing enrollment indexes from migration 489 already cover active form/group/status queries. Missing indexes are not assumed without query-plan evidence. Old Admin bundle is roughly 1 MB in the October 27 artifact; that is a stale artifact, not a fresh bundle measurement.

### Measurement protocol and constraints

The local `vortex_athletics` database has 123 public tables, 19 members, 4 enrollments, and 311 recorded migrations. It lacks current access-schema columns and is unsuitable as a current full-stack baseline. Other available local test databases are empty. No hosted database or live Stripe account is used for this assessment.

Measure browser ready time and request count over five runs with a fixed fictional fixture and fixed 20 ms API transport; label these simulated-transport results. Separately prepare a dedicated local database, measure real API response times and response bytes with identical seeded records before/after aggregation, and capture query plans. Do not conflate simulated browser timings, local PostgreSQL timings, and production performance. Results belong in `new-admin-verification.md`; unavailable measurements remain explicitly unverified.

## Architecture decision

Keep React/Vite, Express, PostgreSQL, and Stripe. Add a lazy-loaded New Admin portal alongside Admin, Coach, and Member. Both administrative interfaces write the same canonical records using existing enrollment and billing services. There is no dual-write database and no migration-created Stripe object.

| Business fact | Authority and relationship | Transition |
| --- | --- | --- |
| Person | `member`, facility-scoped | Preserve IDs and fields. |
| Login/staff access | `app_user`, roles/overrides, `v_app_user_access_context` | Preserve explicit member→user links; no ID equality inference. |
| Household | `family`, active `family_member` | Preserve IDs/membership; compatibility pointers remain managed by existing migration 801. |
| Legal guardian | `parent_guardian_authority` | Preserve legal authority independently of payer status. |
| Payer/account | `family_billing_account` | Preserve account, household, and payer IDs. |
| Lead | `registrations` plus additive facility/conversion metadata | Preserve inquiry IDs and submitted contact data. Never merge solely on email. |
| Program/class | `programs`, `program`, `scheduling_form` | Preserve IDs; use actual registration class, not legacy `class.current_enrollment` counters. |
| Offering/schedule/capacity | offerings, slot groups, time slots | Preserve dates, capacity, and selected offering; count active enrollments from signups. |
| Enrollment | `scheduling_signup`; date-specific `drop_in_registration` | Preserve status, participant, slot/group, dates, prices, and lifecycle history. |
| Obligations/subscriptions/invoices | Local canonical billing tables | Preserve cents, currency, service periods, allocations, credits, and history. |
| Processor payment/refund state | Stripe; local durable projection/ledger | Preserve all customer/subscription/invoice/PaymentIntent/charge/refund references. |
| Payment method display | Sanitized local Stripe projection | Only processor method reference, type/brand/last4/expiry, sync time/error; no raw card data. |

New list endpoints are bounded (default 25, maximum 100), filtered and facility-scoped. Details aggregate only the selected record and first pages of related data. History and rosters retain independent pagination. Reads do not initialize schema, collect payments, or reconcile enrollments. Focused writes reuse shared handlers/services with permission and facility preconditions. Successful writes refresh the selected detail and relevant list; stale responses cannot replace a newer selection.

Implementation clarification: legacy `registrations.member_id` is populated by contact matching for analytics and is not authoritative conversion evidence. New conversion uses the explicit `converted_member_id` link. The administrative family wizard now uses authenticated facility-scoped catalogs and validates the complete program/class/form/offering/group/slot chain against the canonical member facility. The focused schedule editor reuses the selected form's existing editor; requesting initialization of a missing form requires scheduling management permission. These changes preserve the shared enrollment and billing services.

Stripe events use raw-body signature verification, durable idempotency/claim leases, and account locks. Current remote state resolves subscription event ordering. Webhooks, successful payment-method setup, and explicit reconciliation refresh local projections. Failed syncs retain their status and timestamps; retries remain visible in existing Stripe operations tooling. Collection actions still validate the actual Stripe method before charging.

## Migration and coexistence

1. Inventory schema readiness and record counts. Back up the target database, with schema, migrations, and restore verification. Existing canonical billing preparation/adoption/verification tools remain the authority for historical ledger transitions.
2. Apply additive schema only: lead ownership/conversion metadata, sanitized payment-method projection, and measured read indexes. No renumbering, deletion, merging, repricing, or charge creation.
3. Dry-run ownership backfill. A legacy inquiry may be assigned automatically only if its source maps deterministically to one facility (including an explicitly approved single-facility mapping). Ambiguous/missing ownership remains quarantined and absent from normal scoped lists until reviewed. Report counts and affected IDs before apply.
4. Lead conversion runs transactionally with a row lock and durable link. Retrying returns the original member; explicit linking validates facility. Matching email is evidence for review, not identity proof. Conversion does not create subscriptions, invoices, or charges.
5. Validate relationships before and after: orphan/cross-facility members, families, payer references, forms, slots, enrollments; duplicate active memberships; converted-lead links. Preserve and report inconsistent rows rather than silently “repairing” them.
6. Reconcile counts and financial sums by account/currency, including charges, payments, allocations, refunds, credits, subscriptions, and all remote reference sets. Compare representative paid/unpaid/refunded/paused/waitlisted families. A dry run must not alter its source.
7. Existing Admin continues writing canonical records throughout rollout. No change-data-copy window is needed. Lock each backfilled row and use idempotent predicates so concurrent edits are retained. Existing billing migration account locks and explicit cohorts continue to govern billing adoption.
8. Rehearse on fictional local records, apply twice, verify idempotence, exercise concurrent/duplicate conversion and stale webhook events, then compare reconciliation snapshots.

### Rollback and cutover

Rollback the UI route to Admin while retaining additive columns and projections. Do not delete billing history or reverse legitimate payments to roll back a UI. If a data backfill was incorrect, use the recorded before/after ownership mapping to restore only rows unchanged since that backfill; flag concurrent edits for review. Restore a full database backup only through an explicitly authorized recovery procedure with a plan for post-backup writes. Existing canonical billing rollback tooling has its own Stripe/subscription safeguards and must not be replaced with a bulk SQL reversal.

Cutover requires successful scoped authorization, enrollment and billing regression tests; reconciled financial/reference totals; a successful restored-backup rehearsal; operational sync monitoring; measured representative performance; and user acceptance of the core workflows. Retire old Admin only after an agreed observation window with no unexplained mismatches or required missing actions. Final production cutover is not authorized by this implementation task.

## Implementation sequence

1. Finish read-only baseline and this plan.
2. Implement additive ownership/migration audit and bounded New Admin read APIs, preserving shared business logic.
3. Harden Stripe signatures/event ordering and local payment-method display projection with focused regression tests.
4. Build lazy New Admin entry and workflows; keep old Admin navigable.
5. Provide a repeatable dedicated local database/seed with fictional families, leads, classes, enrollments, varied simulated billing and bcrypt-backed `admin2` / `adminadmin`; require explicit local-development opt-in and forbid remote/live Stripe targets.
6. Rehearse migration, measure comparable performance, run meaningful backend and browser tests, and publish development instructions, verification evidence, limitations, and transition checklist.

Production scale, hosted latency, live Stripe event delivery, and production legacy ownership are unverified until a separately authorized environment rehearsal. Static findings above are verified from source; projected performance improvements are hypotheses until measured.
