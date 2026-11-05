# New Admin Stripe synchronization

The existing PostgreSQL ledger, account IDs, Stripe customer links, payment/invoice/refund identities, collection locks, and canonical migration tools remain in place. This change adds a display projection and strengthens state synchronization. It never creates a customer, subscription, invoice, charge, or refund during migration.

## Display projection and ownership

Migration `840_stripe_customer_projection.sql` adds one `stripe_customer_projection` row per billing account. It stores only Stripe customer and payment-method references, type/brand/last four digits/expiry, a known Link revocation reason, and synchronization timestamps/status. It cannot store raw card numbers, CVCs, billing addresses, or entire Stripe objects. Account and Stripe customer ownership are verified before refresh and again under the existing household collection lock. Shared customer IDs are rejected even when one account is inactive.

Customer billing detail and overview-list reads use PostgreSQL only. List reads batch projections in one query. A missing projection is `pending`, not proof that a customer has no card. A failed refresh retains the last successful display and reports `failed`; successful data older than 36 hours reports `stale`. Pending, stale, or failed data cannot clear payment-method alerts and produces a synchronization warning. Collection actions continue their existing authoritative Stripe verification, so cached display data never authorizes a charge.

The admin payment-method DTO retains its fields and adds `syncStatus`, `syncedAt`, and `syncError`. The member DTO exposes only display fields and `syncStatus`/`syncedAt`, preserving its existing provider-ID/error redaction. Related billing lists use `sync_required` rather than misclassifying an unknown card as missing.

## Refresh, ordering, and recovery

Successful payment-method setup writes the sanitized projection immediately. Webhooks for customer creation/update/deletion and payment-method attachment/detachment/update refresh the current Stripe customer/default under the account lock. Detached-method events resolve the former customer from previous event attributes or the existing local method mapping. Old event snapshots are never used as the projected default.

The existing reconciliation command (`npm run stripe:reconcile` in `backend`) backfills and refreshes existing active-account customer links using pages of 100 local records. It does not create remote objects. Failures retain their local display status, create an account-scoped Stripe operations alert, and are retried on later runs. A successful refresh resolves only its matching projection alert. Use the existing scheduled reconciliation deployment and Stripe operations monitoring; an operator must confirm those are running in the target environment before cutover.

Enabled Stripe test and live modes now require a configured endpoint signing secret, signature, and exact raw body. Existing secret rotation and test-secret support remain. Local simulated development leaves Stripe disabled. A test-mode integration must configure a real test endpoint signing secret; unsigned test JSON is deliberately rejected.

For exactly owned legacy subscriptions, lifecycle events retrieve current Stripe state under the existing collection lock. Delayed active, pause/resume, or deletion events therefore cannot reverse newer remote state. Retrieval or identity failures leave local lifecycle unchanged and fail the durable event for retry. Existing canonical cutover guards and quarantines remain authoritative.

Reconciliation also retries up to 100 failed/abandoned customer/payment-method/subscription state events using the existing claim leases. It retrieves each exact event from Stripe and dispatches the same current-state handlers. Concurrent claims are skipped; a failed attempt retains failure status and rotates to the back of the retry order. Events Stripe no longer serves remain visible for review rather than being silently marked successful. Existing payment/refund fulfillment recovery remains separate and unchanged.

## Migration and rollback

Apply the additive migration through the existing deploy/startup registry, then run reconciliation in an authorized test environment to populate existing customer links. Until backfill succeeds, screens show pending synchronization. No ledger transformation, dual write, ID remapping, or Stripe reference rewriting is required. Applying the migration twice is safe. A UI rollback retains the projection table and all historical ledger data; do not drop billing data as a rollback shortcut.

For production readiness, verify endpoint event subscriptions include the customer/payment-method event types above, configured signing secrets exist in test/live deployments, reconciliation executes regularly, and failure alerts are monitored. Live endpoint delivery and production-scale reconciliation duration are unverified by local tests.

## Verification

Focused unit/regression tests cover required signatures, invalid/tampered/expired signatures, exact ownership, redaction, stale/failed/pending states, local-only reads, detached-method events, retry claims, delayed subscription ordering, failure retention, and existing payment/refund/migration invariants. Existing webhook route tests now use correctly signed fixtures.

The final combined billing and scheduling regression run passed 1,263 tests with 17 conditional integration skips. The broader `npm run test:backend:billing` command passed 1,125 tests with 17 skips; these overlapping counts are not additive. The webhook route suite passed nine tests. These are local/mocked results, not evidence of live Stripe delivery. A stale-card regression confirms the display can retain the previous card while authoritative collection rejects its now-missing current default. End-to-end local validation also fixed a shared pricing adapter that discarded lines when no discount rules existed; full-price lines now remain available while actual rule-read failures still block strict billing.

The final local workflow also exposed an existing pricing edge case: a facility with no discount rules returned no enrollment pricing lines. The shared adapter now preserves the verified list-price lines for an empty rule set; a failed rule read still blocks strict recurring pricing. Regression tests cover both cases. A read-only PostgreSQL check priced all three fictional family-1 enrollments at their full list prices without changing financial records.

A real PostgreSQL rehearsal applies migration 840 twice in a temporary schema, refreshes the same customer twice, simulates a failed refresh, verifies retained card display and account references, retries successfully, and verifies the matching alert resolves. Stripe is mocked throughout. Run it against the dedicated local database:

```sh
cd backend
NEW_ADMIN_TEST_DATABASE_URL=postgresql://localhost/vortex_new_admin_dev \
  node --test billing/__tests__/stripeCustomerProjection.postgres.test.js
```

The test accepts loopback database URLs only and removes only its own temporary schema. It passed locally on November 1, 2026. No live Stripe requests or charges were made during implementation or validation.
