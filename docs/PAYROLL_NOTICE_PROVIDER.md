# Payroll notice provider integration

## Current implementation

W-2 availability notices sent through `SMTP_HOST=smtp.sendgrid.net` now carry an opaque retained dispatch key in the SMTP `X-SMTPAPI` unique arguments. No employee identity, tax information or payment information is placed in that metadata. The delivery log identifies these sends as `smtp:sendgrid` and must retain the delivery before transmission. Other SMTP hosts and other categories retain their existing behavior.

`backend/payroll/w2NoticeProvider.js` verifies the exact timestamp-plus-body bytes with the provider's P-256 ECDSA public key before parsing a bounded JSON batch. It accepts PEM or base64 SPKI public keys, rejects malformed signatures/keys/batches and future timestamps, and preserves legitimate older signed payloads for subsequent durable event-ID deduplication. The public POST endpoint `/api/payroll/providers/sendgrid/events` reads the original bytes and requires these signed headers; no admin session is used for provider authentication. Configure `PAYROLL_SENDGRID_WEBHOOK_PUBLIC_KEY` with the provider public key. An absent or invalid key fails closed.

The implementation passes SendGrid's published single-event signature vector, including its trailing CRLF. Verification is followed by exact retained dispatch, recipient hash, facility, SendGrid provider, category, stream and template matching. Only bounce events advance the return workflow. Unknown events and unmatched notices are ignored. Event IDs support the padded values in the official reference. Immutable deduplication rejects changed evidence under an existing event ID and a conflicting provider message for the same attempt.

## Return reconciliation

Intake atomically retains minimal event metadata and marks the matched mail delivery bounced. Raw payloads, plaintext recipients and provider reason text are not retained. The original provider timestamp is kept; effective return time is bounded by exact retained attempt/delivery creation time to accommodate second-resolution events without losing database precision. Older events that predate either source second are rejected. Late queued/accepted/failed mail-result updates cannot erase a bounce.

A bounded worker checks pending publications every five minutes, with a ten-minute retry interval after a saved check. It creates no mail. Existing return reconciliation retains paper-follow-up evidence and targets; the worker records processing only after verifying the retained mail-log return. Temporary failures retry and create an internal alert. A conflicting manual return or earlier event that cannot reconcile to the effective retained return stays pending for review. Admins can append a correction from the publication panel. When provider evidence exists, the correction must use its earliest retained return; otherwise a verified manual timestamp is required. The original record and every correction remain immutable. Targets retain the original employer timezone and are recalculated from the corrected time. Stale revisions fail; matching pending provider events can reconcile on the next worker check. Corrections do not retract a return or establish successful delivery. A separate reviewed manual-return retraction restores the earlier retained send outcome, including uncertainty. It is unavailable for mail-log/provider returns and rejects stale corrections or a currently bounced delivery. Retraction evidence is immutable. A later signed provider return automatically reopens follow-up using the earliest retained provider timestamp and the retained timezone; the provider worker can reconcile it without another manual correction. `PAYROLL_W2_PROVIDER_INTAKE_ENABLED=false` pauses this worker only; valid callbacks remain durably retained.

## Remaining integration

- Verify real provider delivery behavior and support the remaining provider setup/remediation steps. Admin Employer setup now reports W-2 sending policy/configuration, supported signed-return key configuration, worker enablement and employer-scoped retained/pending counts with latest received/check times. Configuration checks do not establish successful callback delivery or active worker execution.
- Implement remaining uncertainty dispositions and repeated manual return/retraction cycles. One reviewed mistaken-manual-return retraction is supported, and later signed provider returns automatically reopen follow-up.
- No live provider configuration or messages were created in this work.

## Primary provider contract

Checked September 11, 2026:

- [SendGrid event webhook security](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/getting-started-event-webhook-security-features): signed timestamp/header contract and raw bytes.
- [Event webhook reference](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event): SMTP unique arguments, event IDs and event fields.
- [Unique arguments](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/unique-arguments): string-valued arguments and prohibition on placing personal information in them.
- [Official Node verifier](https://github.com/sendgrid/sendgrid-nodejs/blob/main/packages/eventwebhook/src/eventwebhook.js) and [test vectors](https://github.com/sendgrid/sendgrid-nodejs/blob/main/packages/eventwebhook/src/eventwebhook.spec.js).

## Repeated manual return reviews

A retracted manual return can receive newly reviewed evidence through `POST /api/admin/payroll/employees/:employeeId/w2-approval/:approvalId/notice-return-again`. The admin supplies `returnId`, `expectedRevision` (latest correction), `expectedCycleRevision` (latest cycle, initially zero), a canonical actual `returnedAt`, `reference`, and `confirmed: true`. The transaction retains a new time correction and `RETURN_RECORDED` cycle together, then updates the paper-follow-up alert. Repeated retractions use the existing retraction endpoint with both revisions and append a `RETRACTED` cycle. The original first-retraction row is unchanged.

The current-return view selects the latest manual state, while signed provider evidence retains precedence. Each cycle references its predecessor and current correction; source guards reject stale transitions, foreign correction links, provider overrides and returned-notice records contradicted by a retained NOT_SENT result. Concurrent requests serialize under the existing employer/furnishing locks; one succeeds and the stale request must reload. History exposes the original return, first retraction, all corrections and every later transition. Review references stay in admin history. No new notice is sent by this workflow.
