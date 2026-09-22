# Registration & Enrollment Review — September 2026

Scope: every path by which a person gets an account, adds children, or gets enrolled in a class.
This is a read-only review; no code was changed. Line numbers are as of commit `92fa717`.

| # | Path | Entry point | Backend |
|---|------|-------------|---------|
| A | Public family self-signup wizard | `/signup/family` → `src/components/signup/FamilySignupWizard.tsx` | `backend/platform/familySignup.js` (`POST /api/signup/family`) |
| B | Teen-initiated signup + parent invite | Wizard "minor start" → `/signup/invite` (`SignupInvitePage.tsx`) | `familySignup.js` (`/api/signup/minor-start`, `/api/signup/invite/:token/*`), `backend/email/accountInviteTokens.js` |
| C | Public class enrollment | `/enroll` → `PublicClassesOfferedEnroll.tsx`, `SchedulingSignupEmbed.tsx` | `backend/scheduling/handlers.js` (`/api/scheduling/*`) |
| D | Member portal: add child / enroll / waivers | `MemberDashboard.tsx`, `FamilyMemberModal.tsx`, `member/MemberClassesOfferedEnroll.tsx` | `server.js` `/api/members/*`, `handlers.js` `createSignupBatch` |
| E | Drop-ins | `/drop-in` → `DropInPage.tsx` | `backend/scheduling/dropIns.js` |
| F | Admin-assisted signup | Admin members / signups screens | `/api/admin/signup/family`, `handlers.js` `adminCreateSignup` etc. |
| G | Login / activation | `Login.tsx`, `VerifyEmailPage.tsx`, magic link | `server.js` `/api/members/login`, `/api/verify-email`, `signupAuth.js` |
| H | Inquiry forms (legacy "registrations") | `ContactForm.tsx`, `SummerCampInquiryForm.tsx` | `server.js` `POST /api/registrations` |

Legend: **CONFIRMED** = code path traced end to end (items marked ✔ were additionally re-verified by hand). **POSSIBLE** = depends on data/deploy conditions or a product decision.

---

## Summary — fix these first

| Pri | Issue | Path | Severity |
|-----|-------|------|----------|
| 1 | Scheduling-signup JWT is accepted as a full member-portal (and admin) session → household payer can impersonate another adult ✔ | C/D/G | **Critical** |
| 2 | `scheduling.manage`-only staff can set any member's login password (incl. owner/admin) and it overwrites login email/username ✔ | F | **High** |
| 3 | Family-signup wizard enrollments bypass capacity, waitlist, slot validation and billing; always "confirmed" ✔ | A/B/F | **High** |
| 4 | Wizard can show a "confirmed" enrollment that was never written to the DB ✔ | A | **High** |
| 5 | Class capacity race: two concurrent signups can both take the last seat ✔ | C/D/F | **High** |
| 6 | Legacy `POST /api/scheduling/signups` still public: no payer check, no duplicate check, no charges ✔ | C | **High** |
| 7 | Stub members (no family) get confirmed seats that are never billed (public password path and admin create) ✔ | C/F | **High** |
| 8 | Public `order-preview` / `check-email` leak household names, class schedules, balances by email | C | **High** |
| 9 | Drop-in identity confuses `app_user.id` with `member.id` → can book/charge another family ✔ | E | **High** |
| 10 | Member-portal cart spanning two programs is paid via Stripe then fails to commit | D | **High** |
| 11 | Portal enrollment skips waivers / required fields — new child can be enrolled with no waiver | D | **High** |
| 12 | Unauthenticated bcrypt table scans (invites, email verification, receipts) → CPU DoS; verification links silently break after 100 pending tokens ✔ | A/B/G | **High** |
| 13 | Teen can complete the "parent" side of their own invite and become their own legal guardian | B | **High** |
| 14 | Legacy `member.password_hash` still accepted after password reset | G | High (POSSIBLE) |

---

## 1. Authentication & account security

