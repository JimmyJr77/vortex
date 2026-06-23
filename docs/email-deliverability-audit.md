# Email Deliverability Audit — Vortex Athletics

_Last updated: 2026-06-23. This document describes the email system as found in the
repository and the changes made in code to improve inbox placement. It contains no
secrets (no SMTP passwords, API keys, or raw tokens)._

## ⚠️ Verified root cause (live DNS diagnostic, 2026-06-23)

Running `scripts/check-email-domain-authentication.mjs vortexathletics.com --selector google`
against live DNS found:

| Record | Result |
|---|---|
| **SPF** | ✅ Present and correct: `v=spf1 include:_spf.google.com ~all` |
| **DKIM** (`google._domainkey.vortexathletics.com`) | ❌ **MISSING** — Google Workspace DKIM is not published/enabled |
| **DMARC** (`_dmarc.vortexathletics.com`) | ❌ **MISSING** — no policy at all |

**This is the primary reason parent mail lands in spam.** With no published DKIM key,
messages are not DKIM-signed for `vortexathletics.com`, so **DKIM does not align** with the
From domain; and with **no DMARC** record, Gmail/Yahoo (under the 2024+ bulk-sender
requirements) treat the domain as unauthenticated and filter aggressively. SPF alone is not
enough because the Google SMTP envelope/Return-Path is Google's domain, so SPF does not
align with `vortexathletics.com` either.

**Fix (DNS / Google Admin console — cannot be done in code):**
1. Google Admin → Apps → Google Workspace → Gmail → **Authenticate email** → generate a
   **2048-bit** DKIM key, publish the `google._domainkey` TXT record, and **start signing**.
2. Publish DMARC at `_dmarc.vortexathletics.com`, starting at
   `v=DMARC1; p=none; rua=mailto:dmarc@vortexathletics.com; adkim=s; aspf=s; fo=1`.
3. Re-run the diagnostic until DKIM + DMARC pass, then stage DMARC toward `quarantine`/`reject`.

Everything below (code-level classification, sender identity, suppression, policy) reduces
complaints and protects reputation, but **the DKIM + DMARC DNS fix is the highest-impact
action** and is required first.

---

## 0. TL;DR

- **Provider:** Google Workspace **SMTP** via Nodemailer (`smtp.gmail.com:587`). Not a
  transactional ESP.
- **Tenancy:** Effectively **single-tenant**. `resolveFacilityId()` always selects the
  first `facility` row ("Vortex Athletics"). There are no per-gym custom sending domains,
  so the plan's `"[Gym Name] via Vortex"` pattern maps to **"Vortex Athletics"** as the
  sender. Reply-To should be a monitored front-desk mailbox.
- **Marketing email:** **None is sent today.** All outbound mail is transactional.
  References to "newsletter"/"promo"/"marketing" in the codebase are discount **promo
  codes** and a newsletter **signup form**, not outbound campaigns.
- **Biggest deliverability levers** are **DNS authentication** (SPF/DKIM/DMARC alignment)
  and **moving transactional mail to a real ESP** that supports message streams,
  webhooks, and suppression. Those are **DNS/provider-console actions** — see
  `email-dns-checklist.md`. They cannot be done from application code.
- **What code can do (done in this change):** classify every email by purpose, enforce a
  trustworthy/validated sender identity and Reply-To, add transactional headers, normalize
  + typo-check recipient addresses, add a local suppression list + delivery log + send
  policy (cooldown / daily cap / reminder cap), and ship a DNS diagnostic + runbooks.

---

## 1. Current provider & configuration

| Item | Value found | Source |
|---|---|---|
| Transport | Nodemailer SMTP | `backend/email/sendEmail.js` |
| Host / port | `SMTP_HOST` (default `smtp.gmail.com`) / `SMTP_PORT` (default `587`, STARTTLS) | `sendEmail.js`, `env.example` |
| Auth | `SMTP_USER` + `SMTP_PASS` (Google **App Password**) | `env.example` |
| Visible From | `SMTP_FROM` → `resolveFromAddress()` wraps bare address as `Vortex Athletics <addr>` | `sendEmail.js` |
| Reply-To | `SMTP_REPLY_TO` if valid, else From address | `sendEmail.js` |
| Link domain | `publicAppUrl()` → `https://www.vortexathletics.com` (or non-localhost `PUBLIC_APP_URL`) | `publicAppUrl.js` |
| TLS | STARTTLS on 587 (or implicit TLS on 465) | `sendEmail.js` |
| Date / Message-ID | Added automatically by Nodemailer | nodemailer default |

