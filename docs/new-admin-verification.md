# New Admin verification and handoff

Validation date: November 1, 2026. All database writes used dedicated fictional local databases. Stripe and outbound email were disabled. Production deployment and cutover remain separate actions.

## Delivered behavior

The authorized portal dropdown includes **New Admin** alongside the existing Admin, Coach, and Member portals. New Admin provides searchable, paginated members/accounts, leads, and classes; focused household/enrollment details; explicit lead conversion; class schedules, rosters and capacity; shared enrollment actions; and the existing unified account billing workspace. The original Admin remains available.

Both interfaces use canonical PostgreSQL identities, family relationships, enrollment services, and billing rules. Shared scheduling mutations validate source and target facility relationships. The administrative family wizard uses authenticated, scoped catalogs and validates the selected class/form/offering/group/slot chain before enrollment. Stripe payment-method display reads use a sanitized local projection; collection still verifies the current processor state.

Start and reset instructions, fictional credentials, ownership migration commands, and the production transition checklist are in [new-admin-development.md](new-admin-development.md). Architectural findings and source-to-target mappings are in [new-admin-architecture.md](new-admin-architecture.md). Processor ownership and failure recovery are in [new-admin-stripe.md](new-admin-stripe.md).

## Performance evidence

Browser measurements use the current Vite development source, React StrictMode, 24 fictional classes, and a fixed 20 ms simulated API response delay. Five runs per screen were captured by `scripts/new-admin-browser-benchmark.mjs`. These measure browser request orchestration and rendering, not PostgreSQL or production network performance.

| Screen | Existing Admin requests | New Admin requests | Existing first rows, median | New first rows, median |
| --- | ---: | ---: | ---: | ---: |
| Classes | 306 | 1 | 358.4 ms | 128.5 ms |
| Members | 2 | 1 | 182.7 ms | 54.4 ms |

Classes' data-settled median fell from 475.9 ms to 115.5 ms. The old screen repeats catalog requests and per-class form/offering/detail waterfalls; the new screen uses one bounded aggregate read. Development StrictMode magnifies legacy effect duplication, so 306 is not a claimed production request count. Member results compare a 50-row old page with a 25-row new page; both use the existing account-directory query. That improvement combines a smaller first page, a simpler view, and sharing in-flight reads, not a replacement identity query. Shared shell readiness is measured separately in the JSON and is excluded from the first-row figures above.

Raw browser results: [baseline](new-admin-browser-baseline.json), [after](new-admin-browser-after.json). Real Express/PostgreSQL measurements are separately recorded in [new-admin-api-measurements.json](new-admin-api-measurements.json), using the retained routes and new routes against the same fictional data, one warmup and seven timed reads. Full compatibility payloads and bounded summaries serve different purposes; their timing and byte comparisons do not establish identical-query speedups. In particular, `/api/admin/members` is a compatibility endpoint, not the current Admin directory screen.

| Local API comparison | Retained endpoint median / bytes | New screen endpoint median / bytes |
| --- | ---: | ---: |
| Full class overview → 25 class summaries | 11.36 ms / 58,606 | 5.21 ms / 4,162 |
| Directory 50 rows → 25 rows | 23.47 ms / 33,242 | 24.97 ms / 16,892 |
| Full leads → 25 lead summaries | 5.08 ms / 151,426 | 3.25 ms / 7,590 |

There is no measured directory API latency improvement in this run; its payload is smaller and the browser avoids a duplicate request. Focused member detail measured 3.45 ms and account billing detail 122.17 ms. Billing is now independent of live Stripe read latency; no before/after billing latency claim is made. The final benchmark ran separately from regression tests and backup work. Actual query plans and remaining SQL costs are documented in [new-admin-query-plans.md](new-admin-query-plans.md).

## Local data and migration rehearsal

Fresh setup, repeated setup, and reset were exercised. The seed contains 120 households, 360 members, 180 leads, 240 enrollments, and 24 demonstration classes in addition to seven foundation catalog classes. `admin2 / adminadmin` authenticates through the normal login and bcrypt password verification. The launcher isolates the database, binds to loopback, and disables Stripe, email, and scheduled jobs.