### 1.1 CRITICAL — Scheduling signup token works as a member-portal/admin session ✔
- `backend/scheduling/signupAuth.js:73-95` signs `{type:'scheduling_signup', memberId, ...}` with the **same** JWT secret as portal logins.
- `backend/platform/accessContext.js:105-124` `resolveCanonicalTokenUserId` maps any token with a `memberId` claim to `member.app_user_id` and never checks `decoded.type`. Both `authenticateMember` (`server.js:2511`) and `createCanonicalAdminAuth` (`platform/canonicalAdminAuth.js`) use it.
- `authMemberSession` (`handlers.js:2372-2430`) lets a logged-in payer pick any `targetMemberId` in their household and issues a signup token with `memberId = target`.
- **Scenario:** payer calls `/api/scheduling/auth/member-session` with `targetMemberId` = spouse/adult child who has their own login (or a staff member linked into the household), then sends the returned token as `Bearer` to `/api/members/*` (or `/api/admin/*`) and acts as that person for 30 minutes.
- **Fix:**
  1. In `resolveCanonicalTokenUserId` reject any token whose `type` is set (or specifically `scheduling_signup`).
  2. Add an explicit `type: 'member_session'` / `aud` claim to the login JWT (`server.js:~7614-7637`) and require it in both middlewares.
  3. Sign scheduling tokens with a separate secret or `audience`.
  4. `dropIns.js resolveMember` has the same "any JWT is fine" problem (see 5.1).

### 1.2 HIGH — `scheduling.manage` can reset any password, including staff ✔
- `PATCH /api/admin/scheduling/signups/:id/member-password` — the permission regex at `server.js:2581` (`/\/scheduling\/signups\/\d+$/`) doesn't match the `/member-password` suffix, so it falls through to `scheduling.manage` (`server.js:2600`).
- Handler → `updateMemberPassword` → `syncAppUser` (`members/createMemberStub.js:73-99`), which has no staff-identity guard (unlike `syncMemberPortalIdentity`, `server.js:~2003`) and also rewrites `app_user.email/username/full_name` from the member row. A NULL member email/username can lock the user out; a different one silently changes the login email.
- Temp password is emailed to `responses.email || signup.email` — client-controlled at signup time (`handlers.js:2498-2504` spreads `...responses` last), so it can go to the wrong person. The password is changed before the email is sent.
- **Fix:** require `members.edit` (add the route to the `['members.edit','scheduling.manage']` rule); refuse targets with staff roles; make the existing-login branch of `syncAppUser` update only `password_hash`; send to the DB login email; raise minimum length to 8.
- Related: `adminCreateSignup` can create a login (`handlers.js:~4243`) with only `scheduling.manage`, while `/api/admin/signup/family` requires `members.edit`. Check `members.edit` in the handler when a new member/login is created.

### 1.3 HIGH — Unauthenticated bcrypt scans (DoS + broken links) ✔
- `findAccountInviteByToken` (`email/accountInviteTokens.js:57-85`) runs `bcrypt.compare` against **every** invite row (unused, then used), no limit, on each `/invite/:token/verify` and `/complete`. `SignupInvitePage.tsx:107-111` calls `/verify` twice.
- `/api/verify-email/:token` (`server.js:~2716-2728`) compares against up to 100 unused tokens; once >100 unexpired tokens exist site-wide, older valid links report "invalid or expired".
- `verifyEnrollmentReceiptToken` (`email/enrollmentReceiptService.js:16-29`) — same pattern, 100 newest of 90-day tokens.
- `/api/signup/minor-start` is public and inserts a new invite row per call, so an attacker can grow the scan table cheaply.
- **Fix:** tokens are 32 random bytes — store `sha256(token)` in a unique indexed column (or use `selector.verifier` tokens) and look up directly with `timingSafeEqual`. Add strict per-IP limiters to these endpoints.

### 1.4 HIGH (POSSIBLE) — Legacy `member.password_hash` survives password reset
- `verifyMemberPassword` (`signupAuth.js:153-165`) accepts `member.password_hash` before the `app_user` hash. `resetMemberPasswordByEmail` (`auth/memberPasswordReset.js:62-72`) and `/api/members/change-password` (`server.js:~7775`) never null it.
- **Scenario:** a compromised password is reset, but the old one still works on `/api/scheduling/auth/login` (and, via 1.1, yields a portal session).
- **Fix:** one-off `UPDATE member SET password_hash = NULL WHERE app_user_id IS NOT NULL`; remove the member-hash branch.

