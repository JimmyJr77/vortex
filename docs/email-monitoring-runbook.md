# Email Monitoring & Incident Runbook — Vortex Athletics

Covers how to verify authentication, investigate delivery issues, read the local delivery
log, and respond to complaint/bounce spikes.

## Ownership

| Area | Owner |
|---|---|
| DNS records (SPF/DKIM/DMARC) | Domain/DNS admin (registrar / DNS host) |
| Email provider config (SMTP/ESP, streams, webhooks) | Backend / ops |
| App send logic, templates, suppression | Backend |
| Incident response (complaint/bounce spike) | Backend / ops on-call |

## Key metrics & goals

- **User-reported spam complaint rate:** keep **< 0.1%**. Treat movement toward **0.3%**
  as an **urgent incident**.
- Track by **stream** (transactional vs marketing), **sending domain**, **provider**,
  **recipient mailbox domain** (Gmail/Outlook/Yahoo/other), **template**, and rolling period.
- **Do not** use open rate as the primary deliverability metric. Open tracking does not
  prove inbox placement.
- For low-volume streams, do not over-react to a single complaint (mind the denominator),
  **but still suppress the complaining recipient immediately**.

## 1. Verify authentication on a real message

1. Send a test to a Gmail account you control.
2. Open the message → **Show original** (Gmail) / **View headers** (Outlook/Yahoo).
3. Confirm `Authentication-Results`:
   - `spf=pass`
   - `dkim=pass` with `header.d=vortexathletics.com` (alignment)
   - `dmarc=pass`
4. Confirm `Reply-To` is the front-desk address, a plain-text part exists, links use
   `www.vortexathletics.com` / `notify.vortexathletics.com`, and no child PII appears in the
   subject, preheader, URL, or headers.

Run the DNS-side check any time:

```bash
cd backend && node scripts/check-email-domain-authentication.mjs vortexathletics.com --selector google
```

## 2. Read the local delivery log

The `email_delivery` table records one row per send (category, stream, recipient **domain**
and **hash** — never full address, provider message id, status, smtp code). Useful queries:

```sql
-- Recent failures/bounces by mailbox domain (last 7 days)
SELECT recipient_domain, status, count(*)
FROM email_delivery
WHERE created_at > now() - interval '7 days' AND status IN ('bounced','failed','complaint','suppressed')
GROUP BY 1,2 ORDER BY 3 DESC;

-- Volume by category/stream
SELECT stream, category, count(*) FROM email_delivery
WHERE created_at > now() - interval '24 hours' GROUP BY 1,2 ORDER BY 3 DESC;
```

Suppressed addresses live in `email_suppression` (`scope` = global vs marketing, `reason`,
`source`). A `global` suppression blocks all mail; a `marketing` suppression must **not**
block account-security mail.

## 3. Distinguish bounce / deferral / complaint / spam-folder

- **Hard bounce (5xx):** permanent (no such user, blocked). App suppresses globally and
  stops reminders. Never auto-retry.
- **Soft bounce / deferral (4xx):** temporary (greylisting, full mailbox, rate). Retry with
  backoff; reduce volume if widespread.
- **Complaint:** recipient hit "Report spam" (only visible via ESP FBL/webhook). Suppress
  immediately; never auto-resend.
- **Spam-folder placement:** the message was *accepted* but filtered to Junk. Not a bounce;
  detectable only via seed tests / Postmaster Tools, **not** from SMTP acceptance.

> "Accepted by the recipient's email server" ≠ "Delivered to inbox." Never label an ESP
> `delivered` event as "Delivered to inbox" in staff UI.

## 4. Complaint-rate or bounce-rate spike — response

1. Check `email_delivery` for which **category/template/mailbox domain** spiked.
2. If a single template/category: pause it via `EMAIL_KILL_SWITCH_<CATEGORY>=true` and redeploy.
3. If broad: set `EMAIL_KILL_SWITCH=true` to stop all sending, then investigate.
4. Confirm authentication still passes (§1). A sudden DKIM/DMARC failure (e.g. rotated key)
   commonly causes spam placement.
5. Verify no bug is generating duplicate/bursty sends (check idempotency + cooldown logs).
6. Resume gradually once root cause is fixed.

## 5. Reduce volume safely when providers defer

- Lower `EMAIL_PER_TENANT_HOURLY_MAX` and `EMAIL_DAILY_PER_ADDRESS_MAX`.
- Pause non-essential categories (welcome, family-added) before security categories.
- Keep a **consistent** rate; avoid bursts. Do not retry hard bounces.

## 6. Verify transactional vs marketing stay separated

- All current sends are transactional. There is **no** marketing sender today.
- `sendEmail()` refuses to attach `List-Unsubscribe` one-click headers to transactional
  categories, and refuses to send a marketing category without one — so misclassification
  fails loudly. Confirm with the unit tests (`npm test`).
- When marketing launches, it must use `news.vortexathletics.com` + its own DKIM/stream so a
  marketing reputation problem cannot harm transactional delivery.
