# Vortex Measurement Framework

**Status:** Canonical marketing measurement contract
**Version:** 1.0 — 2026-07-20
**Owners:** Vortex Athletics ownership, engineering, and marketing
**Scope:** Public Vortex websites, family signup, enrollment, Stripe checkout, GA4, GTM, Google Ads, and first-party analytics

This document defines what Vortex measures, why it is measured, how events are named, and when a signal is allowed to influence advertising. It is the source of truth for marketing instrumentation. The broader BI and admin-dashboard roadmap remains in `ANALYTICS-BI-SPEC-2026.md`.

## 1. Verified identifiers

| System | Name | Identifier | Verification |
|---|---|---:|---|
| Google Analytics account | Vortex Athletics | `396320772` | Confirmed in GA Admin |
| GA4 property | Vortex Athletics | `539662954` | Confirmed in GA Admin |
| GA4 web stream | `https://www.vortexathletics.com` | `14980804678` | Receiving traffic in the past 48 hours |
| GA4 Measurement ID | Vortex Athletics web stream | `G-XDE178DQWY` | Confirmed in GA Admin and source |
| Google Tag Manager container | `www.vortexathletics.com` | `GTM-T38PSLXX` | Confirmed in Tag Manager and source |

Do not use property ID `539708742`; it is not the Vortex production GA4 property.

## 2. Measurement principles

1. Measure business outcomes, not merely clicks.
2. Treat the database and Stripe webhook as authoritative for enrollment and revenue.
3. Use GA4 for behavioral analysis and Google Ads optimization, not as the financial ledger.
4. Preserve first-touch and last-touch acquisition context through checkout.
5. Never send names, email addresses, phone numbers, street addresses, waiver text, or other PII to GA4, GTM, or Google Ads.
6. Never create advertising audiences from child-specific attributes, including a child's name, exact age, skill level, or class assignment.
7. Separate implementation state from configuration and production validation.
8. A Google Ads primary conversion must represent new-customer value and fire once.

## 3. Business object model

Vortex events describe changes to business objects. Parameters use stable IDs or slugs where possible.

| Object | Stable key | Safe marketing dimensions | System of record |
|---|---|---|---|
| Visitor/session | anonymous visitor and session IDs | source, medium, campaign, landing page, device | First-party analytics / GA4 |
| Family | internal family/account ID | new vs. returning; never PII | Vortex database |
| Athlete | internal member ID | aggregate counts only for marketing | Vortex database |
| Program | program ID and slug | name, category, domain | Vortex database |
| Class/offering | class or form ID | public class name, schedule slot | Vortex database |
| Enrollment | enrollment/signup ID | recurring vs. one-time, status | Vortex database |
| Payment | Stripe PaymentIntent ID | value, currency, payment type | Stripe and billing tables |
| Membership | billing account/subscription ID | recurring status, tenure band | Stripe and billing tables |

## 4. Global event contract

Every first-party event contains the following envelope. GA4 receives the event-specific parameters only when analytics consent is granted.

| Field | Requirement | Rule |
|---|---|---|
| `event_id` | Required first-party | Client UUID; ingestion deduplication key |
| `event_name` | Required | Lowercase snake_case; past-tense only for completed outcomes |
| `occurred_at` | Required | ISO-8601 UTC timestamp |
| `page_path` | Required | Path only; strip sensitive query values |
| `hostname` | Required | Originating Vortex host |
| `visitor_id` | Consent-dependent | First-party anonymous ID; never a family/member ID |
| `session_id` | Consent-dependent | First-party session ID |
| `referrer` | Optional | Browser referrer |
| `utm` | When present | First/last-touch campaign data and click IDs |
| `consent_analytics` | Required | Consent state at event time |
| `consent_marketing` | Required | Consent state at event time |
| `is_staff` | Required first-party | Exclude internal use from acquisition reporting |
| `properties` | Event-specific | Allowlisted, non-PII dimensions |

Event names and parameter meanings are immutable after release. Add a new parameter or versioned event when semantics change; do not silently reuse an existing field for a different meaning.

## 5. Canonical customer funnel