### 1.5 MEDIUM — Enumeration, PII leaks and missing rate limits
- `checkEmail` (`handlers.js:1672-1692`) returns `exists`, `hasPassword`, `firstName`, `lastName`, `profileComplete` for any email.
- `previewSignupOrder` (`handlers.js:2137-2195`) with just an `email` returns `memberId`, `familyId`, every household member's name + class/day/time (`orderPricing.js:1291-1318`), carried-forward balance and passes. **A stranger can learn where and when someone's children train.** Also `listMemberSignedUpForms` and `getProgramSignupOptions?email=`.
- `authLogin` distinguishes "No account found" vs "Incorrect password" (`handlers.js:2205-2211`).
- Login, magic-link, check-email, verify-token, minor-start, drop-in register and `/api/registrations` only have the global 1000 req/15 min limiter (`server.js:329-335`). Magic links can be used to email-bomb.
- **Fix:** require the signup token for any member-specific preview/list; drop names from `checkEmail`; single generic auth error; dedicated per-IP + per-email limiters (e.g. 10/15 min) and CAPTCHA on public creation endpoints.

### 1.6 MEDIUM — Password reset immediately replaces the password
`memberPasswordReset.js:62-72` overwrites the hash with a temp password on an unauthenticated request. Anyone who knows an email can keep locking the member out. **Fix:** issue a short-lived reset token; keep the old password valid until the reset is completed.

### 1.7 MEDIUM — Email verification is not meaningful
- `/api/verify-email` runs `BEGIN/COMMIT` via `pool.query` (different pooled clients — not a transaction).
- Update does not check the token email equals the current account email.
- `PUT /api/members/me` (`server.js:8050`) changes `app_user.email` without resetting `email_verified`, validating format, or re-auth.
- Nothing is gated on `email_verified`.
- **Fix:** use `pool.connect()`; bind verification to the email; reset the flag on change; decide what verified status should gate (at minimum, magic links and invites).

### 1.8 HIGH (functional) — Magic link does nothing for logged-out users
`magicLinkEmail.js:17` builds `/enroll?form=..&auth=..` with no `email`; `SchedulingSignupEmbed.tsx:643` returns early without `initialEmail` (falls back to `localStorage`). Clicking the link on another device silently does nothing. The handler also ignores `sendMagicLinkEmail`'s `{sent:false}` (`handlers.js:2318`). **Fix:** include the email (or look the token up by id), show an error when `auth` is present but unusable, surface send failures. Also avoid tokens in URLs long-term (history/Referer).

### 1.9 LOW
- Password minimum is 6 in scheduling/admin paths (`handlers.js:1282,1317,1420-1435`, `AdminSignupPasswordResetModal.tsx:51`, `SchedulingSignupEmbed.tsx:1022`) but 8 in family signup/portal. Unify at ≥8.
- `must_change_password` is a UI hint only; `authenticateMember` never enforces it.
- Scheduling `authLogin`/`authMagicLink` don't check `member_portal_access_active` (password reset does).
- JWTs last 30 days with no revocation (`token_version` / `password_changed_at`).
- `findMemberByEmail` uses `LIMIT 1` with no deterministic tie-breaker when multiple members share an email.
- Minors can get logins via `portalAccessRequested` (`familySignup.js:1250-1261`) and via `authChangePassword` → `syncAppUser`. Decide policy and enforce DOB check if adults-only.
- `accountInviteTokens.js:8` falls back to `'dev-insecure-jwt-secret'` (safe only because `server.js:151` throws in production).
- `VerifyEmailPage` shows "Verification failed" for an already-used link with no resend option.

---

## 2. Family self-signup wizard (`/signup/family`)

The basics work: adult 18+ required, minors get the payer as legal guardian, waivers recorded for signer + dependent minors, everything in one transaction, case-insensitive unique email/username indexes. Problems:

