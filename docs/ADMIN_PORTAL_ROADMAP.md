# Vortex Admin Portal — Master Roadmap & Architecture

Canonical, durable record of the **Admin portal** (the staff/owner management console). It
captures what exists, how it's structured, and the decisions worth preserving. Keep it current
as the portal evolves (see the project rule
[.cursor/rules/admin-portal-roadmap.mdc](../.cursor/rules/admin-portal-roadmap.mdc)).

> Status legend: ✅ Complete · 🟡 In progress · ⬜ Planned

## Where we are today

- ✅ RBAC-gated tabbed shell with ~17 tabs, driven by `/api/admin/access/me`.
- ✅ Members/families/guardians/athletes CRUD + enrollments + archive (light-theme modals).
- ✅ Access management (roles + per-user allow/deny overrides), Admins, Coaches assignments.
- ✅ Scheduling v2 (forms, offerings, slots, signups, waitlist, calendar).
- ✅ Pricing & discount engine (costs, discounts, free passes, rules, promo codes).
- ✅ Billing & waivers admin; Inquiries, Events, Highlights, Schools, DB Queries.
- ✅ Analytics & engagement dashboard.

---

## Architecture & key decisions (and *why*, for posterity)

### Portal as a full-app swap (not a route), lazy-loaded
[Admin](../src/components/Admin.tsx) replaces the app tree when `isAdmin && activePortal === 'admin'`
([src/App.tsx](../src/App.tsx)) and is `lazy()`-imported. **Why:** keep public-site first paint
fast and the admin bundle isolated; the portals are distinct top-level experiences.

### RBAC with per-user permission overrides (and master bypass)
Roles (`role`) grant permissions (`permission`) via `role_permission`; users can have multiple
roles (`app_user_role`) and per-user `allow`/`deny` rows (`app_user_permission_override`).
`MASTER_ADMIN`/`OWNER_ADMIN` (or `admin_profile.is_master_admin`) bypass to all permissions.
**Why:** fine-grained delegation without minting a custom role per person. Resolution lives in
[backend/platform/registerRoutes.js](../backend/platform/registerRoutes.js) (`hasPermission`,
`requirePermission`).

### Dual permission enforcement (legacy + platform)
Every `/api/admin/*` request passes `authenticateAdmin` then a **legacy** path→permission map
(`legacyAdminPermissionFor` in [backend/server.js](../backend/server.js)); newer platform routes
add a **second** explicit `requirePermission()` check. **Why:** the monolith predates the
platform RBAC layer; both layers now apply. Document both when touching admin security.

### Tab-level RBAC on the frontend
`Admin.tsx` fetches `/api/admin/access/me` and filters its tab list by each tab's `permission`
key (master admins see all). **Why:** hide unusable tabs before users hit 403s.

### Module-numbered migrations + ad-hoc `add_*.sql`
Core domains are sequential (`001` identity/RBAC/facility, `002` programs/classes, `003`
families/athletes, `005` unified member, `008` RBAC+billing+waivers, `009` identity cleanup,
`010` payment reconciliation). Feature additions ship as incremental `add_*.sql` patches without
renumbering the core chain. Platform/coaching migrations `008`–`022` are auto-applied on boot via
[backend/platform/initTables.js](../backend/platform/initTables.js). **Why:** stable core history
+ low-friction feature patches.

### Scheduling v2 refactor
Moved from rigid day-of-week slots to enroll **forms** tied to programs, **offerings** (date
ranges), flexible slot modes, and JSONB `signup_fields`/`responses`. **Why:** real-world class
scheduling needed flexibility. Files: `refactor_scheduling_v2.sql`, `unify_programs_scheduling.sql`,
`add_scheduling_offerings.sql`, `add_scheduling_waitlist.sql`, `add_slot_groups.sql`. UI splits
across Scheduling (config), Calendar (visualization), Signups (operations), Pricing (rules).