**Implications of using Gmail/Workspace SMTP:**

- **DKIM** is Google's domain key (selector `google`, i.e. `google._domainkey.<domain>`),
  published when the domain is a Google Workspace domain. The DKIM `d=` aligns with the
  From domain **only if** the From address is on the Workspace domain (it is:
  `team@vortexathletics.com`). Good — but must be verified in DNS.
- **No custom Return-Path / MAIL FROM.** Gmail controls the envelope sender. SPF therefore
  authenticates Google's envelope domain, not `vortexathletics.com`. **DMARC then relies on
  DKIM alignment** (which is achievable) for a `pass`.
- **No webhooks** for bounce/complaint/deferral. Bounces return asynchronously to the
  mailbox; the app never learns about them programmatically.
- **No suppression API, no message streams, no FBL, no one-click unsubscribe service.**
- **Shared Google sending IPs** with reputation we do not control. Fine at low volume.

> **Recommendation (provider):** migrate **transactional** sending to a dedicated ESP
> (Postmark, Amazon SES, SendGrid, or Mailgun). The current provider lacks webhooks,
> suppression, and message streams that several plan sections require. See §6.

---

## 2. Sending domains & addresses

- Root domain: **`vortexathletics.com`**.
- From address today: **`team@vortexathletics.com`** (a human/shared mailbox).
- Recommended transactional identity:
  - From: `Vortex Athletics <accounts@notify.vortexathletics.com>`
  - Reply-To: a monitored front-desk address (e.g. `frontdesk@vortexathletics.com`).
- Recommended marketing identity (only if/when campaigns are introduced):
  - From: `Vortex Athletics <news@news.vortexathletics.com>`

Subdomain separation (`notify.` vs `news.`) protects transactional reputation from any
future marketing sends and is configured at the ESP + DNS, not in code.

---

## 3. Email categories that exist (code paths)

All are **transactional**. Templates already send `multipart/alternative` (text + HTML),
use HTTPS links, a single primary CTA, and no attachments.

| Category (new constant) | Template file | Trigger |
|---|---|---|
| `parent_account_invitation` | `email/accountInviteEmail.js` | Minor-initiated signup invites guardian |
| `parent_account_invitation` (reminder) | `email/accountInviteReminderService.js` | Weekly reminder (≤4) for unused invite |
| `parent_email_verification` | `email/verifyEmailEmail.js` | Confirm email on family signup / on demand |
| `parent_account_created` | `email/accountInviteEmail.js` (`sendInviteSignupCompleteEmail`) | Guardian finished invite signup |
| `account_welcome` | `email/welcomeMemberEmail.js` | New member added |
| `family_member_added` | `email/familyMemberAddedEmail.js` | Guardian alert that a member joined family |
| `registration_confirmation` | `email/enrollmentConfirmedEmail.js`, `email/enrollmentReceiptEmail.js`, `scheduling/confirmationEmail.js` | Enrollment / receipt |
| `password_reset` (temp password) | `scheduling/tempPasswordEmail.js` | Temporary password issued |
| `signin_magic_link` | `scheduling/magicLinkEmail.js` | Scheduling sign-in link (30 min) |
| `waiver_request` | `email/waiverRequestEmail.js`, `scheduling/waiverEmail.js` | Waiver needed |
| `schedule_change` | `scheduling/promotionEmail.js`, `demotionEmail.js`, `waitlistEmail.js` | Waitlist / slot changes |

The canonical category list and the transactional/marketing split now live in
`backend/email/emailCategories.js`.

---

## 4. Transactional vs marketing separation

- **Today:** there is only transactional traffic, so it is trivially "separated" — but
  there is **no enforced classification** and **no separate stream/subdomain**.
- **After this change:** every send is tagged with a category; `sendEmail()` validates the
  category and refuses to attach marketing-only headers (e.g. `List-Unsubscribe`
  one-click) to transactional categories, and vice-versa. Stream/subdomain separation
  still requires ESP + DNS configuration.

---

## 5. What is missing or risky