### 2.1 HIGH — Enrollments bypass the enrollment engine ✔
`applyEnrollmentRow` (`familySignup.js:764-838`) inserts `scheduling_signup` with `status='confirmed'` directly from client IDs. Compared with `insertSignupForMember` (`handlers.js:191-269`) it does **not**:
- lock the slot group / enforce `max_participants` / waitlist,
- enforce `max_slots_per_user`,
- verify the slot group belongs to the form, or that form/slot/time-slot/offering are active,
- dedupe duplicate rows,
- store `pricing_option_key` (the wizard sends `selectedPricingOptionKey`, `FamilySignupWizard.tsx:1062`, server ignores it),
- create any charges or subscription (no `persistSignupCharges`).

The public endpoint needs no login, so anyone can overbook full classes for free. The invite `/complete` path does the same and lets the client body override the stored payload (`familySignup.js:~2038-2047`).

**Fix:** extract the body of `insertSignupForMember` into a shared function and call it from `applyEnrollmentRow` in the same transaction; validate form/slot/offering ownership; return the real `confirmed`/`waitlisted` status; reject bad rows with 400; run order preview + `persistSignupCharges` (or require Stripe checkout like `executeSignupBatch`).

### 2.2 HIGH — Phantom "confirmed" enrollment ✔
Class + start date selected but no schedule slot → `validateEnrollmentStep` (`Wizard:924-948`) passes → row sent with `slotGroupId: undefined` (`Wizard:1083-1090`) → server skips the insert (`familySignup.js:788`) but still returns `status:'confirmed', schedulingSignupId:null` → receipt email sent → user redirected as enrolled. Same result if the catalog fetch failed (failures are cached as empty, `Wizard:468-494`) or the enrolled member was removed in step 2 (`memberIndexMap.get` → undefined, `Wizard:1051`).
**Fix:** client requires ≥1 slot per class and checks `memberClientId` still exists; server throws on missing slot group or unmapped `memberIndex`; only return a receipt when a row was inserted; don't cache failed catalog loads.

### 2.3 MEDIUM
- **Adult family members enrolled without waivers.** `resolveSignupWaiverTargetMemberIds` (`familySignup.js:235-297`) intentionally excludes other adults, but the wizard lets them be enrolled with no warning. Send each additional adult a waiver link, or block/flag the enrollment.
- **Email format not validated** server-side (only non-empty, `familySignup.js:1115`); the wizard isn't a `<form>` so `type="email"` never fires. `bob@gmail` gets an account and the verification email is silently skipped (`:1480`).
- **Existing member without a login can't sign up** — `assertMemberEmailAvailable` rejects on `member` rows even with no login, telling them to "sign in" with credentials they don't have. Add a "claim account" email flow.
- **Duplicate email discovered only at final submit**, with the error at the top of a long waiver page. Add an availability check on step 1.

### 2.4 LOW
- Additional members' client-supplied `signupSource` is persisted (`...input` spread, `familySignup.js:1215 → 910`).
- Misleading messages: invalid DOB → "Minor must be under 18" (`:1809`); a child with blank DOB gets the "must have their own email" error before "DOB required" because `isAdult('')` returns true (`src/utils/dateUtils.ts:194`); future/1800 DOBs accepted; public users told to "ask an administrator to link the existing login" (`:948`); waiver error text references "I AGREE TO ALL OF THE ABOVE" while the checkbox says "SELECTED WAIVERS" (`waiverSigningUtils.ts:32` vs `WaiverSigningBlock.tsx:113`).
- `payment_policy_acknowledged` always stored false since the checkbox was removed (`WaiverSigningBlock.tsx:13-16`, `familySignup.js:456`).
- Client `isAdult` uses browser date; server uses facility timezone — near an 18th birthday they disagree, producing a server 400 the UI can't explain (same in `MemberDashboard.tsx:176`, `WaiversMembershipsPage.tsx:80`).
- Unauthenticated catalog endpoints return inactive/archived programs.

---

## 3. Teen-initiated signup & parent invite

### 3.1 HIGH — Teen can act as their own parent
When the invite email fails, `/minor-start` returns `inviteUrl` to the unauthenticated requester (`familySignup.js:1916`), and the wizard displays "Share this link" (`Wizard:1218`). `/invite/:token/complete` never checks `primaryAdult.email === invite.invitee_email` and the email field is editable (`SignupInvitePage.tsx:241`). The teen can enter fake adult details, gain legal-guardian authority over themselves (`:2005`) and "sign" their own waivers (`:2012`).
**Fix:** never return `inviteUrl` to the requester (give staff a resend button); lock/require the invitee email; withhold guardian authority until the email is verified.