Ownership migration tests cover dry run, explicit facility assignment, repeated apply, conversion idempotence under concurrent requests, and rollback that preserves subsequently edited or converted rows. Unassigned leads remain quarantined until explicitly mapped; public inquiry ownership is configured separately. The legacy inferred `registrations.member_id` is not treated as a conversion record.

A PostgreSQL 15 custom-format backup of the fresh seeded database was restored into a separate dedicated database. Snapshot comparison matched all 38 inventoried tables, with no missing tables or detected relationship anomalies. Counts, selected identity/relationship/status/Stripe-reference fingerprints, and financial totals by account and currency matched. Aggregate raw-table values included 1,600,000 cents in charges, 900,000 cents in payments, 800,000 cents in payment applications, and 50,000 cents in refunds. These are separate table totals, not a formula for current balances. Evidence is in [new-admin-restore-verification.json](new-admin-restore-verification.json).

The snapshot checks the application's canonical records and key invariants; it is not a general proof that every legacy business anomaly is absent. Production data still needs the documented source ownership review and representative account reconciliation.

## Automated and browser validation

The final `npm run test:backend:billing` command passed 1,125 tests, with 17 conditional skips. A combined billing and scheduling regression run passed 1,263 tests, with 17 conditional skips. The full platform suite plus drop-in integration tests passed 1,359 tests, with 12 conditional skips. These suites overlap and should not be added into a unique test count. A real PostgreSQL projection rehearsal and family-enrollment facility test both passed. The Stripe transport is mocked in these tests; no live processor events or charges were sent.

The final `NEW_ADMIN_TEST_DATABASE_URL=postgresql://localhost/vortex_new_admin_dev npm run test:new-admin` run passed all 19 tests, with no skips. They exercise real JWT-authenticated HTTP routes and PostgreSQL fixtures for two facilities, permission overrides, pagination, scoped reads/writes, enrollment relationships, concurrent lead conversion, capacity selection, migration/rollback, canonical child contact resolution, and safe local connection configuration. Management and launch smoke checks passed (12 and 10 checks). TypeScript compilation and the production Vite bundle passed; existing large-chunk warnings remain in the older Admin/payroll/athleticism areas.

The 23 real browser checks use the normal login and actual local Express/PostgreSQL API. Completed checks include member search/pagination and household details, billing/history, capacity update/restoration, lead edit/conversion, child enrollment, scheduled and immediate pause/reactivation, simulated cash recording, refund-history visibility, class creation, saving a first schedule, and returning to existing Admin. [Browser evidence](new-admin-ui-verification.json) records the checks, local mutations, resolved failures, and limits. Full family creation through the wizard was not submitted; its authenticated profile/catalog loading and shared backend invariants were tested.

The browser run uncovered a preexisting pricing defect: a valid empty discount-rule set discarded the authoritative enrollment lines. The shared adapter now preserves full-price lines; actual rule-load failures still make strict pricing unavailable. New regressions cover both cases. Seed charge periods were also corrected to use inclusive month ends. After the fixes, the modified household's three enrollment lines reconciled at 30,000 cents expected and posted, with zero turnover issues. The turnover alert resolved through the normal review service; the historical enrollment alert was resolved through the authenticated admin API with an audit note. A final browser refresh verified the warnings were gone and monthly recurring tuition was $300.00. [Billing rehearsal evidence](new-admin-billing-rehearsal.json) preserves those results. No financial amounts were changed by the seed date correction.

## Production readiness limits

- Live/test Stripe endpoint delivery, signing-secret configuration, subscribed event types, and scheduled reconciliation must be validated in the target environment. Local tests use a mocked processor.
- Rehearse against the exact target schema and sanitized production-scale data. Local latency and the fixed-response browser benchmark do not predict hosted latency or peak load.
- Resolve ambiguous historical lead ownership and the public source-to-facility mapping before enabling scoped collection there.
- The general fresh-database `--all` migration path has a historical failure at migration 566. The documented isolated administrative profile supports local validation and deliberately does not replace the production deployment path.
- The original Admin remains available. The focused scope audit covers the selected shared workflows; broader legacy calendar, bulk enrollment summaries, roster email, and discount/free-pass management remain outside it. Review those surfaces before asserting complete multi-facility isolation for the old application. Production acceptance must cover the facility's actual staff roles and operational workflows before retirement.

No production deploy, live billing transaction, or final cutover was performed.
