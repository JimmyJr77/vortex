# New Admin SQL plan measurements

Measured on the loopback fictional development database on November 1, 2026. These measurements followed interactive workflow checks, so the data contained 361 members, 180 leads, 31 classes, and 241 enrollments. They are not the initial seed baseline or production load measurements.

`backend/newAdmin/explain.mjs` executes the actual list functions inside a repeatable-read, read-only transaction, captures their SQL, and runs `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` five times after one list warmup. No planner settings or table statistics were changed. The script rejects remote database URLs, URL query overrides, production mode, and databases outside the dedicated development name. Samples, plan nodes, and relevant existing indexes are saved in [new-admin-query-plans.json](new-admin-query-plans.json).

| Query | Median planning | Median execution |
| --- | ---: | ---: |
| Directory page, 25 rows | 7.761 ms | 24.101 ms |
| Directory count and facets | 6.027 ms | 9.145 ms |
| Lead page, 25 rows | 0.036 ms | 0.045 ms |
| Lead count | 0.025 ms | 0.129 ms |
| Class page, 25 rows | 0.547 ms | 1.260 ms |
| Class count | 0.048 ms | 0.035 ms |

These SQL timings include EXPLAIN instrumentation and exclude authentication, HTTP transport, and rendering. They should not be added to or treated as the independent API medians. Each endpoint issues its page and count/facet queries concurrently.

The class query uses the existing `idx_scheduling_signup_active_form_slot_status` partial index to count active enrollments. At this small scale PostgreSQL chooses sequential scans for the small form, offering, and group tables; there is no evidence that adding more indexes there improves this workload. The page query currently computes class summaries before sorting and limiting, so a larger facility should be measured for a page-first query before adding indexes speculatively.

The lead page uses the existing creation-date index and stops after the first page. Migration 841 adds a partial `(facility_id, created_at DESC, id DESC)` index for tenant-scoped ordering; PostgreSQL did not choose it over the older creation index in this single-facility, 180-lead sample. Thus this measurement supports fast bounded leads delivery, not a claimed measured gain from that new index. Contains-search still evaluates concatenated contact fields; consider an expression/trigram index only after larger search measurements demonstrate a need.

The reused directory is the most expensive query. Its canonical guardian, enrollment, waiver, and login-access joins supply one consistent row shape, but page and facets each repeat much of that work. The plan performs repeated `app_user_role` scans through the existing access-context view (121/120/120 loops at this size), while using the active-household unique index for payer membership checks. Existing role indexes are already present; refactoring repeated access-context work into one aggregate per user and separating optional facets are more credible next steps than a duplicate index. This remains a follow-up for a larger representative dataset; the current API payload and request improvements are measured separately.

To reproduce from the repository root after local seeding:

```sh
NEW_ADMIN_DATABASE_URL=postgresql://localhost/vortex_new_admin_dev node backend/newAdmin/explain.mjs
```

The script writes only the local report file. It does not modify database records, contact Stripe, or send email.