### 3.2 MEDIUM
- **Invite completion race:** invite read outside the transaction without `FOR UPDATE` (`:1968`); `UPDATE account_invite SET used_at = now() WHERE id=$1` unconditional (`:2068`). Two concurrent completions create two payers. Use `... WHERE id=$1 AND used_at IS NULL RETURNING id` first inside the transaction. Same pattern in `verifyMagicToken` (`signupAuth.js:147`).
- **Invites never expire** (migration 043 made `expires_at` nullable; never checked). Set 14–30 days, refresh on reminder.
- **Existing-account parent can't accept** — completion always creates a new payer and fails `assertMemberEmailAvailable`. Add "log in to link this athlete" that attaches the minor to the authenticated adult's household.
- **`/minor-start` abuse:** unauthenticated; creates an active family, active member (no guardian) and invite, and emails any address (no format check) plus up to 4 reminders (`accountInviteReminderService.js`). Stores client enrollment objects wholesale in `pending_payload` (`:1873`), including `programName` that later appears in emails. No cleanup of `(Pending)` families / `minor_invite_pending` members. **Fix:** rate limit + CAPTCHA, validate email, keep the minor inactive until completion, whitelist payload fields, add a cleanup job.

### 3.3 LOW
- Family name keeps the `" (Pending)"` suffix after completion.
- If the minor turns 18 before completion, guardian authority is still granted but their waivers are silently not recorded.
- Guardians receive duplicate notification emails on completion (`:1466`, `:2072`).
- Invite success page has no login link/redirect (`SignupInvitePage.tsx:201-210`).

---

## 4. Class enrollment (public `/enroll` and member portal)

Payer authorization in the batch path, server-side pricing and parameterized SQL are well done. Problems:

### 4.1 HIGH — Capacity race ✔
`insertSignupForMember` (`handlers.js:221-237`) reads `COUNT(*)` in a subquery in the same `SELECT ... FOR UPDATE OF sg` statement. Under READ COMMITTED the count comes from the statement snapshot taken before the lock was granted, and the first transaction never updates the slot-group row, so the second never re-evaluates. Two simultaneous signups for the last seat both become `confirmed`.
**Fix:** lock first (`SELECT max_participants ... FOR UPDATE`), then run `COUNT(*)` as a separate statement; or maintain a `confirmed_count` on the slot group.

### 4.2 HIGH — Legacy single-signup endpoint ✔
`POST /api/scheduling/signups` → `createSignup` (`handlers.js:2448-2670`) is still registered publicly (`registerRoutes.js:39`) though no frontend calls it (`submitSchedulingSignup` in `src/utils/schedulingApi.ts:1228` is unused). It never calls `authorizeSignupBatchPayer`, never checks existing enrollment, never calls `persistSignupCharges`. A teen with their own login can take unpaid seats, repeatedly. **Fix:** remove the route (or make it a wrapper around `createSignupBatch`).

### 4.3 HIGH — Unbilled stub members ✔
The public batch `password` path (`handlers.js:2786-2797`) and `adminCreateSignup` (`:4240-4254`) create members via `createMemberStub` with `family_id NULL` and no household. `authorizeSignupBatchPayer` allows them as `unhoused_self`; `buildSignupOrderPreview` throws (swallowed at `:2894`); `persistSignupCharges` returns early (`persistSignupCharges.js:251`). Result: confirmed seat, no charge, no warning — 20 items × 20 batches / 15 min / IP can fill classes with fake accounts.
**Fix:** remove the password path from the public API (the UI already routes new users to `/signup/family`); make `createMemberStub` create a household + billing account, or refuse signups for members without one; fail the request when the preview fails.

### 4.4 HIGH — Multi-program portal cart paid then rejected
`MemberClassesOfferedEnroll.tsx:687-697` obtains one signup token for `firstFormId`, but the cart can mix programs. Preview and Stripe checkout (`stripeEnrollmentCheckout.js:91-110`) only validate the first form; after payment, `createSignupBatch` verifies every entry against that token (`handlers.js:2751-2761`) and throws "Invalid signup session". Card charged, enrollment fails. **Fix:** household-scoped (not form-scoped) tokens, or one token per program; at minimum reject mixed-program carts before checkout.

