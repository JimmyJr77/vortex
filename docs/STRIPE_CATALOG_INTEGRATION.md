# Stripe catalog integration — agent handoff

Canonical plan for wiring **full Stripe catalog sync** into Vortex Athletics. Read this before implementing Stripe Products, Prices, checkout, or subscriptions.

**Chosen approach:** **Full Stripe catalog** — mirror sellable catalog items in Stripe as Products + Prices; Vortex remains the pricing brain for family-specific discounts and proration; checkout and recurring billing use Stripe Price IDs.

**Related docs:** [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) § Stripe scaffold, [MEMBER_PORTAL_ROADMAP.md](./MEMBER_PORTAL_ROADMAP.md) billing surface.

---

## 1. Business context

Vortex is a youth athletics facility platform. Families:

1. Browse **programs / classes** (scheduling forms + offerings + time slots).
2. Enroll athletes with a **real-price checkout preview** (discounts, proration, fees, passes).
3. Accrue charges on a **family billing ledger** (`billing_charge` / `billing_payment`).
4. Pay via Stripe (target state: at enrollment and/or on recurring cycle).

**Source of truth for catalog and list pricing:** Vortex Postgres (Admin-configured).  
**Source of truth for net amount charged to a family:** Vortex pricing engine (`orderPricing.js`), with Stripe executing payment.

---

## 2. Current Stripe state (what exists today)

All Stripe behavior is **flag-gated** (`STRIPE_ENABLED=true` + `STRIPE_SECRET_KEY`). SDK is lazy-loaded in [backend/billing/stripeBilling.js](../backend/billing/stripeBilling.js).

| Capability | Status | Location |
|------------|--------|----------|
| Stripe Customer per family | ✅ | `family_billing_account.stripe_customer_id`; created in `ensureStripeCustomer()` |
| Balance paydown Checkout | ✅ | `POST /api/members/billing/checkout-session` — single ad-hoc line item (“Vortex Athletics account balance”) |
| Webhook payment recording | ✅ | `POST /api/stripe/webhook` → `billing_payment` on `checkout.session.completed` / `payment_intent.succeeded` |
| Webhook signature verification | ✅ | `req.rawBody` captured in [backend/server.js](../backend/server.js) for webhook route only |
| Payment receipt email | ✅ | On successful webhook + admin manual payment |
| Failed-payment email | ✅ | On `payment_intent.payment_failed` / `invoice.payment_failed` |
| Member “Pay now” UI | ✅ | [src/components/MemberDashboard.tsx](../src/components/MemberDashboard.tsx) Billing tab |
| Enrollment → Stripe payment | ❌ | Enrollment posts ledger only |
| Stripe Products / Prices sync | ❌ | No `stripe_product_id` / `stripe_price_id` anywhere |
| Recurring auto-charge via Stripe | ❌ | `generateRecurringCharges` posts `billing_charge` records only |
| Stripe catalog mapping table | ❌ | Not in schema |

### Enrollment flow today (no Stripe at checkout)

1. Member selects classes/passes in [src/components/member/MemberClassesOfferedEnroll.tsx](../src/components/member/MemberClassesOfferedEnroll.tsx).
2. Preview via scheduling order API (`buildSignupOrderPreview` in [backend/scheduling/orderPricing.js](../backend/scheduling/orderPricing.js)).
3. **Confirm enrollment** → `submitSchedulingSignupBatch` → signups created.
4. [backend/scheduling/persistSignupCharges.js](../backend/scheduling/persistSignupCharges.js) writes `billing_charge` (+ `billing_subscription` for recurring lines).
5. Family pays later via **Pay now** (balance checkout) if `stripeEnabled`.

---

## 3. Vortex catalog taxonomy (what must map to Stripe)

Do **not** create a Stripe Product per time slot or per scheduling offering row. Map at **program option / pass / fee / class-override** level.

