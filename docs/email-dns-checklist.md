# Email DNS & Authentication Checklist — Vortex Athletics

This is the **DNS / email-provider-console** work that application code cannot perform.
Run the diagnostic first:

```bash
cd backend
node scripts/check-email-domain-authentication.mjs vortexathletics.com --selector google
```

> DNS presence does **not** prove a sent message passed authentication. Confirm a real
> message's `Authentication-Results` header (see `email-monitoring-runbook.md`).

Root domain: `vortexathletics.com`. Transactional subdomain (recommended): `notify.vortexathletics.com`.
Marketing subdomain (future): `news.vortexathletics.com`.

---

## 1. SPF (one TXT record per sending domain)

- [ ] Exactly **one** `v=spf1` TXT record on the sending domain.
- [ ] Authorizes every legitimate sender. While sending via Google Workspace SMTP:
      `v=spf1 include:_spf.google.com ~all`
- [ ] If/when a transactional ESP is added, include its mechanism too (e.g. Postmark
      `include:spf.mtasv.net`, SES `include:amazonses.com`, SendGrid `include:sendgrid.net`).
- [ ] Stay within the **10 DNS-lookup** limit. Flatten or consolidate if near the limit.
- [ ] Do not overwrite unrelated legitimate senders already present.
- [ ] End with `~all` (softfail) initially, tightening to `-all` once confident.

## 2. DKIM (2048-bit, aligned to the From domain)

- [ ] Google Workspace: generate DKIM in Admin console → Apps → Google Workspace → Gmail →
      Authenticate email; publish the `google._domainkey` TXT record; **turn on signing**.
- [ ] Use a **2048-bit** key where DNS supports the record length.
- [ ] The DKIM `d=` domain must **align** with the visible From domain
      (`vortexathletics.com`). It does when From is `@vortexathletics.com`.
- [ ] If using an ESP later, publish its selector(s) too (e.g. `pm._domainkey`,
      CNAMEs for SES/SendGrid) on `notify.vortexathletics.com`.
- [ ] Rotate keys per provider guidance.

## 3. DMARC (staged rollout)

- [ ] Publish at `_dmarc.vortexathletics.com`. Start monitoring-only:
      `v=DMARC1; p=none; rua=mailto:dmarc@vortexathletics.com; fo=1; adkim=s; aspf=s`
- [ ] Point `rua=` at a monitored mailbox or a DMARC reporting service.
- [ ] Watch aggregate reports until **SPF or DKIM aligns and passes** for all legitimate mail.
- [ ] Then move `p=none` → `p=quarantine` → `p=reject`. Do **not** weaken an existing
      `quarantine`/`reject`.
- [ ] Target alignment for **both** SPF and DKIM where possible (DKIM alignment is the
      reliable one when sending via Google SMTP, since the envelope/Return-Path is Google's).

## 4. Return-Path / MAIL FROM

- [ ] Google SMTP does not allow a custom Return-Path — the envelope domain is Google's.
- [ ] When a transactional ESP is configured, set a **custom Return-Path / MAIL FROM** on
      `notify.vortexathletics.com` so SPF aligns with the From domain.

## 5. Subdomain delegation (ESP migration)

- [ ] Create `notify.vortexathletics.com` (transactional) at the ESP; publish the
      ESP-provided SPF include, DKIM CNAME/TXT, and Return-Path records.
- [ ] Keep marketing on a **separate** `news.vortexathletics.com` if/when campaigns launch.

## 6. Infrastructure sanity

- [ ] Outbound **TLS** enabled (STARTTLS on 587 — already true in code).
- [ ] Provider manages valid **forward + reverse DNS (PTR)** for sending IPs (true for
      Google/most ESPs).
- [ ] Every message has valid **Date** and **Message-ID** headers (Nodemailer adds these).
- [ ] Exactly one each of From, To, Subject, Date (Nodemailer enforces).
- [ ] Standard MIME `multipart/alternative` (text + HTML) — enforced by templates.

## 7. Reputation monitoring registration (volume-permitting)

- [ ] **Google Postmaster Tools** — add and verify `vortexathletics.com`.
- [ ] **Yahoo Complaint Feedback Loop (CFL)** — enroll the sending domain/IP.
- [ ] **Microsoft SNDS + JMRP** — where Vortex/ESP can obtain access.
- [ ] ESP bounce/complaint/suppression dashboards — confirm access.

## Environment variables (set in Render; never commit secrets)

| Var | Purpose | Example |
|---|---|---|
| `SMTP_HOST` / `SMTP_PORT` | SMTP transport | `smtp.gmail.com` / `587` |
| `SMTP_USER` / `SMTP_PASS` | App password (secret) | — |
| `SMTP_FROM` | Visible From | `Vortex Athletics <accounts@notify.vortexathletics.com>` |
| `EMAIL_REPLY_TO` | Monitored Reply-To (front desk) | `frontdesk@vortexathletics.com` |
| `VORTEX_ROOT_DOMAIN` | Root domain | `vortexathletics.com` |
| `EMAIL_TRANSACTIONAL_SUBDOMAIN` | Transactional subdomain | `notify` |
| `EMAIL_MARKETING_SUBDOMAIN` | Marketing subdomain | `news` |
| `EMAIL_BRAND_NAME` | Sender brand | `Vortex Athletics` |
| `DKIM_SELECTORS` | Diagnostic selectors (comma-sep) | `google` |
| `EMAIL_RESEND_COOLDOWN_SEC` | Manual resend cooldown | `120` |
| `EMAIL_DAILY_PER_ADDRESS_MAX` | Per-address daily cap | `5` |
| `EMAIL_MAX_REMINDERS` | Auto invite reminders | `2` |
| `EMAIL_REMINDER_INTERVAL_DAYS` | Days between reminders | `7` |
| `EMAIL_KILL_SWITCH` | Stop ALL sending | `false` |
| `EMAIL_KILL_SWITCH_<CATEGORY>` | Stop one category | `false` |