| Stage | Canonical event | Business meaning | Optimization role |
|---|---|---|---|
| Awareness | `page_view` | A consented visit occurred | Diagnostic |
| Interest | `program_page_view` | Visitor viewed a program-oriented route | Diagnostic/audience |
| Consideration | `schedule_view`, `view_item`, `select_item` | Visitor explored availability and selected an offering | Secondary |
| Lead start | `form_start` | Visitor intentionally opened an inquiry form | Secondary |
| Lead | `generate_lead` | Backend confirmed the inquiry was saved | Secondary conversion |
| Account start | `sign_up_start` | Public family signup began | Secondary |
| Account created | `sign_up` | Family account or invited parent signup completed | Secondary conversion |
| Enrollment intent | `class_signup_submitted` or `begin_checkout` | Enrollment submitted or paid checkout began | Secondary conversion |
| Revenue | `purchase` | Stripe payment was recorded exactly once | Primary reporting event |
| Acquisition conversion | `vortex_purchase` dataLayer signal | First paid enrollment eligible for Ads conversion tag | Primary Google Ads conversion |
| Retention | Future server events | Recurring payment, active month, churn/reactivation | Value/LTV reporting; not acquisition count |

The funnel is not required to be a single linear path. A phone lead, no-payment signup, legacy registration, and Stripe enrollment are valid branches and must be reported separately.

## 6. Event dictionary and required parameters

### 6.1 Acquisition and engagement

| Event | Required parameters | Trigger |
|---|---|---|
| `page_view` | GA4 page fields | Initial load and every SPA route change |
| `program_page_view` | `program_slug` | Program route view |
| `schedule_view` | `sport` or source context | Public schedule becomes visible |
| `phone_click` | `location` | Public `tel:` link click |
| `email_click` | `location` | Public `mailto:` link click |
| `legacy_registration_click` | `destination`, `source` | Outbound legacy registration click |
| `legacy_parent_portal_click` | `destination`, `source` | Outbound legacy parent portal click |

`program_page_view` should eventually include canonical `program_id`, `program_name`, `program_category`, and `site_section`. Values must come from shared program metadata, not free-form component labels.

### 6.2 Lead generation

| Event | Required parameters | Trigger |
|---|---|---|
| `form_start` | `form_name`, `lead_type`, `program_slug`, `source_domain` | Inquiry form intentionally opened |
| `generate_lead` | Same as `form_start`; `campaign_type` where applicable | Successful backend response after saving inquiry |
| `inquiry_form_start` | Legacy compatibility parameters | Existing first-party funnel event |
| `inquiry_form_submit` | Legacy compatibility parameters | Existing first-party successful inquiry event |

`generate_lead` is the canonical GA4 lead conversion. Never fire it on button click, validation, or before the backend confirms persistence. Keep legacy inquiry events for first-party dashboard continuity until reports are migrated.

### 6.3 Signup and enrollment

| Event | Required parameters | Trigger |
|---|---|---|
| `view_item` | `program_id`, `program_name` | Program selected for enrollment |
| `select_item` | `class_id`, `class_name`, `selection_type` | Offering or time slot selected |
| `sign_up_start` | `signup_mode` | Public signup wizard mounted |
| `family_member_added` | `member_index` | Additional family member added; count only |
| `waiver_completed` | `waiver_count` | Waiver validation succeeds at submission |
| `sign_up` | `method`; member/waiver counts when available | Family or invited-parent account created |
| `class_signup_submitted` | `class_id`, `signup_count`, `waitlisted` | No-payment signup succeeds |
| `begin_checkout` | `value`, `currency`, `item_count`, `checkout_type` | Stripe Checkout URL received |
| `checkout_cancelled` | `checkout_type` | Browser returns from a cancelled checkout |
| `registration_receipt_view` | `program_name`, `enrollment_status` | Receipt page loads |

### 6.4 Revenue

| Event/signal | Required parameters | Authority and trigger |
|---|---|---|
| GA4 `purchase` | `transaction_id`, `value`, `currency`, `payment_type`; `enrollment_type` and `items` when available | Server-side Measurement Protocol after a new Stripe `billing_payment` record |
| GTM `vortex_purchase` | `transaction_id`, `value`, `currency`, `payment_type`, `enrollment_type` | Browser receives `firstConfirmation: true` after paid enrollment |
| `billing_payment_return` | `checkout_type: balance` | Diagnostic return from balance payment |
| `payment_failed` | `value`, `currency`; payment type when known | Server-side Stripe failure with attribution context |