| Entity | Where pricing lives | Billing shape | Stripe mapping unit |
|--------|---------------------|---------------|-------------------|
| **Program pricing options** | `programs.pricing_cost_options` (JSONB) | Recurring monthly (most keys) or per-unit | 1 Product + 1 Price per **enabled** option key |
| **Multi-class passes** | `programs.multi_class_pass_packages` (JSONB) | One-time | 1 Product + 1 Price per **enabled** package (`package.id`) |
| **Class cost override** | `scheduling_form` cost columns when `pricing_overrides_program = true` | Recurring or one-time | 1 Product + 1 Price per override form (if priced) |
| **Additional fees** | `additional_fee` table | One-time or per-year | 1 Product + 1 Price per active fee |
| **Per-offering unit** | Program option key `per_offering` | One-time per offering | Price at program level; quantity at checkout — not per DB offering row |
| **Order discounts** | `discountEngine.js`, promo codes | Adjustments | Stripe Coupons and/or server-side discount amounts — not catalog Products |
| **Proration / credits** | `orderPricing.js` first-month layer | One-time adjustments | Invoice line items or Checkout adjustments — not catalog Prices |
| **Account balance paydown** | Ledger sum | One-time | Existing generic Checkout line (keep as-is) |

### Program pricing option keys

Defined in [backend/programs/programPricingOptions.js](../backend/programs/programPricingOptions.js):

`per_class`, `per_hour`, `monthly_1x` … `monthly_7x`, `unlimited_*`, `per_offering`.

### Multi-class pass package shape

Normalized in [backend/programs/multiClassPass.js](../backend/programs/multiClassPass.js): `{ id, classCount, priceCents, enabled, label }`.

### Additional fees

Table `additional_fee` ([backend/migrations/add_additional_fees.sql](../backend/migrations/add_additional_fees.sql)): scoped global/sport/program/class/offering; triggers on enrollment, new member, once per year.

### Internal ledger (unchanged role)

- `billing_charge` — charges (types: `recurring`, `one_time`, `adjustment`, `refund`, `credit`)
- `billing_subscription` — recurring monthly rate per enrollment ([backend/migrations/053_billing_recurring_model.sql](../backend/migrations/053_billing_recurring_model.sql))
- `billing_payment` — payments including `stripe_payment_intent_id`

---

## 4. Target Stripe object model

### Products (what you sell)

| Stripe Product | Vortex source | Example name |
|----------------|---------------|--------------|
| Program + option | `programs.id` + `pricing_cost_options[].key` | `Ninja — Monthly 2x` |
| Multi-class pass | `programs.id` + `multi_class_pass_packages[].id` | `Ninja — 10-Class Pass` |
| Additional fee | `additional_fee.id` | `Annual Registration Fee` |
| Class override | `scheduling_form.id` (when override priced) | `Comp Team — Custom rate` |
| Balance (existing) | Generic | `Vortex Athletics account balance` |

### Prices (list price + cadence)

| Vortex cost unit / type | Stripe Price |
|-------------------------|--------------|
| `per_month`, `monthly_*` keys | **Recurring**, interval `month` |
| `per_class`, `per_offering`, passes, fees | **One-time** |
| Proration, household discounts, credits | **Not** catalog Prices — adjustments at checkout/invoice time |

### Metadata (required on every Product and Price)

```json
{
  "vortex_entity_type": "program_option | multi_class_pass | additional_fee | class_override",
  "vortex_entity_id": "13",
  "vortex_sub_key": "monthly_2x",
  "vortex_facility_id": "1"
}
```

### Lookup keys (idempotent sync)

Unique per catalog item:

```
vortex:program:{programsId}:{optionKey}
vortex:program:{programsId}:pass:{packageId}
vortex:fee:{additionalFeeId}
vortex:form:{schedulingFormId}:override
```

---

## 5. Architecture principle

