# Unified family workspace migration plan

November 8, 2026

Build a fast family workspace over Vortex's existing authoritative records, then move the other screens onto the same business definitions and prepared views. Preserve person, family, account, enrollment, ledger, and processor identifiers. The first release changes how staff retrieve information; the existing billing services remain the only path that posts charges, takes payments, issues refunds, and advances collection schedules.

This is an implementation plan. It extends the existing [New Admin architecture](new-admin-architecture.md); it does not represent a completed migration or authorize a billing-engine replacement.

## Findings that determine the approach

| Existing implementation | Implication for this migration |
| --- | --- |
| `backend/accounts/accountDirectory.js` already produces scoped, paginated member summaries. Its joins cover identity, participation, household responsibility, and access. | Reuse its rules, then provide a family-oriented directory. Avoid recreating identity or copying the entire directory calculation into another endpoint. |
| `backend/newAdmin/reads.js` loads a member, then household details and that member's enrollment history. `src/components/newAdmin/Members.tsx` takes the user to another workspace for billing. | Add a family-centered response containing the whole household, current participation, and a financial summary. |
| `src/components/AdminCustomerBilling.tsx` loads overview, transactions, and activity together. `buildCustomerBillingOverview` also loads enrollments separately for each family member. | Remove mandatory full audit-list loads from opening an account and replace per-member fan-out with set-based family queries. One HTTP endpoint alone is insufficient. |
| `loadCanonicalFinancialSnapshot` already supplies local ledger calculations. `ensureCustomerBillingAccount` is currently an alias of a read-only loader. Local Stripe customer projections already exist. | Reuse these foundations; do not claim that a new cache or account loader alone is a new architecture. Separate reusable financial calculations from the large overview response. |
| `family_member` is used by newer household reads, while other reads still use `member.family_id`. `householdMembership.js` defines canonical membership and legacy fallback behavior. | Establish one shared household resolver and audit inconsistencies before switching callers. Do not simply prefer whichever pointer is populated. |
| `registrations` contains inquiries. `converted_member_id` records explicit conversion; `member_id` can reflect analytics contact matching. | Preserve both meanings. A contact match is not proof of conversion or authorization to merge people. |
| Jackrabbit source rows retain original data and source identifiers in `jackrabbit_history_record`; account activity also references imported history. | Normalize searchable facts once, retain the source evidence, and link duplicate representations instead of counting them twice. |
| The new enrollment trend reconstructs history at read time and assumes continuity for open Jackrabbit records. | Replace repeated reconstruction with reviewed enrollment periods and versioned metric summaries. Unknown end dates remain unknown. |

These are code findings, not a fresh production latency diagnosis. Existing [query-plan measurements](new-admin-query-plans.md) used fictional local data and cannot establish production performance. Production transport, authentication, SQL, response size, rendering, and background contention need separate timing.

## First release and screen contract

The first release is a unified family workspace in New Admin, reachable from the member directory, lead record, roster, and billing search. Existing links to member and billing IDs remain valid. The current Admin dashboard can consume the same prepared data later.

The initial screen shows family identity, all authorized household people, payer information, current and upcoming enrollments, membership coverage, trial status, balance, upcoming billing summary, collection warnings, lead follow-up, and the latest 25 activity items. Selecting a household person filters the loaded information where possible. Full transactions, old enrollments, and older activity have independent cursor pagination, fetched on demand. Explicit counts and `hasMore` prevent a bounded preview from implying that no additional records exist.

Proposed API contracts:

| Endpoint | Responsibility |
| --- | --- |
| `GET /api/admin/families?search=…&cursor=…` | One row per family, summary fields, stable pagination, facility and permission scope. |
| `GET /api/admin/families/:familyId/workspace` | One initial response for the family workspace. Reads local records directly, without calling other HTTP APIs or Stripe. |
| `GET /api/admin/families/:familyId/activity?cursor=…` | Further timeline items, with source references and stable ordering. |
| Existing financial history and action routes | Continue serving transaction drill-down and executing existing business operations during the first release. |

The workspace response contains `family`, `people`, `participation`, `memberships`, `financial`, `crm`, `recentActivity`, section permissions, pagination metadata, and freshness metadata. A missing billing account is an explicit state, not a reason to create one during a GET. Financial sections are omitted without billing permission; roster access alone must not reveal balances, sensitive notes, or private contact fields.