| Area | Finding | Severity | Fix location |
|---|---|---|---|
| SPF | Unverified from repo; Gmail envelope domain authenticated, not `vortexathletics.com` | High | DNS |
| DKIM alignment | Likely OK (Workspace `google` selector on From domain) but **unverified** | High | DNS / diagnostic script |
| DMARC | Unknown whether a policy is published | High | DNS |
| Return-Path | Not aligned (Gmail-controlled) | Medium | ESP migration |
| Bounce handling | **None** — app never learns of hard bounces | High | ESP webhooks (migration) + local suppression (done, partial) |
| Complaint handling | **None** | High | ESP webhooks (migration) |
| Suppression list | **None** | High | `email_suppression` table (done) |
| Delivery visibility for staff | **None** | Medium | `email_delivery` table + status wording (done, partial) |
| Reply-To | Falls back to From; not validated against a monitored mailbox | Medium | `sendEmail.js` (done) |
| Preheader text | Absent in all templates | Low | template helpers (done) |
| Verify-email copy | Still says "expires in 7 days" (matches code) but inconsistent footer/branding | Low | template (done) |
| Token logging | Invite/verify **URLs (with raw token) are logged** when SMTP is unconfigured | Medium | redaction (done) |
| Reminder cap | 4 automatic reminders (plan recommends 1–2) | Low | `emailPolicy.js` (configurable; default 2) |
| Send cooldown / daily cap | None | Medium | `emailPolicy.js` + send guard (done) |
| Email typo detection | None | Low | `emailAddress.js` (done) |
| Open/click tracking | None injected by Nodemailer (good) | — | n/a |
| Marketing unsubscribe | N/A today (no campaigns) | — | scaffolded for future (headers + endpoint helper + tests) |

---

## 6. Changes by access requirement

### 6a. Done in code (this change)
- `email/emailCategories.js` — category + stream classification, promo-content guardrails.
- `email/emailPolicy.js` — env-driven cooldown, daily cap, reminder cap, rate limits.
- `email/emailAddress.js` — normalize, validate, common-domain typo suggestion.
- `email/sendEmail.js` — validated sender identity + Reply-To, transactional headers
  (`Auto-Submitted`, `X-Auto-Response-Suppress`, `X-Entity-Ref-ID` idempotency,
  per-category `List-Unsubscribe` only for marketing), suppression check, delivery logging,
  token-safe logging.
- `email/emailDeliveryStore.js` + migration `044_email_deliverability.sql` —
  `email_suppression` and `email_delivery` tables.
- Template polish (preheader + consistent footer; verify-email copy).
- `scripts/check-email-domain-authentication.mjs` — SPF/DKIM/DMARC diagnostic.
- `docs/email-dns-checklist.md`, `docs/email-monitoring-runbook.md`.
- `email/__tests__/*` — unit tests (run with `npm test`, Node built-in test runner).

### 6b. Requires DNS access (registrar / DNS host)
- Publish/verify **SPF** (single TXT, within 10-lookup limit, includes Google +
  any new ESP).
- Verify **DKIM** record(s) for the active selector(s); 2048-bit where supported.
- Publish **DMARC** (`_dmarc.vortexathletics.com`) starting at `p=none` with `rua=`, then
  staged move to `quarantine`/`reject`.
- Add `notify.` (and later `news.`) subdomain records for the ESP.

### 6c. Requires email-provider console access
- Choose/configure transactional ESP, create **message streams** (transactional vs
  marketing), enable **signed webhooks** for bounce/complaint/deferral, configure
  **custom Return-Path / MAIL FROM**, and a **branded click-tracking domain** (or disable
  click tracking for account-security mail).
- Register **Google Postmaster Tools**, **Yahoo CFL**, **Microsoft SNDS/JMRP** where volume
  qualifies.

---

## 7. Assumptions that could not be verified from the repo

1. ~~The live DNS state is unknown~~ — **verified 2026-06-23**: SPF present; **DKIM and
   DMARC missing** (see top of doc). This is the confirmed root cause.
2. Whether `vortexathletics.com` is a full Google Workspace domain (needed for Google DKIM
   alignment) is assumed true based on `team@vortexathletics.com` usage and the working
   `include:_spf.google.com` SPF record.
3. Production env values for `SMTP_*` live in Render and were not read.
4. Sending volume is assumed **low** (single gym), so a **shared** ESP pool is recommended
   over a dedicated IP; no IP warmup needed yet.
5. There is currently no marketing/newsletter send job; the unsubscribe scaffolding is
   provided for future use and is intentionally **not** wired to transactional mail.