### 4.5 HIGH — Portal enrollment skips waivers and required fields
`validateSignupResponses` runs only on the password branch (`handlers.js:2769`); the member-session branch accepts `responses: {}`. Nothing in scheduling/billing checks `member_waiver_acceptance`. A child added moments ago with no waiver or medical info can be enrolled, and `admin_stub` isn't set so staff aren't alerted. **Fix:** require active required waivers for the target member in `createSignupBatch`/`commitPendingEnrollment`; validate required fields against member data or set `admin_stub=true`; add a "sign waivers first" step in the portal.

### 4.6 HIGH — Paid via Stripe, then refused on inactive form flag
Class listing (`listPublicClassesOffered.js:125-127`), `loadFormDetail` (`handlers.js:1036-1041`) and `familySignup.js:573-574` treat `scheduling_form.is_active=false` as not hiding an active class, but `createSignup` (`:2461`) and `resolveSignupEntryForInsert` (`:579-583`) reject it. The Stripe webhook's `executeSignupBatch` then fails after payment. **Fix:** one active-class rule, applied in all paths.

### 4.7 MEDIUM
- **Duplicate enrollment:** in-batch dedupe key uses `timeSlotId ?? null`, but null is later resolved to the first occurrence (`handlers.js:2694-2707` vs `603-606`), so both are inserted and charged. The "already signed up" check runs before locking, and there's no unique index. **Fix:** dedupe on resolved id; partial unique index `(member_id, slot_group_id, time_slot_id) WHERE orphaned_at IS NULL AND status IN ('confirmed','waitlisted')`; map 23505 → `ALREADY_SIGNED_UP`.
- **Waitlisted signups are charged** — preview doesn't know about capacity; `persistSignupCharges` gets waitlisted results too (`handlers.js:3050-3065`, assumption at `persistSignupCharges.js:365` is wrong). Bill on promotion instead; warn before Stripe checkout if the slot is full.
- **Start date not validated server-side** — only `min=today` in `EnrollmentStartDateField.tsx:38`; stale localStorage carts / URL param can submit past dates → proration ratio 0 → $0 first month (`firstMonthProration.js:132-141`). Reject past dates (facility TZ) and dates past `activeEnd`.
- **No server-side age range enforcement** — `age_min/age_max` are display-only. Check the athlete's DOB as of start date in `resolveSignupEntryForInsert`.
- **Promo redemption & `max_slots` races** — limits read outside the transaction, redemptions written after commit with errors swallowed (`discountEngine.js:1379-1430`). Write inside the transaction with `FOR UPDATE` on `discount_rule`; lock member/billing account before `max_slots`.
- **Post-commit work inside the same try/catch** (`handlers.js:3140-3155`, `2649-2661`): a failure after COMMIT issues ROLLBACK (no-op) and returns 500 even though the enrollment exists; a retry then says "already signed up". Charge-write errors are only `console.warn`, including `WeeklyTierSlotLimitError` from the preview (bypassable weekly cap). Move charges into the transaction or a retrying outbox; surface warnings.
- **Signed-in responses overwrite identity** — `...responses` is spread after member fields, so client can change `first_name/last_name/email` on the signup (receipt/waiver email recipient). Whitelist keys / spread member fields last. The embed says a waiver email was sent even when `parent_email` is empty (`SchedulingSignupEmbed.tsx:1370-1374`).

### 4.8 LOW
- `filterSlotRowsByVisibility` uses UTC date (`handlers.js:852`) vs local date in proration — evening US signups on a slot's last day fail.
- Mixed pricing options in the same scope fall back to base price (`orderPricing.js:1036`).
- `persistSignupCharges` uses legacy `member.family_id`; payer auth uses canonical `family_member` — can charge the wrong/no account.
- `getProgramSignupOptions` lists sibling classes without checking form active.
- Receipt pricing from `computeMonthlyPricing` (`handlers.js:280-285`) can differ from the discounted/prorated actual charge.
- `handleSubmit` in `SchedulingSignupEmbed.tsx:1319-1326` doesn't guard `submitting` (Enter key double-submit).
- POSSIBLE: `/signups/batch` never enforces Stripe when an amount is due — a direct API call can put charges on account instead. Decide policy and enforce server-side.