### Scheduling categories removed (migration `033`)
The "class category" sub-level under each scheduling form was removed end-to-end (DB tables,
`category_id` columns, routes, types, UI). **Why:** every class already collapsed to a single
global "No Category" bucket, so the dimension added complexity without value. **Behavior now:**
Admin > Classes shows **one row per class** (no per-category fan-out, Category column, category
filter, or split/variation actions); public/member signup shows a form's offerings/slots directly
with no category picker step; coach assignment drill-down stops at the **class/form** level; and
pricing benefit selection no longer supports a `category` scope. The old
`/api/admin/scheduling/categories…` CRUD and the `sync-scheduling-categories` route were removed
(the latter replaced by `POST /api/admin/programs/consolidate`). See
[DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §10.3b for the dropped objects. `program_categories`
and other unrelated "category" concepts are untouched.

### Discount engine = estimate-only layered pricing
`discount_rule.scope_level` cascades `global → sport → program → class → offering`, with stackable
rules, caps (`discount_global_settings`), promo codes, and free passes; simulation endpoints let
admins preview. **Why:** transparent enrollment estimates without creating charges
(`add_discount_engine.sql`: "estimate-only pricing").

### Multi-portal session sharing
One person can be admin + coach + member. A shared JWT plus `persistAdminSessionFromAccount`
mirrors a member login into admin keys; `PortalNavButtons` switches without re-auth.
**Security:** `authenticateAdmin` still verifies the token user's admin role — family membership
alone never grants admin access.

### Light-theme admin modernization
The content area moved from dark forms/modals to readable white cards
(`bg-white rounded-2xl shadow-xl`, light inputs); the header keeps the dark brand gradient.
**Why:** legibility and consistency with the member portal (member modals mirror the admin
Members table shape).

### Full-bleed admin width
Admin uses `.container-admin` (`w-full max-w-none`, [src/index.css](../src/index.css)) rather than
the capped `container-custom`. **Why:** data-dense tables/calendars need the full viewport.

---

## Frontend surface

Session keys: `vortex_admin='true'`, `adminToken` (JWT), `vortex-admin-info`, `vortex-admin-id`.
`hasAdminSession()` requires both flag + token ([src/utils/api.ts](../src/utils/api.ts)). All admin
calls go through `adminApiRequest()` (Bearer `adminToken`).

**Shell** — [src/components/Admin.tsx](../src/components/Admin.tsx): dark header (`VORTEX ADMIN`
+ `PortalNavButtons` + scrollable tabs) over a white `container-admin` content area. Tabs are
RBAC-filtered from `/api/admin/access/me`. Cross-tab deep-linking (Classes → Scheduling) via a
`SchedulingNavigationIntent`.

| Tab | Component | Manages | Permission |
|-----|-----------|---------|------------|
| Admins | `AdminAdmins.tsx` | Legacy admin accounts (master vs admin) | `admins.manage` |
| Access | `AdminAccess.tsx` | Roles + allow/deny overrides, accounts, activate | `admin_access.manage` |
| Members | `AdminMembers.tsx` | Member/family/guardian/athlete CRUD; expandable row panel (Member Details, Account Security, Enrollments, Staff Notes, Billing); enroll, archive, pricing modal | `members.view` |
| Inquiries | `AdminInquiries.tsx` | Registrations + newsletter + notes/follow-up | `members.view` |
| Classes | `AdminClasses.tsx` | Top programs/categories, class rows, discipline tags | `classes.view` |
| Coaches | `AdminCoaches.tsx` | Coach roster + program/iteration assignments | `classes.manage` |
| Scheduling | `AdminScheduling.tsx` | Forms, offerings, slots, signups | `scheduling.view` |
| Calendar | `scheduling/AdminCalendar.tsx` | Month/week/day/by-class calendar | `scheduling.view` |
| Pricing | `AdminPricing.tsx` | Costs, discounts, free passes, rules, promo codes | `pricing.view` |
| Billing | `AdminFamilyBilling.tsx` | Family billing accounts, charges, statements, payments | `billing.view` |
| Waivers | `AdminWaivers.tsx` | Waiver templates + compliance + per-row/bulk waiver-request emails | `waivers.view` (send needs `waivers.manage`) |
| Signups | `AdminSignups.tsx` | Roster, archived/orphaned signups, password reset | `scheduling.view` |
| Email | `AdminEmail.tsx` | SMTP status (`/api/admin/email/status`) + send test email | `admin_access.manage` (test send is master-admin only) |
| Highlights | `AdminHighlights.tsx` | Site highlight popups | `classes.view` |
| Events | `AdminEvents.tsx` | Facility events + edit log | `classes.view` |
| DB Queries | `AdminDbQueries.tsx` | Ad-hoc query builder + CSV export | `admin_access.manage` |
| Schools | `AdminSchools.tsx` | Verified schools + write-in merge | `schools.view` |
| Analytics | `analytics/AnalyticsDashboard` | Traffic/funnel/conversion/SEO + sync/export | `analytics.view` |

API clients: [src/utils/api.ts](../src/utils/api.ts) (core),
[src/utils/schedulingApi.ts](../src/utils/schedulingApi.ts) (scheduling + pricing/discounts),
[src/utils/analyticsApi.ts](../src/utils/analyticsApi.ts), `src/utils/adminFeaturesApi.ts`
(schools/notes/db-queries), `src/utils/programsApi.ts`.

---

## Backend surface

Registration order ([backend/server.js](../backend/server.js)): analytics → scheduling →
programs → platform → coach portal → dev members. Global guard on `/api/admin/*`:
`authenticateAdmin` + `legacyAdminPermissionFor`; platform routes add `requirePermission`.

- **Members/families/users/athletes** (server.js; `members.*`/`families.*`): `/api/admin/members`
  CRUD/search/archive, `/api/admin/users`, `/api/admin/athletes` (+ enrollments),
  `/api/admin/families` CRUD + join/remove.
- **Access & coaches** (registerRoutes.js; `admin_access.manage` / `classes.manage`):
  `/api/admin/access/me|users|roles`, role/permission/active updates; `/api/admin/coaches`
  (+ options, profile, assignments).
- **Billing & waivers** (registerRoutes.js; `billing.*`/`waivers.*`): family billing accounts,
  charges, payments, statements, status; waiver templates + compliance.
  Waiver-request emails: `POST /api/admin/members/:memberId/waivers/request` (single) and
  `POST /api/admin/waivers/request-all` (bulk, non-compliant members) — both `waivers.manage`,
  best-effort via [backend/email/waiverRequestEmail.js](../backend/email/waiverRequestEmail.js),
  recipient resolved to the member's email or a guardian's.
- **Email diagnostics** (server.js): `GET /api/admin/email/status` (SMTP config summary + live
  verify) and `POST /api/admin/email/test` (master-admin only; sends a test message). Surfaced in
  the `Email` admin tab.
- **Scheduling** ([backend/scheduling/registerRoutes.js](../backend/scheduling/registerRoutes.js);
  `scheduling.*`): forms, offerings, slot batches/groups, signups (+ orphaned),
  calendar. (Scheduling-category CRUD routes `/api/admin/scheduling/categories…` were **removed** — see migration `033`.)
- **Pricing/discounts** (scheduling sub-routes; `pricing.*`): `discount-rules`,
  `discount-settings`, `discount-simulate`, `sport-defaults`, `additional-fees`, `free-passes`,
  `promo-codes`, `pricing-*-selections`, member pricing summary.
- **Programs/classes** (server.js + [backend/programs/registerRoutes.js](../backend/programs/registerRoutes.js);
  `classes.*`): programs/categories/levels, class iterations, top programs, class events,
  discipline tags, class consolidation (`POST /api/admin/programs/consolidate`, formerly
  scheduling-category sync).
- **Analytics** ([backend/analytics/registerRoutes.js](../backend/analytics/registerRoutes.js);
  `analytics.view`): overview/traffic/funnel/programs/inquiries/conversion/seo/export/sync,
  competitors, marketing campaigns.
- **Inquiries / events / highlights / schools / db-queries**: `/api/admin/registrations`,
  `/newsletter`, `/api/admin/events`, `/api/admin/highlights`, `/api/admin/schools/*`,
  `/api/admin/db-queries/*`.
- **Admins** (legacy): `GET/POST /api/admin/admins` (`admins.manage`), `/admins/me`.

---

## Data model (admin-managed)

| Group | Key tables | Origin |
|-------|-----------|--------|
| Facility | `facility` | `001` |
| Identity / RBAC | `app_user`, `app_user_role`, `role`, `permission`, `role_permission`, `app_user_permission_override`, `admin_profile.is_master_admin`, `coach_profile` | `001`, `008` |
| Members / families | `member`, `family`, `family_member`, `parent_guardian_authority`, `emergency_contact` | `003`, `005`, `006`, `008`, `009` |
| Programs / classes | `programs` (top-level), `program` (class template), `class`, `class_iteration` | `002`, `add_class_iteration_table`, `unify_programs_scheduling` |
| Scheduling | `scheduling_form`, `scheduling_offering`, `scheduling_time_slot`, `scheduling_slot_group`, `scheduling_signup` (+ orphaned/waitlist) | `add_scheduling_*`, `refactor_scheduling_v2`; `scheduling_category`/`scheduling_form_category` removed in `033` |
| Discount engine | `discount_rule`, `discount_global_settings`, `sport_pricing_default`, promo/redemption tables | `add_discount_engine`, `add_*_discount_*` |
| Billing | `family_billing_account`, `billing_charge`, `billing_payment`, `billing_statement`, `billing_statement_line` | `008`, `010` |
| Waivers | `waiver_template`, `member_waiver_acceptance` | `008` |
| Email verification | `app_user.email_verified`/`email_verified_at`, `email_verification_token` | `040` |
| Coaches | `coach_profile`, `coach_class_assignment` | `008` |
| Analytics | `analytics_events`, `visitor_sessions`, `consent_records` | `add_analytics_tables` |
| Highlights / events / inquiries | `highlights`, `events` (+ edit log/tags), `registrations` | `add_highlights_table`, `seed_events`, `add_inquiry_*` |

**Roles seeded** (`008`): `MASTER_ADMIN`, `OWNER_ADMIN`, `ADMIN`, `COACH`, `MEMBER`,
`PARENT_GUARDIAN`, `ATHLETE`, `ATHLETE_VIEWER`.

**Permission keys** (`008`): `admins.manage`, `admin_access.manage`, `members.view/edit/archive`,
`families.view/edit`, `family_billing.manage`, `billing.view/manage/statements.manage`,
`waivers.view/manage`, `classes.view/manage/build`, `scheduling.view/manage`,
`pricing.view/manage`, `schools.view/manage`, `analytics.view`, `coach_portal.access`.

---

## Auth flow

- Admin login modal [src/components/Login.tsx](../src/components/Login.tsx) →
  `POST /api/admin/login` (prefers `app_user` with admin roles, falls back to legacy `admins`
  table) → 7-day JWT with `roles`/`availablePortals`/`isMaster`.
- Member-login path can also grant admin access when roles qualify (shared JWT mirrored into admin
  session keys).
- Password reset: `POST /api/admin/request-password-reset`.

---

## Known gaps / follow-ups

- Dual permission enforcement (legacy path map + platform `requirePermission`) is a consolidation
  candidate; keep both in mind when adding routes.
- `programs` (top-level) vs `program` (class template) vs legacy `program_categories` alias — the
  naming is historically layered; verify which table a query targets.