Revenue values are decimal major currency units in analytics (`199.00` USD), while application/database values may remain integer cents.

## 7. Purchase deduplication and acquisition rules

1. `transaction_id` is the Stripe PaymentIntent ID, falling back to Checkout Session ID only when needed.
2. GA4 `purchase` emits only when the billing payment row reports `newly_inserted === true`.
3. The browser dataLayer signal emits only when the confirmation endpoint reports `firstConfirmation === true`.
4. Both signals share the same transaction ID.
5. GTM must send `vortex_purchase` to Google Ads, not back into GA4. GA4 already receives the authoritative server event.
6. Only `payment_type = initial_enrollment` is eligible for the acquisition primary conversion.
7. `payment_type = outstanding_balance` is revenue, but never a new-customer acquisition conversion.
8. Recurring renewals contribute to LTV/revenue reporting and must not repeatedly count as acquisitions.

## 8. Attribution contract

Capture and preserve:

- First-touch: source, medium, campaign, content, term, landing page, referrer, and click IDs.
- Last-touch: the most recent eligible campaign context before lead or checkout.
- Google click IDs: `gclid`, `wbraid`, and `gbraid`.
- Other platform click IDs may be retained first-party but are sent to a platform only with appropriate consent.
- GA4 `client_id` and `session_id` at checkout start so webhook purchases can retain session attribution.

Initial reporting uses GA4's standard acquisition dimensions alongside Vortex first-party attribution. Vortex should not claim causal lifetime attribution until offline conversion/value imports and identity rules have been validated.

## 9. Consent and privacy

| State | First-party operational event | GA4 | GTM advertising tags |
|---|---|---|---|
| No choice/default denied | No optional analytics persistence | Consent Mode default denied | Must not fire |
| Analytics accepted only | Allowed | Allowed | Must not fire without required marketing/ad consent |
| Marketing accepted, analytics denied | Follow policy implementation | Consent flags remain category-specific | Only tags whose consent requirements are satisfied |
| Analytics and marketing accepted | Allowed | Allowed | Allowed subject to tag consent checks |
| Consent withdrawn | Stop optional collection and rotate/delete identifiers per policy | Update denied | Stop firing |

The current source gates `vortex_purchase` on analytics consent. Before Ads launch, confirm this matches the banner's legal category design and every GTM tag's built-in consent requirements (`ad_storage`, `ad_user_data`, and `ad_personalization`).

## 10. GA4 and Google Ads configuration

### GA4 key events

| Event | GA4 key event? | Purpose |
|---|---|---|
| `generate_lead` | Yes | Completed inquiry |
| `sign_up` | Yes | Account creation |
| `class_signup_submitted` | Yes, if operationally valuable | Completed no-payment registration |
| `purchase` | Yes | Revenue transaction |
| `phone_click` | Optional | Call intent; keep secondary |
| `form_start`, `begin_checkout`, `select_item` | No | Funnel diagnostics |

### Google Ads conversion actions

| Conversion | Source | Action setting |
|---|---|---|
| Paid initial enrollment | GTM custom event `vortex_purchase` | **Primary**, count every transaction, use dynamic value/currency and transaction ID |
| Inquiry saved | GTM custom event `vortex_generate_lead` | Secondary initially; promote only if lead quality and dedupe are proven |
| Phone click | GA4 import or GTM | Secondary; do not equate click with answered call |
| Account signup | GA4 import | Secondary |
| Checkout start | GA4 import | Secondary |
| Outstanding balance/renewal | Server revenue event | Excluded from acquisition goals |

Do not create a GA4 Google Tag for `G-XDE178DQWY` in GTM while direct `gtag.js` remains installed; doing so would risk duplicate collection.

## 11. Audiences

Permitted only when consent and minimum audience thresholds are satisfied:

- Program viewers who did not generate a lead.
- Schedule viewers who did not enroll.
- Inquiry starters who did not submit.
- Camp landing-page viewers who did not generate a lead.
- Existing parent/customer suppression audience, using a platform-approved privacy-safe process.

Prohibited audience dimensions include child name, precise child age, school, waiver response, medical information, skill level, or uniquely identifying class membership.

## 12. KPI definitions