Use a short, read-only transaction for a coherent initial response, with a bounded number of set-based queries. Fetch multiple financial accounts in a batch if the household legitimately has more than one; do not sum different currencies. Financial facts are read from the authoritative ledger at request time in this release. Historical and directory summaries may be prepared ahead of time and carry an explicit generation/version timestamp.

The response must not wait for remote synchronization, schema discovery, history repair, or metrics recalculation. Write actions remain explicit operations with their existing permissions, locks, previews, idempotency, and validations. After a successful action, refresh the affected family response and invalidate the relevant directory summary.

## Authority and data mapping

| Domain | Existing source | Target treatment |
| --- | --- | --- |
| People and login | `member`, `app_user`, explicit links, access context | Preserve IDs. A person, an athlete role, and a login remain distinct concepts. |
| Household and guardians | `family`, `family_member`, `member.family_id`, `parent_guardian_authority` | Canonical resolver uses the established relationship rules; compatibility pointers are audited and maintained until their readers are retired. Preserve historical membership and legal authority. |
| Financial responsibility | `family_billing_account`, payer membership, Stripe customer references | Keep existing accounts and processor links. Display grouping is not a transfer of debt or payment ownership. |
| Leads | `registrations`, conversion and contact timestamps, notes | Link to canonical people/families with evidence and provenance. Preserve the original inquiry even after conversion. |
| Class catalog and schedules | `programs`, `program`, `scheduling_form`, offerings, groups, slots | Preserve operational IDs and capacity rules. Introduce a shared vocabulary and resolver before considering physical consolidation. |
| Enrollment | `scheduling_signup`, cancellation requests, activity, class swaps | One normalized participation view with explicit start/end, requested/effective/recorded dates, status, reason, and replacement links. Existing signup IDs remain write targets. |
| Trials and drop-ins | `drop_in_registration`, benefit type, pass grants/redemptions | Present beside recurring participation with a distinct kind. Preserve lifetime trial usage, attendance/session links, credits, and existing redemption uniqueness. |
| Membership coverage | Annual membership subscriptions, charge/payment coverage, renewal and waiver rules | Shared entitlement read model; payment, entitlement, and class participation remain separate. Preserve expiry, paid-through dates, transfers, and renewals. |
| Money and collection | Canonical charge, payment, allocation, invoice, refund, credit, subscription, and collection-attempt tables | Existing ledger and services remain authoritative. Prepared totals are disposable projections, never a second ledger. |
| Imported history | `jackrabbit_history_record`, source exports and import reports | Immutable source archive plus typed, versioned facts linked to canonical IDs. Historical transactions remain noncollectible. |
| Timeline | Billing activity, lead activity, notes, enrollment changes, imported events | Unified activity index referencing original records, with source-aware deduplication and permission filtering. |

Proposed additions are an external identity map, migration/reconciliation issue records, normalized historical enrollment/transaction facts, a family summary projection, a unified activity index, and a durable projection-change queue where current mechanisms do not suffice. Exact SQL names and indexes are chosen after the inventory. All carry facility scope, source identity, and appropriate uniqueness constraints. Avoid a second mutable copy of every operational table.

## Merging existing data while preserving history

1. **Capture the source boundary.** Record schema/migration versions, immutable source exports and checksums, a consistent database baseline, import batches, and current collector ownership. Rehearse a restore on an isolated database with outbound Stripe/email work disabled. Treat source artifacts as private customer data.
2. **Resolve identity before consolidating facts.** Use existing canonical IDs, explicit conversion links, previously confirmed Jackrabbit aliases, and source family/student IDs. Add a unique mapping keyed by facility, source organization, entity type, and external ID. Names, email, phone, or matching amounts generate review candidates; they never independently authorize a merge.
3. **Review conflicts individually.** Produce a queue for multiple active families, conflicting payers, cross-facility references, duplicate processor mappings, missing members, and ambiguous historical matches. Record the resolution, evidence, actor, and time. Unresolved families stay on the existing workflow or display an explicit unresolved-history state. Mapping imported evidence to an existing ID is distinct from changing an operational household relationship: any relationship correction must first pass account-balance, access, membership, trial-usage, and pricing-impact checks. Financially consequential corrections use the established business workflow, not a bulk identity cleanup.
4. **Normalize history without overwriting it.** Preserve the original record and a pointer from each typed fact to that record. Retain original dates, their precision, and the facility timezone; a date-only source is not converted into an invented exact event time. Preserve requested, effective, and recorded dates separately. Keep both old and corrected values with a supersession link.
5. **Separate duplicate representations from distinct events.** The same Jackrabbit transaction may appear in source history and account activity; render one event with both references. Separate installments with equal amounts remain separate. A class transfer retains the old and replacement enrollment records while allowing family-level continuity. Reimports reuse stable source keys and never duplicate operational or financial records.
6. **Handle uncertain periods honestly.** An open Jackrabbit enrollment does not prove attendance continued indefinitely. Imports, system creation dates, and account migrations do not establish a first-ever enrollment date. Keep unresolved start/end boundaries and source coverage explicit; affected metrics show unavailable or provisional values until reconciliation. Do not permanently turn the prototype's continuity assumptions into facts. Preserve every available historical record; missing or previously deleted evidence cannot be recreated by migration and remains explicitly unavailable.
7. **Preserve account ownership.** If duplicate family identities need a unified display, keep historical financial accounts separately identified. Linking a person or alias must not move charges, transfer balances, recreate Stripe customers, or rerun collection. A real account consolidation is a separately reconciled financial operation using established transfer/correction procedures.

