# Stripe go-live checklist — Vortex Athletics

Step-by-step guide to get billing working in **test mode** first, then live. Work through each section in order.

**Current code status**

| Phase | What | Status |
|-------|------|--------|
| 1 | Catalog sync (Admin pricing → Stripe Products/Prices) | Done |
| 2 | Pay-at-enrollment via Stripe Checkout | Done |
| 3 | Stripe Subscriptions for recurring tuition + invoice webhooks | Done — renewals mirror into the ledger; status changes synchronize |
| 4 | Live keys, reconciliation job, Customer Portal | Live keys configured; endpoint verification and Customer Portal remain ops steps below |

---

## Part A — Local test mode (do this first)

### A1. Environment variables

In `backend/.env.local`:

```bash
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # from stripe listen (step A3)
DATABASE_URL=...                  # or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD
```

Restart backend after changes.

### A2. Database migration

```bash
cd backend
node run-migration.js 056_stripe_catalog.sql
node run-migration.js 057_stripe_pending_enrollment.sql
node run-migration.js 058_billing_stripe_links.sql
```

Or restart backend (Docker `npm run dev:backend`) — migrations `056`/`057`/`058` apply via `initPlatformTables`.

### A3. Stripe CLI webhook forwarding

In a separate terminal:

```bash
stripe login
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

Copy the `whsec_...` secret into `STRIPE_WEBHOOK_SECRET` and restart backend.

### A4. Sync catalog to Stripe test mode

```bash
cd backend && npm run stripe:sync-catalog
```

Takes several minutes. Confirm in [Stripe Dashboard → Products](https://dashboard.stripe.com/test/products).

### A5. Smoke tests

1. **Admin:** change a program price → save → verify new Price in Stripe (old price deactivated).
2. **Member enroll:** add classes → checkout → pay with `4242 4242 4242 4242` → enrollment completes.
   - Enrollment is committed by **both** paths (either is enough):
     - **Webhook:** `checkout.session.completed` → `commitPendingEnrollment`
     - **Return URL:** member lands on `/?enrollment=paid&session_id=...` → portal calls `POST /api/members/billing/confirm-enrollment-checkout`
   - If payment succeeds but enrollments are missing, check Render logs for `[stripe] enrollment commit:` and verify the webhook endpoint (Part B3) and `STRIPE_WEBHOOK_SECRET`.
3. **Balance paydown:** Billing tab → Pay now (for any outstanding ledger balance).

---

## Part B — Render production (test keys first)

Production API URL: `https://vortex-backend-qybl.onrender.com`

### B1. Open Render dashboard