```
┌─────────────────────┐     sync      ┌──────────────────┐
│  Vortex Admin       │ ────────────► │ Stripe Products  │
│  (catalog + list $) │               │ + Prices         │
└─────────────────────┘               └──────────────────┘
         │                                       │
         │ orderPricing.js                       │ Price IDs
         ▼                                       ▼
┌─────────────────────┐     checkout    ┌──────────────────┐
│  Family-specific    │ ──────────────► │ Stripe Checkout  │
│  net $ + line items │ ◄────────────── │ / Subscriptions  │
└─────────────────────┘     webhooks    └──────────────────┘
         │
         ▼
┌─────────────────────┐
│ billing_charge      │
│ billing_payment     │
│ billing_subscription│
└─────────────────────┘
```

- **Stripe** = catalog list prices + payment execution + subscriptions/invoices.
- **Vortex** = which Price IDs apply, quantities, family discounts, proration, enrollment state.
- **Do not** duplicate every computed net price as a Stripe Price.

---

## 6. Database changes (to implement)

No `stripe_product_id` / `stripe_price_id` columns exist today. Prefer a **central mapping table**:

```sql
-- Proposed: backend/migrations/0XX_stripe_catalog.sql
CREATE TABLE stripe_catalog_item (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT REFERENCES facility(id) ON DELETE CASCADE,
  entity_type         TEXT NOT NULL
                      CHECK (entity_type IN (
                        'program_option', 'multi_class_pass',
                        'additional_fee', 'class_override', 'balance'
                      )),
  entity_id           BIGINT NOT NULL,
  sub_key             TEXT,                -- pricing option key or pass package id
  stripe_product_id   TEXT NOT NULL,
  stripe_price_id     TEXT NOT NULL,
  stripe_lookup_key   TEXT NOT NULL UNIQUE,
  amount_cents        INTEGER NOT NULL DEFAULT 0,
  recurring_interval  TEXT,                -- 'month' or NULL
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Extend existing tables (additive):**

| Table | New columns |
|-------|-------------|
| `billing_charge` | `stripe_price_id`, `stripe_invoice_item_id` (optional) |
| `billing_subscription` | `stripe_subscription_id`, `stripe_subscription_item_id` |
| `billing_payment` | already has `stripe_payment_intent_id` |

Record new objects in [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) when migration lands.

---

## 7. Sync service (to implement)

**New module:** `backend/billing/stripeCatalogSync.js`

### Responsibilities

1. **Upsert Stripe Product** from Vortex entity (name, description, metadata).
2. **Upsert Stripe Price** with `lookup_key`; on amount change: create new Price, deactivate old (Prices are immutable).
3. **Persist** `stripe_catalog_item` row.
4. **Deactivate** when admin disables option/package/fee.

### Trigger points (hook existing admin saves)

| Admin action | Route area | Sync |
|--------------|------------|------|
| Save program pricing / passes | [backend/programs/registerRoutes.js](../backend/programs/registerRoutes.js) | All enabled options + packages |
| Save class form pricing override | [backend/scheduling/handlers.js](../backend/scheduling/handlers.js) | If `pricing_overrides_program` and priced |
| Save additional fee | scheduling/admin fee routes | That fee row |

### CLI backfill

```bash
npm run stripe:sync-catalog   # proposed script in backend/package.json
```

Iterates all facilities → programs → enabled options/passes → fees → upserts to Stripe test mode.

### Sync rules

- Guard all calls with `stripeEnabled()`.
- Use **test keys** until explicit go-live.
- Never delete Stripe Prices — set `active: false`.
- Log sync failures; surface in Admin UI.

---

## 8. Checkout and enrollment (target flow)

Replace or augment “Confirm enrollment” (ledger-only) with payment-gated enrollment.

### Proposed endpoint

`POST /api/members/billing/enrollment-checkout-session`

**Input:** same signup batch + promo codes as enrollment preview.  
**Process:**

1. Run `buildSignupOrderPreview` (must match what member saw).
2. Resolve each billable line → `stripe_catalog_item.stripe_price_id`.
3. Build Checkout Session:
   - **One-time lines** (passes, fees, prorated due-now): `mode: 'payment'`
   - **Recurring tuition** (subscription-first): `mode: 'subscription'` with recurring Price IDs
4. Attach metadata: `familyBillingAccountId`, `memberId`, `previewHash`, line keys.
5. Apply discounts: Stripe Coupons (synced promos) and/or `discounts` / custom amounts for household rules.

**Webhook `checkout.session.completed`:**

1. Verify amount and metadata.
2. Create signups (today’s handler logic in [backend/scheduling/handlers.js](../backend/scheduling/handlers.js)).
3. `persistSignupCharges` + link `stripe_price_id` on charges.
4. For subscriptions: store `stripe_subscription_id` on `billing_subscription`.

**Critical:** Do not commit enrollment until payment succeeds (or use authorized-but-not-captured flow with explicit rollback).

### Keep existing balance checkout

`POST /api/members/billing/checkout-session` remains for paying outstanding ledger balance (generic product).

---

## 9. Discounts and promos

| Discount type | Where computed | Stripe strategy |
|---------------|----------------|-----------------|
| Program promo codes | `programs.pricing_promo_codes` | Mirror to **Stripe Coupons** (optional sync) |
| Household / multi-child | `discountEngine.js` | Server-computed; apply via Checkout discount or post-line adjustment |
| Free slots / passes | `freePass` / pass redemption | Zero-quantity or 100% coupon; or exclude from line_items |
| Proration | `orderPricing.js` first-month layer | Not a catalog Price — one-time line or `price_data` adjustment |

---

## 10. Recurring billing (subscription-first)

**Current:** [backend/scheduling/billingSubscriptions.js](../backend/scheduling/billingSubscriptions.js) + recurring charge generator posts ledger only.

**Target:**

1. On enrollment with recurring lines → Stripe **Subscription** with items referencing synced recurring `stripe_price_id`.
2. `billing_subscription.stripe_subscription_id` + `stripe_subscription_item_id` stored.
3. Webhooks: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted`.
4. `invoice.paid` → idempotent `billing_payment` + monthly `billing_charge`.
5. Nightly reconciliation: Stripe invoices ↔ `billing_charge` / `billing_payment`.