Historical financial data has three separate uses: archived evidence, historical reporting, and current collectible balances. Importing a Jackrabbit receipt may support the first two; it never creates a new collectible charge or a duplicate live payment. Any necessary opening balance requires an explicit, reconciled adjustment with provenance and existing accounting controls.

## Live changes during backfill

Keep a single authoritative writer for each business fact. The migration creates read models from those facts; it does not dual-write new billing records.

Before starting a production backfill, inventory every writer, including old Admin, New Admin, the member portal, recurring workers, webhooks, repair tools, and imports. Capture changes transactionally from all of them. Use shared transaction-level hooks where complete coverage is possible; otherwise use narrowly scoped database change tracking for the affected tables. A best-effort activity log is insufficient because dropped audit events cannot be allowed to lose projection updates.

Start durable change capture before the snapshot. Backfill in small, restartable batches, then drain captured changes. Queue consumers re-read the latest authoritative family state rather than blindly replaying stale event payloads. Guard writes to projections with a per-family revision and row locking so an older backfill cannot overwrite a newer update. Account for deletes, relationship moves, and both the old and new family when ownership changes. Persist retry and failure states; periodic reconciliation detects drift.

The database snapshot and capture boundary must cover commits concurrent with the snapshot, including transactions begun before capture. Rehearse that race explicitly. Do not rely on a maximum source ID or `updated_at` alone: updates, deletes, and commit ordering can escape that approach.

Initially, the financial summary reads the ledger directly. If later cached, it needs the same revision guarantees, read-after-write behavior, and a clear stale/error state. Collection decisions must always revalidate authoritative records under existing locks, never use the screen cache.

## Delivery phases and release gates

| Phase | Work and deliverable | Gate to proceed | Rollback |
| --- | --- | --- | --- |
| 0 — Baseline and contracts | Trace directory → family → billing for representative households. Inventory sources and writers. Agree metric definitions and authority rules. Extend existing migration audit tooling. | Reproducible latency breakdown; documented IDs/ownership; restored rehearsal database; baseline counts, relationships, money, and processor references. | No application cutover. |
| 1 — Identity and historical mapping | Add source maps, review queue, typed historical facts, and migration manifests. Establish durable change capture before backfill. Audit household pointers and preserve source records. | Every enabled family has unambiguous identity; every imported row is mapped or explicitly unresolved; re-running produces no duplicates; concurrent edits are retained; no unexplained financial difference. | Disable new views; retain additive evidence and versioned mappings. Reverse mapping decisions only with dependency checks. |
| 2 — Family read service | Add the family directory and workspace endpoint. Batch household enrollment/membership queries. Reuse canonical financial calculations. Build bounded activity/history previews. | No per-person query growth; no writes or external calls on GET; permission/facility tests; totals and participation match authoritative fixtures and reconciled accounts. | Route reads to existing endpoints. Billing continues unchanged. |
| 3 — Workspace and shadow comparison | Build a lazy-loaded workspace in New Admin. Existing commands execute actions. Compare old/new reads on the same snapshot; enable an internal cohort, then a small staff cohort. | Financial cents and currency match; known intentional definition changes are documented; no unreviewed discrepancy for an enabled account; performance targets met. | Disable workspace routing only. Keep all completed business actions and queue updates. |
| 4 — Remaining operational views | Move rosters, lead follow-up, trial conversion, membership views, and member-portal summaries to the same resolvers and prepared data. | Cross-screen parity, roster/capacity correctness, trial-credit preservation, and complete writer/change-capture coverage. | Per-workflow read flag; existing shared write services remain available. |
| 5 — Dashboards and retirement | Publish versioned monthly metrics from normalized history. Update projections incrementally. Remove unused reads after monitored adoption. | Metric drill-down matches published totals; no unknowns hidden as zero; successful billing-cycle observation; no calls to retired routes. | Restore previous read version; rebuild disposable projections. Financial state is not rolled back. |