---

## 5. Drop-ins (`/drop-in`)

### 5.1 HIGH — Identity confusion ✔
`dropIns.js:201-215` `resolveMember` takes `decoded.userId` (an `app_user.id`) and runs `SELECT * FROM member WHERE id = $1 OR app_user_id = $1 ORDER BY (id = $1) DESC`. If any member's `id` equals the caller's `app_user.id`, that unrelated member is chosen: the page shows their credits/trial, and booking consumes their credits and posts a charge to their family (`:781`). It also accepts any JWT (signup/admin tokens) and never checks active/portal access.
**Fix:** use `resolveCanonicalTokenUserId` + `loadCanonicalAccessContext` like `authenticateMember`; resolve athletes through the canonical household (`family_member`) with a household picker sending `memberId`, not free-text name matching.

### 5.2 MEDIUM
- Page shows prices/benefits for the logged-in parent, but the register route recomputes for the athlete matched by name (`dropIns.js:643,670`) — displayed "$0 / free trial" ≠ actual charge. Pick athlete first, then price.
- Anonymous `account_required` holds count toward capacity for 1 hour (`:707`) with only global rate limiting — scripts can fill classes; 409 at `:650-660` reveals account existence. Strict limiter + CAPTCHA; don't count unverified holds.

### 5.3 LOW
- `UNIQUE (member_id, slot_group_id, class_date)` (`:358`) includes cancelled rows → can't rebook a cancelled date. Use a partial index `WHERE status <> 'cancelled'`.
- Billing lookup `family_billing_account WHERE family_id=$1 LIMIT 1` (`:781`) has no `is_active` filter and uses legacy `member.family_id`.
- Any household login (e.g. a teen) can charge paid drop-ins to the family account; class enrollment requires the payer. Align policy.

---

## 6. Member portal — adding & editing children

Ownership (IDOR) checks on `/api/members/family/:id` and cancellation are solid. Problems:

- **MEDIUM — Profile can never be completed.** `isMemberProfileComplete` (`members/profileComplete.js`) needs phone, gender, DOB, medical concerns, injury history; `PUT /api/members/me` and `/family/:id` accept only name/email/phone/address, and the modal (`MemberDashboard.tsx:3320-3430`) offers only those. The banner (`:2049`) tells members to add medical info "in your profile below". DOB typos can't be fixed either. Add a validated personal/medical section or change the banner copy.
- **MEDIUM — Duplicate children.** `createPortalFamilyMember` (`familySignup.js:989-1038`) has no name+DOB duplicate check within the household or facility. Resubmits or a co-parent in another household create a second identity, splitting waivers/benefits/trial. Return 409 in-household; route cross-household matches to staff.
- **MEDIUM — Child email hijack.** `PUT /api/members/family/:id` only checks email conflicts when the child has a login (`server.js:8508`); any email (no format check) can be set on an unlinked child, blocking the real owner's future signup and possibly redirecting magic links via `findMemberByEmail`. Call `assertMemberEmailAvailable` and validate format.
- **LOW:** `POST /api/members/family` returns any `error.message` as 400 (`server.js:8374-8386`), leaking DB errors; cancel route returns raw "duplicate key" text. `mark-for-removal` is dead code after a 410 and there's no portal flow for removing a member. Possible DOB off-by-one: `dateOnlyAge.js:13-20` uses `getUTC*` but node-pg returns DATE as local midnight and no `setTypeParser(1082)` is set — on a server TZ east of UTC, DOB shifts a day. Fix with `types.setTypeParser(1082, v => v)`.

---

## 7. Admin-assisted registration

Much legacy admin code already returns 410; admin account creation goes only through `/api/admin/signup/family`, which is transactional and permission-checked. Problems:

