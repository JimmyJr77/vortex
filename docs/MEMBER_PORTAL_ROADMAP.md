# Vortex Member Portal — Master Roadmap & Architecture

Canonical, durable record of the **Member portal** (the logged-in self-service experience
for parents/guardians and athletes). It captures what exists, how it's structured, and the
decisions worth preserving. Keep it current as the portal evolves (see the project rule
[.cursor/rules/member-portal-roadmap.mdc](../.cursor/rules/member-portal-roadmap.mdc)).

> Status legend: ✅ Complete · 🟡 In progress · ⬜ Planned

## Where we are today

- ✅ Multi-portal session + login (one JWT spans member/coach/admin where eligible).
- ✅ Dashboard with 7 tabs: Profile, Classes, Training, Progress, Events, Billing, Waivers.
- ✅ Family self-service (add/edit family members inline, guardian-gated).
- ✅ Billing statements + payment history; waiver acceptance.
- ✅ Coaching Corner athlete views (assignments, completion logging, progress, wellness).
- ✅ Light-theme modernization of profile + view/edit modals.
- 🟡 Known rough edges (see "Known gaps").

---

## Architecture & key decisions (and *why*, for posterity)

### Portal as a full-app swap (not a route)
The member portal is mounted by conditional rendering in [src/App.tsx](../src/App.tsx) based on
session state + `activePortal` (`website` / `admin` / `member` / `coach`) — not React Router.
**Why:** the portals are distinct top-level experiences with their own chrome; a conditional
swap keeps the public marketing site and the authed portals cleanly separated.

### One JWT, multiple portals (dual/triple access)
`POST /api/members/login` issues a single 30-day JWT. If the account has admin-capable roles,
`persistAdminSessionFromAccount` mirrors it into the admin session keys, and
`getAvailablePortals()` ([src/utils/portalSession.ts](../src/utils/portalSession.ts)) decides
which portal switches to show. **Why:** owners/coaches who are also parents use one credential;
`PortalNavButtons` switches portals without re-auth.

### Unified `member` table (legacy split retired)
A single `public.member` replaces the old `members` / `athlete` split. Login identity stays on
`app_user` (`password_hash` there), linked via `member.app_user_id`; enrollments live in
`member_program`. **Why:** one roster model for admin + member portals; see
`005_unified_member_table.sql` and `007_drop_all_legacy_member_tables.sql`.

### `family_member` is the canonical family link
Family membership is the `(family_id, member_id)` row in `public.family_member` (with
`relationship_label`, `is_active`) — **not** `family.primary_user_id` or `family_guardian`
(both dropped in `009_family_identity_cleanup.sql`). Billing payer is
`family_billing_account.payer_member_id`. **Why:** supports multi-guardian families and equal
member records with a clean billing payer.

### `parent_guardian_ids` for child guardians
Children carry guardian member IDs in a Postgres `BIGINT[]` (`006_simplified_family_system.sql`).
**Why:** fast guardian lookups for the common case without a join, while a relationship table
keeps richer authority metadata.

### Consolidated role model + derived member attributes
Roles collapsed to four (`MASTER_ADMIN`, `ADMIN`, `COACH`, `MEMBER_ATHLETE`) in
[032_role_model_consolidation.sql](../backend/migrations/032_role_model_consolidation.sql).
Every member-portal login is now a single `MEMBER_ATHLETE` role. **Why:** the legacy
`MEMBER` / `PARENT_GUARDIAN` / `ATHLETE` / `ATHLETE_VIEWER` roles overlapped and drifted
out of sync with actual access.

- **Youth (<18) vs Athlete (18+)** is derived from `member.date_of_birth` via `isAdult()`
  — not a role. Backend "adult only" gates (add/edit/remove family members) now use the
  `userIsAdult(userId)` helper ([backend/server.js](../backend/server.js)) instead of a
  `PARENT_GUARDIAN` role check. Accounts with unknown DOB are treated as adults so existing
  logins are never locked out.
- **Youth without login credentials** still receive the `MEMBER_ATHLETE` (Member / Athlete)
  label in admin as soon as a parent completes minor-invite signup or adds them via the portal
  ([ensureMemberAthleteAccount](../backend/platform/familySignup.js) → `app_user` +
  `app_user_role`, no password required).
- **Family Rep** is the family billing payer (`family_billing_account.payer_member_id`),
  surfaced as `is_family_rep`/`is_primary` and `athlete_type` (`youth`/`adult`) on the
  family-members API and rendered as a relationship badge in the dashboard.
- The default master account (`team.vortexathletics@gmail.com`, override via
  `DEFAULT_MASTER_EMAIL`) cannot be deleted, deactivated, or stripped of `MASTER_ADMIN`.