Cut over by facility and staff cohort, with a separate read-routing flag. Do not reuse billing-migration or collector-ownership flags. Avoid broad rollout during a scheduled collection window. A new family read path can ship before historical ambiguities for unrelated families are resolved, provided unresolved history is explicit and does not drive financial actions.

## Billing continuity and reconciliation gates

The workspace migration must not change recurring prices, billing anchors, renewal dates, discounts, autopay settings, payment allocations, outstanding balances, or Stripe object IDs. Existing collection leases, reservations, idempotency keys, duplicate protections, and account-specific migration locks stay authoritative. Both old and new UIs call the same command services.

Reconcile by account and currency, not merely global totals:

- Charges and adjustments by source and service period; invoice lines and totals.
- Settled payments, allocations and their reversals, unapplied payments, credits, refunds, and refund states.
- Outstanding and collectible balances using the existing canonical definitions, plus overdue amounts and next scheduled collection.
- Membership expiry/paid-through dates, renewal eligibility, proration, discounts, and pending changes.
- Processor customer/subscription/invoice/payment/refund reference sets and collector ownership, including accounts partway through an existing billing migration.

Use consistent snapshots for comparisons. In a live system, ordinary new payments mean that before/after total equality by itself is invalid; attribute expected changes to the captured committed events. Gate on unexplained differences, not on an artificially frozen business.

During shadow testing, issue no Stripe commands, payment requests, refunds, or emails. Validate writes against isolated fixtures, test-mode integrations, and the established billing rehearsal tools. In production observe existing operations and compare their results. Trace ledger → family summary → statement/report, and enrollment → roster → bill for representative accounts.

UI rollback never restores an old production database over payments received since deployment. Disable the new read route, keep current canonical data and webhook processing, and repair/rebuild the projection. Already completed financial actions remain completed. The existing billing migration's forward-only states remain forward-only; this project must not reactivate a retired collector to make an old UI work.

## Performance and correctness acceptance

Initial performance budgets, to be confirmed against the baseline:

| Measure | Target |
| --- | --- |
| Initial family view | One primary data request after shared authentication; no required transaction/activity waterfall. |
| Family workspace / directory API | p95 below 300 ms at representative production volume and concurrency. Track cold requests separately. |
| Useful family screen | p95 around one second on the agreed device/network profile, including frontend rendering. |
| Main response size | Aim below 150 KB uncompressed; explicit pagination for larger histories/households. |
| Database work | Query count bounded independently of household size; inspect actual plans before adding indexes or precomputing more data. |
| Refresh behavior | Immediate fresh authoritative financial results after a command. No full-history scan on each dashboard refresh. |

Test small and large families, multiple athletes/classes, alternate payers, archived people, paused/canceled/future enrollments, same-day transfers, returns, free trials, refunds, unpaid and partially paid charges, credits, membership transfers, waived renewals, imported-only families, unresolved identities, and restricted staff accounts. Include concurrent enrollment/payment/cancellation during backfill, duplicate/out-of-order webhook delivery, failed workers, replay after restart, and stale browser responses after switching families.

Measure server authentication, pool wait, SQL, serialization, transport, JavaScript loading, and rendering separately. Keep the database and application suitably located and verify pool behavior under simultaneous billing/background work. Improvement must be demonstrated end to end; a smaller component or fewer visible API calls is not an acceptance result by itself.

## First implementation sequence