- **HIGH — Deleting a member leaves ghost enrollments and live billing.** `server.js:7300-7389` relies on FKs; `scheduling_signup.member_id` is `ON DELETE SET NULL` (`initTables.js:272`) so signups stay `confirmed`, keep counting against capacity, subscriptions keep running, and `payer_member_id` becomes NULL. Run the archive preflight, cancel signups/subscriptions and promote waitlists in the transaction, map 23503 to a clear 409.
- **MEDIUM — Status changes:** `updateSignupStatus` (`handlers.js:4555+`) lets an orphaned signup be set `confirmed` (restarting billing via `safeReactivateSubscriptionForSource`); `waitlisted/paused → confirmed` skips capacity. Promotions (here, `waitlist.js:80`, and `adminDeleteEnrollment` at `handlers.js:2109-2118`, which promotes *before* deleting and without a lock) create no charges.
- **MEDIUM — Re-enroll orphaned signup** (`handlers.js:5139-5306`) creates no billing, and when `member_id` is NULL falls back to `findMemberByEmail(responses.email)` — for children signed up via the wizard that's the **parent's** email, so the parent gets enrolled.
- **MEDIUM — Deleting the last time slot fails** (`deleteTimeSlot`, `handlers.js:4074-4145`): the slot is deleted before signups are orphaned, hitting the FK; no transaction. `deleteTopProgramCascade` hard-deletes signups with no orphan snapshot or subscription cancellation.
- **MEDIUM — Admin wizard "existing family" mode** requires creating a new 18+ primary adult with a login just to add a child; the billing account isn't updated; the family lookup (`familySignup.js:1166`) lacks a `facility_id` filter (trigger mitigates). Add an admin "add dependents to household" path.
- **MEDIUM — Waiver audit trail:** admin-mode acceptances record `accepted_by_member_id = payer` with the admin's IP/UA (`familySignup.js:1778-1783`). Record `recorded_by_admin` or email waivers to the adult.
- **LOW:** `member_facility_email_unique` is case-sensitive (`migrations/005:55`) and `PUT /api/admin/members/:id` doesn't check email availability; `PUT .../parent-guardians` accepts `[]` for a minor and doesn't require guardians be active/same family; `/registrations` and `/newsletter` admin routes need no specific permission (`legacyAdminPermissionFor` returns null); `normalizeAdminEnrollmentStatus` maps unknown statuses to "active".

---

## 8. Inquiry forms — `POST /api/registrations`

Still used by `ContactForm.tsx:202` and `SummerCampInquiryForm.tsx:165`. Joi validation is good, but:
- Duplicate check `WHERE email = $1` (`server.js:3114`) is case-sensitive, and a repeat inquiry gets 409, which both frontends show as success — **the second inquiry's message/campers are silently discarded.** Always insert (or append), compare with `LOWER()`.
- 409 reveals prior inquiries; no dedicated limiter/honeypot; a public request can trigger `ALTER TABLE` on the error path (`:3200+`).

---

## Suggested remediation plan

1. **Security hotfix (days):** 1.1 token-type check; 1.2 permission regex + `syncAppUser`; 5.1 drop-in identity; remove legacy `POST /api/scheduling/signups` and the public password path; lock down `order-preview`/`check-email`; add rate limiters.
2. **One enrollment engine:** make every path (wizard, invite, public batch, portal, admin, re-enroll, waitlist promotion) call a single `enrollMember()` that does validation → lock → capacity/waitlist → dedupe (unique index) → waiver/age/start-date checks → pricing preview → charges in-transaction. This fixes 2.1, 2.2, 4.1, 4.3, 4.5, 4.7 and most of §7 at once.
3. **Token storage:** move invites, email verification, receipts and magic links to hashed-lookup tokens with expiry and atomic single-use.
4. **Invite flow:** lock invitee email, "link to existing account", never expose invite URL.
5. **UX/data cleanup:** profile completion fields, duplicate-child detection, unified password policy, client/server age date alignment, error message fixes, and the smaller LOW items.

### Tests worth adding
- Concurrent last-seat signups → exactly one confirmed.
- Scheduling signup token rejected by `/api/members/me` and `/api/admin/*`.
- Wizard submit with class but no slot → 400, no receipt.
- Portal cart across two programs → rejected before checkout (or succeeds end-to-end).
- Enrollment of a member with no signed required waiver → rejected.
- Drop-in with `app_user.id` colliding with an unrelated `member.id` → resolves to caller.
- `scheduling.manage`-only admin → 403 on `/member-password`.