### Two auth middlewares (legacy vs platform)
- `authenticateMember` ([backend/server.js](../backend/server.js)) guards the monolith
  `/api/members/*` CRUD/enroll routes; sets `req.userId`/`req.memberId`.
- `authMiddleware` ([backend/platform/registerRoutes.js](../backend/platform/registerRoutes.js))
  guards billing/waivers and all `/api/member/training/*`; loads richer
  `req.platformAuth = { user (with member_id/family_id), roles, permissions }`.
  **Why:** newer platform routes need family/RBAC context the legacy routes predate. Future
  consolidation candidate — document which path a route uses before changing it.

### Temp-password reset (not magic link)
Forgot-password generates a random temp password, emails it, and sets
`member.must_change_password` (`add_member_must_change_password.sql`); the portal and scheduling
embed force a change afterward. **Why:** simpler ops flow than tokenized magic links.

### Classes tab = public catalog + authoritative enrollments
"Classes Offered" reads `GET /api/public/classes-offered` (the same pipeline as `/enroll`,
built from Admin Programs/Classes + Scheduling forms and enroll-site visibility). Current
enrollments come embedded in `GET /api/members/me` (`member_program`). **Why:** single source of
truth for what's marketed publicly; enrollments are authoritative from member records.

### Light-theme portal UI
Dashboard uses white content panels and light modals (`bg-white rounded-2xl`), with a dark brand
header. The profile's `UnifiedMember` shape mirrors the admin Members table. **Why:** consistent,
readable self-service UX aligned with the modernized admin pages.

### Training reuses the coach API client
Member training/progress uses `coachFetch` ([src/coach/api.ts](../src/coach/api.ts)) with the
same `vortex_member_token` against `/api/member/training/*`. **Why:** one JWT and shared auth
context; coach-assigned content surfaces to the athlete without a separate client.

---

## Frontend surface

Session keys: `localStorage.vortex_member_token` (JWT) + `vortex_member` (account snapshot).
Session helpers in [src/utils/portalSession.ts](../src/utils/portalSession.ts).

- **[src/components/MemberDashboard.tsx](../src/components/MemberDashboard.tsx)** — the shell.
  Tabs (`MemberTab`): `profile`, `classes`, `events`, `billing`, `waivers`, `training`,
  `progress`. Header uses `PortalNavButtons`.
  - **Profile**: `GET /api/members/me`; edit via `PUT /api/members/me` or
    `PUT /api/members/family/:id`; add via `POST /api/members/family`;
    `POST /api/members/change-password`. Family members + payment-history tables; guardian-gated
    add/edit (`isAdult()` checks `PARENT_GUARDIAN`).
  - **Classes**: enrollments from `/me`; catalog via `fetchClassesOffered()` →
    `GET /api/public/classes-offered?site=` rendered by the shared `ClassesOfferedList`. Toggle
    by family member / by class.
  - **Training / Progress**: delegate to `MemberTrainingTab` / `MemberProgressTab`.
  - **Events**: `GET /api/events` (public), filtered by enrollment tags.
  - **Billing**: `GET /api/members/billing/statements`, `…/payments`.
  - **Waivers**: `GET /api/members/waivers`, `POST /api/members/waivers/:templateId/accept`.
- **[src/components/MemberLogin.tsx](../src/components/MemberLogin.tsx)** — modal login:
  `POST /api/members/login`, `POST /api/members/request-password-reset`.
- **[src/components/MemberTraining.tsx](../src/components/MemberTraining.tsx)** —
  `MemberTrainingTab` (assignments + completion logging) and `MemberProgressTab` (assessment
  trends, skill grades, PRs, daily wellness check-in).
- **[src/components/PortalNavButtons.tsx](../src/components/PortalNavButtons.tsx)** — portal switcher.
- **[src/components/FamilyMemberModal.tsx](../src/components/FamilyMemberModal.tsx)** —
  ⚠️ legacy dark admin-oriented stub; **not** used by the member portal (family CRUD is inline).

---

## Backend surface

### Core member API ([backend/server.js](../backend/server.js), guard `authenticateMember`)
- Public: `POST /api/members/login`, `POST /api/members/request-password-reset`.
- Self: `POST /api/members/change-password`, `GET/PUT /api/members/me`.
- Family: `GET /api/members/family`, `POST /api/members/family` (adult-gated via DOB;
  auto-provisions a `family` + `family_member` + billing payer when the account has none yet),
  `PUT /api/members/family/:id` (adult-gated),
  `POST /api/members/family/:id/mark-for-removal`.