1. **Evidence and contracts:** extend `backend/newAdmin/migrationAudit.js` with source-map/history coverage and account-level reconciliation; instrument actual directory and family reads. Record semantic definitions for enrollment, trial conversion, membership coverage, and losses.
2. **Source mapping and normalization:** extend the Jackrabbit import/review tooling using additive migrations, versioned facts, and deterministic source links. Implement durable change capture, the unresolved-record queue, and concurrent backfill/rerun/replay checks before production backfill.
3. **Shared family queries:** create a family workspace service beside `backend/accounts/accountDirectory.js`; extract batch enrollment and membership reads from existing helpers. Reuse `backend/billing/canonicalBillingAccount.js` and `stripeCustomerProjection.js` without invoking collection or reconciliation.
4. **API and access:** register the proposed family routes using canonical facility and permission context. Add bounded history cursors, freshness metadata, snapshot consistency, and aggregate response tests.
5. **Workspace UI:** add a lazy-loaded `FamilyWorkspace` in `src/components/newAdmin`, connect existing directory/roster/lead entry points, and reuse existing financial and enrollment actions. Preserve old deep links and explicit back navigation.
6. **Shadow verification and release:** compare authoritative facts, measure performance, enable the internal cohort, then stage staff rollout. Reconcile a normal billing cycle before retiring the old read path.
7. **Shared reporting:** replace `backend/platform/adminEnrollmentTrend.js` read-time history assembly with reviewed normalized periods and monthly aggregates; use the same metric dataset for timeline, bars, tables, and exports.

Each implementation change carries its acceptance evidence and rollback path. No fixed delivery date is assigned before Phase 0 establishes the scope of identity/history issues and the production performance baseline.

## First workspace implementation — November 8, 2026

Implemented locally in New Admin → Members & accounts → Families. The People directory remains available, and member links from Leads and Classes resolve to the family workspace. Members without an unambiguous current household retain an individual-profile fallback.

The implementation adds these facility-scoped, permission-checked read routes:

- `GET /api/admin/new-admin/families`: paginated family search, including archived records.
- `GET /api/admin/new-admin/families/:id/workspace`: family identity, current/former people, guardian relationships, batched class participation, latest trials and linked inquiries, canonical financial summary, membership coverage, and recent history.
- `GET /api/admin/new-admin/members/:id/workspace`: resolves the member through canonical household relationships before loading that same response.
- `GET /api/admin/new-admin/families/:id/history?cursor=…`: stable keyset pagination across enrollment, trial, inquiry, note, account-activity, and Jackrabbit history.

The workspace uses a repeatable-read, read-only PostgreSQL transaction. It performs no HTTP fan-out, Stripe reads, account creation, reconciliation, ledger writes, or imports. Enrollment reads and membership reads are batched across the household. Tabs and person filters reuse the initial response. Full financial transactions and all billing actions continue through the existing billing workspace, with a return button to the family. Existing enrollment and account-edit workflows remain in use.

This release merges the **read view**, preserving all original tables and IDs. Jackrabbit display copies in account activity are suppressed in favor of their original source history; neither copy is deleted. Unknown imported dates remain unknown, contact matches remain distinct from explicit inquiry conversions, and imported enrollments are not silently treated as current attendance. Financial rows and balances require `billing.view` in addition to `members.view`; family and member reads require the authenticated facility.

Compatibility checks found that the current production database lacks explicit inquiry-conversion columns and the optional saved-card projection table. The new reader handles legacy inquiry linkage without inventing conversion and uses a lightweight catalog check in the existing family query to omit unavailable card details. It does not install schema or call Stripe during reads. Existing migrations remain the deployment prerequisites for the broader New Admin application.

Validation completed:

- PostgreSQL fixture checks compare ledger, account, payment-allocation, signup, and imported-history fingerprints before/after reads; verify read-only enforcement, cross-facility rejection, former-household handling, missing-account behavior, tied/unknown-date pagination, and financial redaction.
- Adding 50 household members leaves the database query count unchanged.
- HTTP checks verify authentication, `members.view` denial, cross-facility denial, and omission of financial data when `billing.view` is denied.
- Browser checks cover shared-response tabs, person filtering, source history, unknown dates, existing billing handoff/return, restricted staff, and a 390-pixel mobile layout.
- TypeScript, targeted ESLint, and the Vite production build pass.
- A read-only check against existing production data successfully loaded a family with current enrollments, financial totals, membership coverage, and imported history. This is a compatibility smoke check, not a production latency benchmark or a full billing-cycle reconciliation.

No production records were changed and no deployment was performed. Prepared reporting datasets, normalization of historical enrollment periods, staff rollout, and billing-cycle reconciliation remain later phases of this plan. The existing Admin and billing workflows remain available as the rollback path.