| KPI | Definition |
|---|---|
| Lead conversion rate | Unique persisted inquiries / eligible sessions |
| Enrollment conversion rate | New enrollment purchasers / eligible sessions or leads, reported as separate views |
| Lead-to-paid rate | Families with a first paid enrollment / persisted leads in the cohort |
| Cost per lead | Ad spend / attributed persisted leads |
| Customer acquisition cost | Ad spend / attributed first paid enrollments |
| First-payment ROAS | Attributed initial-enrollment revenue / ad spend |
| LTV | Realized net customer revenue over the defined cohort window; projected LTV must be labeled projected |
| LTV:CAC | Realized or explicitly projected LTV / CAC, using matching attribution and cohort windows |

Report family-level acquisition separately from athlete and enrollment counts. One family can add multiple athletes and enrollments without representing multiple acquired customers.

## 13. Implementation/configuration status

Statuses are deliberately separate: **Code**, **External configuration**, and **Production validation**.

| Capability | Code | External configuration | Production validation |
|---|---|---|---|
| GA4 direct tag and SPA page views | Implemented | Configured | Observed in Realtime |
| Consent Mode v2 defaults and updates | Implemented | GTM consent checks require audit | Analytics observed after consent; all states not yet certified |
| First-party event ingestion | Implemented | Backend/database deployed status to confirm | Existing custom events observed in GA4; DB counts should be checked |
| Lead events | Implemented | `vortex_generate_lead` GTM tag not yet confirmed | GA4 `generate_lead` and GTM firing need test |
| Enrollment funnel events | Implemented in current worktree | GA4 custom definitions/key events not confirmed | End-to-end test pending |
| Server GA4 purchase | Implemented in current worktree | Requires `GA4_MEASUREMENT_ID` and `GA4_API_SECRET` in production | No live purchase validation yet |
| Browser Ads purchase signal | Implemented in current worktree | Requires GTM trigger/tag and Google Ads conversion action | No live purchase validation yet |
| Google Ads account/linking | Application-independent | Not confirmed | Not started/validated |
| Lifetime value attribution | Partial foundations | Offline/value-import design not configured | Not validated |

## 14. Launch gates

Google Ads may launch only after the applicable gates are complete:

- [ ] Confirm the GA4 property is linked to the intended Google Ads account.
- [ ] Audit GTM container versions, triggers, variables, and consent requirements.
- [ ] Confirm no duplicate GA4 configuration tag exists in GTM.
- [ ] Configure GA4 key events and needed custom dimensions.
- [ ] Configure `vortex_generate_lead` as a GTM custom-event conversion signal.
- [ ] Configure `vortex_purchase` with dynamic transaction ID, value, and currency.
- [ ] Set paid initial enrollment as the only acquisition primary conversion.
- [ ] Add production `GA4_API_SECRET` and confirm the expected Measurement ID.
- [ ] Validate one inquiry end to end in Tag Assistant, GA4 Realtime/DebugView, first-party analytics, and the backend inquiry record.
- [ ] Validate one Stripe test purchase end to end, including exactly one GA4 `purchase` and one Ads conversion signal.
- [ ] Replay/refresh the success URL and replay the webhook to prove deduplication.
- [ ] Verify outstanding-balance payments do not count as new acquisitions.
- [ ] Test default denied, analytics-only, marketing-only, accept-all, and withdrawn consent states.
- [ ] Exclude staff/internal traffic from acquisition reporting.
- [ ] Record screenshots, transaction IDs, timestamps, and expected/actual results in a launch evidence log.

## 15. Next implementation priorities

1. Complete and test the current purchase instrumentation changes.
2. Enrich `program_page_view` from a central program metadata registry.
3. Configure and validate GA4 key events and GTM/Google Ads conversion actions.
4. Add cohort reporting that joins lead, first payment, and later revenue at the family level without exporting PII to analytics platforms.
5. Build an evidence-backed launch dashboard: spend, leads, first paid families, first-payment revenue, CAC, and ROAS.

## 16. Change control

Any event or conversion change requires:

1. Update this document.
2. Update TypeScript/server allowlists or schemas where applicable.
3. Update GA4 custom definitions/key-event configuration where applicable.
4. Update GTM variables, triggers, and tags where applicable.
5. Run the relevant validation case and attach evidence.
6. Record the deployment and GTM container version.

No marketer or developer should introduce a new primary conversion without ownership approval and a documented deduplication/value rule.