1. Go to [render.com](https://render.com) → **vortex-backend** service.
2. **Environment** tab.

### B2. Set environment variables

Add or update:

| Key | Value |
|-----|--------|
| `STRIPE_ENABLED` | `true` |
| `STRIPE_SECRET_KEY` | `sk_test_...` (test first; switch to `sk_live_...` only at go-live) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | From step B3 (after creating webhook) |
| `PUBLIC_APP_URL` | `https://www.vortexathletics.com` |

Save → Render redeploys automatically.

### B3. Stripe Dashboard webhook (test mode)

1. [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/test/webhooks) (ensure **Test mode** toggle is on).
2. **Add endpoint**
   - URL: `https://vortex-backend-qybl.onrender.com/api/stripe/webhook`
   - Events to send:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `customer.subscription.paused`
     - `customer.subscription.resumed`
3. Create → reveal **Signing secret** (`whsec_...`).
4. Paste into Render as `STRIPE_WEBHOOK_SECRET` → redeploy.

   **Important:** Use the **Signing secret** from this Dashboard webhook endpoint (`whsec_...`). Do **not** use the secret from `stripe listen` (local CLI) on Render — that causes `400` / “No signatures found matching the expected signature”.

   Open the failed delivery in Stripe → **View webhook endpoint** / event destination → **Reveal signing secret** on **that** destination. Sandbox/test and live each have different secrets. If you rotated the secret, update Render immediately or add the previous secret as `STRIPE_WEBHOOK_SECRETS` (comma-separated) during the grace period.

**Enrollment commit:** Production must have this webhook configured. Without it, enrollment still completes when the member returns to the portal (`?enrollment=paid`), but webhook delivery is the primary path and records the payment if the member closes the browser before redirect.

If webhook deliveries show **400 Bad Request** with a signature error, verify `STRIPE_WEBHOOK_SECRET` on Render matches the endpoint signing secret exactly (no extra spaces/newlines). After deploy, `GET /api/health` should show `buildId` **`stripe-webhook-raw-route-2026-07-04`**. Check Render logs for `[stripe] webhook signature verification failed` — `bodyIsBuffer` should be `true`.

### B4. Run migrations on production database

Production DB is separate from local. **Stripe checkout requires migration `053` first** — without `billing_subscription`, Confirm & pay returns `relation "billing_subscription" does not exist`.

Run **in order**:

1. `047_stripe_billing_scaffold.sql` — `family_billing_account.stripe_customer_id`
2. `053_billing_recurring_model.sql` — creates `billing_subscription`
3. `054_billing_anchor_first.sql`
4. `055_enrollment_cancel_effective.sql`
5. `056_stripe_catalog.sql`
6. `057_stripe_pending_enrollment.sql`

**Option 1 — From your machine** (recommended; set production `DATABASE_URL`):

```bash
cd backend
export DATABASE_URL='postgres://...'   # Render external DB URL
npm run migrate:all
```

Or run each file: `node run-migration.js 047_stripe_billing_scaffold.sql` (repeat for 053–057).

**Option 2 — Render shell** (if available on your plan):

```bash
cd backend && npm run migrate:all
```

**Option 3 — Redeploy backend** after pushing code that self-heals prerequisites on checkout (`ensureBillingRecurringSchema` runs 053–055 before 056). Still prefer `migrate:all` once so boot and ledger stay consistent.

Verify:

```sql
SELECT to_regclass('billing_subscription');
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'family_billing_account' AND column_name = 'stripe_customer_id';
SELECT to_regclass('stripe_catalog_item');
SELECT to_regclass('stripe_pending_enrollment');
```

All three should return table names (not NULL).

### B5. Sync catalog on production

From your machine with production `DATABASE_URL` and test Stripe key:

```bash
cd backend
# point .env.local at production DATABASE_URL temporarily, or export DATABASE_URL
npm run stripe:sync-catalog
```

Or trigger sync by re-saving each program’s pricing in Admin (slower).

### B6. End-to-end test on production (test mode)

1. Member portal on staging/production frontend → enroll → Stripe Checkout (test card).
2. Stripe Dashboard → **Payments** — payment succeeded.
3. Stripe Dashboard → **Webhooks** — endpoint shows `checkout.session.completed` 200.
4. Admin → family billing — charges/payments recorded.

---

## Part C — Switch to live mode (when ready)

Only after test-mode flows work end-to-end.

### C1. Stripe account setup

1. [Stripe Dashboard → Settings → Business details](https://dashboard.stripe.com/settings/business) — complete profile.
2. Connect bank account for payouts.
3. Configure tax if required.

### C2. Live keys on Render

Replace on Render ( **not** in git):

- `STRIPE_SECRET_KEY` → `sk_live_...`
- `STRIPE_PUBLISHABLE_KEY` → `pk_live_...`

### C3. Live webhook

1. Toggle Stripe Dashboard to **Live mode**.
2. Add webhook endpoint (same URL, live mode):
   `https://vortex-backend-qybl.onrender.com/api/stripe/webhook`
3. Same events as B3.
4. Update Render `STRIPE_WEBHOOK_SECRET` with the **live** signing secret.

### C4. Re-sync catalog in live mode

```bash
cd backend && npm run stripe:sync-catalog
```

Uses whichever `STRIPE_SECRET_KEY` is in env — must be live key for live Products.

### C5. Post go-live monitoring

- Stripe Dashboard → Webhooks — watch for failures.
- Admin family billing vs Stripe Payments — spot-check weekly.
- See `PRODUCTION_ALERTING_RUNBOOK.md` for incident paths.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Checkout button missing | `STRIPE_ENABLED=true` + secret key set; restart backend |
| Webhook 400 signature error | `STRIPE_WEBHOOK_SECRET` must match the endpoint (local `stripe listen` vs Render Dashboard secret) |
| Enrollment paid but no signups | Check Render logs for `[stripe] enrollment commit`; verify `057` migration applied |
| Enrollment paid but billing tab empty | Run migration `058`; subscription Checkout records payment via invoice PI — see **Recovery** below |
| Prices stale in Stripe | `npm run stripe:sync-catalog` or re-save program pricing |
| `column stripe_price_id does not exist` | Run migration `056` on that database |

---

## Recovery — enrollment checkout missing ledger rows

When Stripe shows a paid enrollment (`checkout.session.completed`) but the member Billing tab has **$0 charges** and **no payments** (common with subscription-mode Checkout before migration `058`):

1. Apply migration `058_billing_stripe_links.sql` on the database.
2. Deploy backend with `recordEnrollmentStripePayment` (invoice-backed PI + checkout session idempotency).
3. For account **461** (pending enrollment id **9**, session `cs_test_b1NBuhvlZk32oKJFK3XvXxCjgtWxGECsRAuqqwYuM8P0tB1O0GI66T9udG`):

```bash
cd backend
STRIPE_SECRET_KEY=sk_test_... DATABASE_URL=... node scripts/backfill-billing-account-461.mjs
```

4. Verify `GET /api/members/billing/account` shows `currentPeriod.totals` matching checkout amount ($235 = $85 annual + $150 first month) and a `billing_payment` row.

Future enrollments persist additional fees as `billing_charge` (`source_type='additional_fee'`) at signup commit time — no manual backfill needed.

---

## Admin tools

| Action | How |
|--------|-----|
| Manual full sync | `POST /api/admin/stripe/sync-catalog` (admin auth) |
| Catalog health | `GET /api/admin/stripe/catalog-status` |
| CLI backfill | `npm run stripe:sync-catalog` |