- Enrollment: `POST /api/members/enroll`, `DELETE /api/members/enroll/:id`,
  `GET /api/members/enrollments|programs|categories`,
  `GET /api/members/programs/:programId/iterations`. (Enrollment UX primarily lives on `/enroll`
  via `EnrollmentForm` / `SchedulingSignupEmbed`, not the dashboard.) `POST /api/members/enroll`
  sends a best-effort **enrollment receipt** email with a view-only verification link
  ([backend/email/enrollmentReceiptService.js](../backend/email/enrollmentReceiptService.js)) to the
  enrolled member's contact email (guardian fallback for minors); public page at `/registration/receipt`.
- **Transactional email coverage** (all signup/enrollment paths, best-effort via
  [backend/email/memberNotifications.js](../backend/email/memberNotifications.js)):
  - **Welcome** — each distinct contact email when a new member account is created (family signup,
    admin create, scheduling stub, portal add family member).
  - **Enrollment receipt** — one per enrollment row (`scheduling_signup` or `member_program`) with
    link to `/registration/receipt?token=…`.
  - **Guardian alert** — when a new member joins the family (portal add-family, admin create, or minor-invite parent completion); resolves guardian email from `member.email`, linked `app_user.email`, or billing payer email.
- Email verification: `POST /api/members/email/send-verification` (auth; issues a single-use link
  via [backend/email/emailVerificationService.js](../backend/email/emailVerificationService.js)) and
  the public confirm route `POST /api/verify-email/:token` (frontend page at `/verify-email`).
  Family signup auto-sends a verification email to the primary adult; the waiver-request email links
  members to the portal via `/?login=1`.

### Billing & waivers ([backend/platform/registerRoutes.js](../backend/platform/registerRoutes.js), guard `authMiddleware`)
- `GET /api/members/billing/statements`, `GET /api/members/billing/payments` (payer/
  `PARENT_GUARDIAN` sees all; athletes see only their own / none).
- `GET /api/members/waivers`, `POST /api/members/waivers/:templateId/accept`.

### Training ([backend/platform/coachPortalRoutes.js](../backend/platform/coachPortalRoutes.js), guard `auth`)
- `GET /api/member/training/assignments|workout/:id|program/:id|challenge/:id`
- `POST /api/member/training/log`
- `GET /api/member/training/progress`
- `POST/GET /api/member/training/wellness`

### Public endpoints consumed
- `GET /api/events`; `GET /api/public/classes-offered?site=`
  ([backend/programs/listPublicClassesOffered.js](../backend/programs/listPublicClassesOffered.js)).

---

## Data model (member-facing)

- **`public.member`** — unified person/athlete (`005`, `006`, `008`, `add_member_must_change_password`):
  `facility_id`, `family_id`, contact, `date_of_birth`, `status`
  (`legacy|enrolled|athlete|archived`), `app_user_id`, `parent_guardian_ids BIGINT[]`,
  `has_completed_waivers`, `must_change_password`, `is_active`.
- **`public.family`** (`003`; normalized in `006`/`009`) — `family_name`, `family_username`,
  `family_password_hash` (legacy `primary_*` / `family_guardian` dropped).
- **`public.family_member`** (`008`/`009`) — `(family_id, member_id)` PK, `relationship_label`,
  `is_active` — the sole family link.
- **`public.member_program`** (`005`) — enrollments: `member_id`, `program_id`, `iteration_id`,
  `days_per_week`, `selected_days JSONB`.
- **Billing** (`008`, `010`) — `family_billing_account` (`payer_member_id`), `billing_charge`,
  `billing_payment` (+ external/Stripe refs in `010`), `billing_statement`,
  `billing_statement_line`.
- **Waivers** (`008`) — `waiver_template`, `member_waiver_acceptance`.
- **Login identity** — `app_user` (`password_hash`, roles via `app_user_role`; `email_verified`/
  `email_verified_at` added in `040`).
- **Email verification** (`040`) — `email_verification_token` (single-use, bcrypt-hashed,
  `user_id` FK, `expires_at`/`used_at`).
- **Enrollment receipts** (`042`) — `enrollment_receipt_token` (view-only receipt links for class/program enrollments).
- **Coaching reads** — `coaching.plan_assignment`, `completion_log`, `assessment_result`,
  `athlete_skill_progress`, `personal_record`, `wellness_checkin` (see
  [COACHING_CORNER_ROADMAP.md](COACHING_CORNER_ROADMAP.md)).

---

## Known gaps / follow-ups

- `GET /api/members/me` does not return `mustChangePassword` (only login does) — the Profile
  flag can be lost on a hard refresh unless merged from `localStorage.vortex_member`.
- Profile "Payment History" only populates after the Billing tab has been visited (billing fetch
  is gated to the Billing tab).
- `FamilyMemberModal.tsx` is a deprecated admin-oriented stub, not part of the member flow.
- Two member auth middlewares (`authenticateMember` vs `authMiddleware`) — consolidation candidate.
- The dashboard does not call enroll/unenroll directly; enrollment lives on `/enroll`.