---

## 11. Environment and ops

### Required env vars (`backend/.env.local` / Render)

| Variable | Purpose |
|----------|---------|
| `STRIPE_ENABLED` | `true` to activate |
| `STRIPE_SECRET_KEY` | `sk_test_...` or live |
| `STRIPE_PUBLISHABLE_KEY` | For embedded Stripe.js later (`pk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` — **local:** from `stripe listen`; **production:** Dashboard endpoint secret |

### Webhook endpoint

- **Production API:** `https://vortex-backend-qybl.onrender.com/api/stripe/webhook`
- **Events (minimum):** `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`

### Local dev (recommended)

```bash
npm run dev:backend          # Docker — node_modules on fast volume
npm run dev                  # Vite frontend
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

See [README.md](../README.md) Quick Start and [docker-compose.dev.yml](../docker-compose.dev.yml).

### Stripe Dashboard (manual, one-time)

- Business profile, bank account, tax settings
- Webhook endpoint + signing secret on Render
- MCP/plugin: Cursor Stripe plugin (`/add-plugin stripe`) + `~/.cursor/mcp.json` → `https://mcp.stripe.com`

### Test card

`4242 4242 4242 4242` — any future expiry, any CVC.

---

## 12. Admin UX (to build)

| Feature | Purpose |
|---------|---------|
| Sync status on program/fee admin | Synced / stale / error |
| “Sync to Stripe” button | Manual re-sync |
| Catalog health view | Orphaned prices, amount drift |
| Link to Stripe Dashboard product | Support/debug |

---

## 13. Implementation phases

Implement in order. Do not skip Phase 1.

### Phase 1 — Foundation

- [x] Migration `stripe_catalog_item` + billing table extensions
- [x] `stripeCatalogSync.js`
- [x] Hooks on program/fee/class admin save
- [x] `npm run stripe:sync-catalog` backfill
- [x] Update DATABASE_ARCHITECTURE.md

### Phase 2 — One-time catalog checkout

- [x] `POST /api/members/billing/enrollment-checkout-session`
- [x] Webhook: payment → enrollment commit
- [x] UI: redirect to Checkout instead of immediate confirm (or pay-then-confirm)
- [x] Passes + fees + prorated “due now” via Price IDs (with `price_data` fallback for proration)

### Phase 3 — Recurring subscriptions

- [ ] Checkout `mode: 'subscription'` for recurring lines
- [ ] `billing_subscription` ↔ Stripe Subscription
- [ ] Invoice webhooks → ledger
- [ ] Deprecate or supplement `generateRecurringCharges` for Stripe-backed subs

### Phase 4 — Reconciliation and go-live

- [ ] Reconcile job: Stripe ↔ `billing_payment` / `billing_charge`
- [ ] Live keys + live webhook on Render
- [ ] Stripe Customer Portal for payment method updates
- [ ] Runbook updates in PRODUCTION_ALERTING_RUNBOOK.md

---

## 14. Key codebase files

| Area | Path |
|------|------|
| Stripe billing (today) | [backend/billing/stripeBilling.js](../backend/billing/stripeBilling.js) |
| Member billing routes | [backend/platform/registerRoutes.js](../backend/platform/registerRoutes.js) (~L1870 webhook, checkout) |
| Order preview / pricing | [backend/scheduling/orderPricing.js](../backend/scheduling/orderPricing.js) |
| Enrollment handler | [backend/scheduling/handlers.js](../backend/scheduling/handlers.js) |
| Ledger writes | [backend/scheduling/persistSignupCharges.js](../backend/scheduling/persistSignupCharges.js) |
| Program pricing options | [backend/programs/programPricingOptions.js](../backend/programs/programPricingOptions.js) |
| Multi-class passes | [backend/programs/multiClassPass.js](../backend/programs/multiClassPass.js) |
| Member enroll UI | [src/components/member/MemberClassesOfferedEnroll.tsx](../src/components/member/MemberClassesOfferedEnroll.tsx) |
| Order summary UI | [src/components/pricing/OrderPricingSummary.tsx](../src/components/pricing/OrderPricingSummary.tsx) |
| Stripe migration | [backend/migrations/047_stripe_billing_scaffold.sql](../backend/migrations/047_stripe_billing_scaffold.sql) |
| Env template | [backend/env.example](../backend/env.example) |

---

## 15. Explicit non-goals

- **Do not** create Stripe Products per scheduling time slot or per `scheduling_offering` row.
- **Do not** hand-maintain hundreds of Products in Stripe Dashboard — use sync + backfill.
- **Do not** store secret keys in repo; use env vars only.
- **Do not** drop ledger tables — `billing_charge` / `billing_subscription` remain source of truth for family balance and reporting; Stripe executes collection.

---

## 16. Architectural decision (locked)

**Subscription-first** for recurring tuition: full catalog means recurring enrollments create Stripe Subscriptions using synced recurring Price IDs, not only ledger + balance paydown.

Balance paydown Checkout remains a fallback for manual/off-cycle payments.

---

## 17. Agent startup checklist

When picking up this work:

1. Read this doc and [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) § Stripe.
2. Confirm `STRIPE_ENABLED` + keys in `backend/.env.local`.
3. Start backend via `npm run dev:backend` (Docker).
4. Implement **Phase 1** unless user specifies otherwise.
5. Use Stripe test mode until user requests go-live.
6. Follow workspace rules: update DATABASE_ARCHITECTURE.md on schema changes; update MEMBER_PORTAL_ROADMAP.md on member-facing billing changes.
