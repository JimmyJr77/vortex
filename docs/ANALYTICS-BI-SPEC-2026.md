# Vortex Admin Analytics, SEO Intelligence & Marketing Tracking — Full Specification (2026)

**Scope:** `vortexathletics.com`, `vortex-gymnastics.com`, stub domains, and the Vortex admin portal (`/admin`).

**Audience:** Engineering, ownership, marketing, and operations.

**Privacy stance:** First-party, consent-based analytics. No fingerprinting, no invasive tracking, no scraping of private competitor data, no ad audiences built from child-specific attributes.

---

## Executive Summary

The current **Analytics & Engagement** tab (`src/components/AdminAnalytics.tsx`) is **not a business intelligence system**. It is a **browser-local activity log** that reads `localStorage` keys written by `src/utils/analytics.ts` on the **same machine/browser** that opens the admin panel.

### Why it fails as admin analytics

| Expectation | Reality |
|-------------|---------|
| Site-wide traffic for all visitors | Only events stored in **that admin’s browser** `localStorage` |
| Persistent, auditable data | Cleared when admin clears data or uses another device |
| Connected to inquiries, enrollments, revenue | **Zero** backend analytics tables or APIs |
| SEO / GSC / campaign data | Not integrated |
| Charts, date filters, exports | Not implemented |
| Role-based analytics access | Single `authenticateAdmin` gate; no analytics-specific RBAC |

### What already works elsewhere (untapped for analytics)

| Data source | Location | Analytics tab uses it? |
|-------------|----------|------------------------|
| Inquiries / registrations | `registrations` table + `AdminInquiries` | **No** |
| Newsletter signups | `newsletter_subscribers` | **No** |
| Members / families / athletes | `member`, `family`, `app_user` | **No** |
| Enrollments | `member_program` + `AdminEnrollments` | **No** |
| Class capacity | `program.max_capacity`, `program.current_enrollment`, `class_iteration` | **No** |
| Events | Events admin + DB | **No** |
| GA4 page views | `G-XDE178DQWY` via `gtag` (`index.html`, `googleAnalytics.ts`) | **Not shown in admin** |
| Staff follow-up | `registrations.contacted`, `admin_notes` | **No** |

### Strategic outcome

Rebuild analytics as a **privacy-compliant, server-side, first-party data layer** that:

1. Collects consented website events into Postgres.
2. Joins anonymous visitors → inquiries → families → enrollments (identity stitching with consent).
3. Surfaces **operational truth** from existing Vortex tables (inquiries, enrollments, capacity).
4. Integrates **GA4 + Google Search Console** for marketing/SEO (read-only APIs).
5. Adds **ethical competitor intelligence** (manual + public APIs only).
6. Presents **owner-ready dashboards** with filters, alerts, and CSV exports.

**[ASSUMPTION]** Billing/subscriptions (Stripe), attendance marking, skill progression, and waitlists are **product vision** items referenced in the MVP brief but **not present** in the current schema. Revenue/attendance/retention dashboards are specified below with explicit “Phase 2+” dependencies.

---

## Step 1: Audit — Current Analytics & Engagement Section

### 1.1 Architecture today

```
Public site (App.tsx / GymnasticsApp.tsx)
  └─ trackPageView() → localStorage + optional gtag
  └─ trackEngagement() → localStorage (only form_open wired)
  └─ Skipped when admin session OR member session active

Admin portal (AdminAnalytics.tsx)
  └─ getAnalyticsData() → reads same browser localStorage only
  └─ No adminApiRequest()
  └─ No charts library
```

**Files:**

- `src/components/AdminAnalytics.tsx` — UI only
- `src/utils/analytics.ts` — localStorage writer/aggregator
- `src/utils/googleAnalytics.ts` — SPA virtual pageviews to GA4
- `src/config/googleAnalytics.ts` — measurement ID `G-XDE178DQWY`
- `index.html` — gtag loads **without consent gate**

### 1.2 Diagnosis table

| Problem | Current behavior | Root cause | Business impact | Recommended fix | Priority |
|---------|------------------|------------|-----------------|-------------------|----------|
| Not site-wide analytics | Admin sees only their browser’s stored events | Data in `localStorage`, not server | Owners think traffic is near-zero or wrong | `POST /api/analytics/event` + Postgres `analytics_events` | P0 |
| Admin sessions untracked | No public traffic while testing logged-in | `App.tsx` skips tracking if admin/member | Under-counts real traffic during business hours | Server-side collection; segment internal traffic by `is_staff` flag | P0 |
| No historical retention | Max 1000 page views / 500 events in LS | Hard caps in `analytics.ts` | Cannot see trends | Server retention policy (e.g. 24 months raw, aggregates forever) | P0 |
| Misleading “Unique Visitors” | Counts IDs in one browser’s LS | Not UUID across devices; not server | Bad strategic decisions | Server `visitor_sessions` + hashed first-party cookie after consent | P0 |
| “Engagement rate” meaningless | `(engagement events / page views) * 100` | Arbitrary ratio | False confidence | Replace with funnel conversion metrics | P1 |
| Button clicks empty | “Most Clicked Buttons” usually empty | `trackEngagement('button_click')` **never called** in UI | No CTA intelligence | Instrument CTAs with `data-analytics-id` + event collector | P1 |
| No inquiry attribution | Inquiries lack UTM/source | `ContactForm` / `POST /api/registrations` don’t store attribution | Cannot rank channels | `utm_attribution` table + capture on first visit & inquiry | P0 |
| No funnel | No visitor → inquiry → enrollment join | No identity graph | Cannot optimize conversion | `visitor_identities` + `conversion_events` | P1 |
| No SEO in admin | GSC not integrated | No API client / tokens | SEO work is blind | GSC OAuth + nightly sync job | P2 |
| No revenue dashboard | No billing tables found | **[ASSUMPTION]** Stripe not wired | Cannot tie ads to MRR | Phase 2 billing integration | P3 |
| No date filters | Static snapshot | UI not built | Cannot compare periods | Date range on all widgets | P1 |
| No CSV export | None | Not built | Owners re-type data | `GET /api/admin/analytics/export` | P1 |
| GA4 without consent | gtag in `index.html` always loads | No CMP / consent mode | Compliance risk for families site | Cookie banner + Consent Mode v2 | P0 |
| Clear Data destroys truth | Admin can wipe LS | By design for broken model | Accidental data loss | Remove for server analytics; soft-delete with RBAC | P2 |
| No competitor module | N/A | Not built | Miss local positioning | Phase 4 competitor tables + manual entry | P3 |

### 1.3 What metrics exist today (admin UI)

| Metric | Source | Valid for business? |
|--------|--------|-------------------|
| Total Page Views | localStorage | **No** (per-browser) |
| Unique Visitors | localStorage visitor IDs | **No** |
| Total Engagement | localStorage event count | **No** |
| Avg Session Time | localStorage sessions | **No** |
| Engagement Rate % | Derived locally | **No** |
| Total Sessions | localStorage | **No** |
| Most Popular Pages | Aggregated LS | **No** |
| Most Clicked Buttons | LS `button_click` (sparse) | **No** |
| Recent Page Views / Engagement | LS tail | **No** |

### 1.4 Events tracked today

| Event | Trigger | Stored |
|-------|---------|--------|
| `page_view` (internal) | Route change if not admin/member | localStorage |
| `page_view` (GA4) | `trackGooglePageView` unless `noindex` preview | Google |
| `form_open` | Contact modal open | localStorage |
| `button_click`, `link_click` | **Not wired** | — |

### 1.5 Admin access today

- All `/api/admin/*` routes use `authenticateAdmin` (JWT).
- Portal tabs: Inquiries (default), Analytics, Membership, Classes, Enrollments, Highlights, Events, Admins.
- **No** per-tab permission matrix for analytics (any admin sees all).

**Recommendation:** `OWNER_ADMIN` → full analytics; `COACH` → attendance/skill only (future); marketing role → marketing + SEO dashboards only.

---

## Step 2: Business Intelligence Data Vortex Needs

Below: **Available now** = derivable from current DB/code; **Build** = new instrumentation; **Integrate** = external API; **Future** = depends on billing/attendance modules.

### 2.1 Website & SEO analytics

| Metric | Status | Collection |
|--------|--------|------------|
| Sessions, users, new/returning | Build + Integrate (GA4) | GA4 + first-party sessions |
| Page views, landing/exit pages | Build | `page_views` / GA4 |
| Top pages, program/camp views | Build | Event `program_page_view` |
| Scroll depth, CTA clicks | Build | Optional sampled events |
| Form starts/submits | Build | `inquiry_form_start`, `inquiry_form_submit` |
| Phone/email clicks | Build | `phone_click`, `email_click` |
| Schedule views | Build | `schedule_view` on Read Board |
| Search traffic, queries, CTR, position | Integrate | GSC API |
| Core Web Vitals | Integrate | GSC + CrUX **[ASSUMPTION]** |
| Referral / local SEO traffic | Integrate | GA4 segments |
| Indexed pages, technical issues | Integrate | GSC |

### 2.2 Lead & inquiry analytics

| Metric | Status | Source |
|--------|--------|--------|
| Total inquiries | **Available now** | `registrations` |
| Program interest, ages, class types | **Available now** | `registrations` columns |
| Contacted / staff notes | **Available now** | `contacted`, `admin_notes` |
| Lead status pipeline | Build | Extend `registrations.lead_status` enum |
| Response time | Build | `first_contacted_at`, `contacted` |
| Lead → trial → enrollment | Build + Future | Stitch to `member_program` |
| Abandoned forms | Build | `inquiry_form_start` without submit |
| Newsletter signups | **Available now** | `newsletter_subscribers` |
| UTM / source attribution | Build | `utm_attribution` |

### 2.3 Enrollment & class analytics

| Metric | Status | Source |
|--------|--------|--------|
| Active enrollments | **Available now** | `member_program` |
| Class capacity / fill rate | **Available now** | `program.max_capacity`, `current_enrollment`, iterations |
| Open spots | **Available now** | Computed |
| Waitlist | Future | New `waitlist` table |
| Demand by age/program | **Available now** | Join inquiries + enrollments |
| Attendance trends | Future | `attendance` table |
| Trial conversion | Build | `lead_status` + enrollment dates |

### 2.4 Revenue & membership analytics

| Metric | Status | Notes |
|--------|--------|-------|
| MRR, churn, failed payments | Future | Requires Stripe/billing module |
| Revenue by program/family | Future | |
| LTV / CAC | Build | Once ad spend + revenue exist |

### 2.5 Family, athlete & retention

| Metric | Status | Source |
|--------|--------|--------|
| Active families/athletes | **Available now** | `family`, `member` |
| New vs returning families | Build | `member.created_at` |
| At-risk (absences, failed pay) | Future | Attendance + billing |
| Inquiry no-convert | Build | Join `registrations` ↔ `member` by email |

### 2.6 Coach & operations

| Metric | Status |
|--------|--------|
| Roster by coach | Future (coach assignment) |
| Inquiry response time | Build from `contacted` + timestamps |
| Admin audit logs | Build `audit_log` table |

### 2.7 Events & camps

| Metric | Status |
|--------|--------|
| Event/camp page views | Build (events) |
| Registrations per event | **Available now** (events admin data) — wire to analytics |

---

## Step 3: KPI Dashboard Structure

### 3.1 Executive Overview

**Route:** `/admin` → Analytics → Overview

| Widget | Metrics | Data source |
|--------|---------|-------------|
| Traffic (7d/30d) | Sessions, users | GA4 + `visitor_sessions` |
| Inquiries (7d/30d) | Count, vs prior period | `registrations` |
| Contacted % | contacted / total open inquiries | `registrations` |
| New families (30d) | Count | `family` / `member` |
| Active enrollments | Count | `member_program` |
| Classes near capacity | % fill ≥ 85% | `program` + iterations |
| Classes under capacity | % fill &lt; 50% | computed |
| Top program by inquiries | Group by interests | `registrations` |
| Past due / at-risk | Placeholder until billing | Future |

### 3.2 Marketing & SEO Dashboard

| Widget | Data |
|--------|------|
| Organic sessions | GA4 |
| Local sessions (Bowie / PG County) | GA4 geo |
| GSC impressions/clicks/CTR/position | GSC API |
| Top queries | GSC |
| Top landing pages | GA4 + first-party |
| Inquiry conversion by landing page | Join `utm_attribution` + `registrations` |
| Channel / campaign table | UTM + GA4 |

### 3.3 Lead Funnel Dashboard

**Funnel steps (v1):**

1. `page_view` (site entry)
2. `program_page_view`
3. `schedule_view`
4. `inquiry_form_start`
5. `inquiry_form_submit` → `registrations.id`
6. `inquiry_contacted` → `registrations.contacted = true`
7. `enrollment_created` → `member_program.id`
8. `paying_member` → Future (billing)

Per step: count, step conversion %, drop-off %, trend, segments (program, age band, `utm_source`).

### 3.4 Program Demand Dashboard

- Inquiry volume by program/interest (from `interests_array`)
- Enrollment count by `program_id`
- Capacity heatmap: iteration × day × fill %
- Waitlist count (future)

### 3.5 Revenue Dashboard (Phase 2+)

Depends on Stripe/subscription tables. Spec retained for roadmap alignment.

### 3.6 Retention Dashboard (Phase 2+)

- Active/dropped families
- Attendance consistency
- Payment failures
- At-risk list with recommended actions

### 3.7 Competitor Intelligence Dashboard (Phase 4)

Public data only — see Step 7.

---

## Step 4: Event Tracking Plan

### 4.1 Implementation pattern

```typescript
// src/utils/analyticsClient.ts (new)
trackEvent('inquiry_form_submit', {
  program_interest: ['Gymnastics (Artistic)'],
  page_path: '/',
  consent_analytics: true,
})
// → POST /api/analytics/event (batch, sendBeacon on unload)
// → gtag('event', ...) only if marketing consent
```

**Required properties (global):**

| Property | Type | Required |
|----------|------|----------|
| `event_name` | string | yes |
| `event_id` | uuid | yes (client-generated, dedupe) |
| `occurred_at` | ISO8601 | yes |
| `page_path` | string | yes |
| `page_title` | string | no |
| `hostname` | string | yes |
| `visitor_id` | string | yes (first-party cookie, post-consent) |
| `session_id` | string | yes |
| `referrer` | string | no |
| `utm_*` | string | if present |
| `consent_analytics` | boolean | yes |
| `consent_marketing` | boolean | yes |

### 4.2 Event catalog (priority subset)

| Event name | Trigger | Page/component | Key properties | Destination | Business use | Priority |
|------------|---------|----------------|----------------|-------------|--------------|----------|
| `page_view` | Route change | SPA router | path, title | DB, GA4* | Traffic | P0 |
| `program_page_view` | Program route mount | `/ninja`, `/artistic-*`, gym pages | program_slug | DB, GA4* | Demand | P0 |
| `schedule_view` | Read board visible | `ReadBoard`, `#schedule` | sport | DB | Intent | P0 |
| `inquiry_form_start` | Modal open | `ContactForm` | sport_label | DB | Abandonment | P0 |
| `inquiry_form_submit` | Successful POST | `ContactForm` | interests, ages, newsletter | DB, CRM | Leads | P0 |
| `newsletter_signup` | Checkbox + submit | Contact / footer | email hash | DB | List growth | P1 |
| `phone_click` | `tel:` click | Header, Footer | location | DB | Calls | P1 |
| `email_click` | `mailto:` click | Footer | — | DB | Contacts | P1 |
| `cta_click` | Primary CTAs | Hero, Programs | cta_id, label | DB | Creative test | P1 |
| `camp_view` | Campaign landing | `/campaigns/*` | campaign_slug | DB | Seasonal | P1 |
| `event_view` | Event detail | Events UI | event_id | DB | Promotions | P2 |
| `class_enrollment_started` | Enroll modal | `EnrollmentForm` | program_id | DB | Ops funnel | P2 |
| `class_enrollment_completed` | API success | Admin/member enroll | member_id, program_id | DB | Conversion | P2 |
| `admin_report_exported` | Export click | Analytics | report_type | DB, audit | Compliance | P2 |

\*GA4 only when `consent_analytics === true`; marketing pixels only when `consent_marketing === true`.

### 4.3 Consent rules per event

| Event category | Necessary | Analytics cookie | Marketing cookie |
|----------------|-----------|------------------|------------------|
| Session cookie (CSRF/admin) | Yes | — | — |
| First-party visitor ID | No | Yes | No |
| GA4 page_view | No | Yes | No |
| Meta/Google Ads pixel | No | No | Yes |
| Server-side conversion API | No | No | Yes (hashed PII only per platform policy) |

**Never send to ad platforms:** child age, child name, program level as audience seed; use **page-level** retargeting only.

---

## Step 5: Marketing Attribution System

### 5.1 Attribution model (v1)

| Field | Capture point | Storage |
|-------|---------------|---------|
| First-touch source/medium/campaign | First landing with UTMs | `utm_attribution` + session |
| Last-touch | Latest before inquiry | `registrations` or `inquiry_attribution` |
| Landing page | First page_view | `visitor_sessions.landing_path` |
| Referrer | HTTP referrer | session |
| gclid / fbclid | Query string | `utm_attribution.click_ids` JSONB |
| Device type | UA parsing | session |
| Geo (city/region) | IP → geo **[server-side, coarse]** | session (no street address) |

### 5.2 Identity stitching schema

```
visitor_id (cookie, anonymous)
    ↓ inquiry_form_submit (email)
inquiry_id (registrations.id)
    ↓ manual / email match
member_id (member.id)
    ↓ enrollment
member_program rows
    ↓ future
subscription_id
```

**Rules:**

- Store **email hash** (SHA-256 + salt) for matching; display email only in admin with RBAC.
- Do not merge children’s data into marketing profiles.
- `visitor_id` rotated on consent withdraw + deletion request.

### 5.3 Questions attribution must answer

- Which campaigns generate **leads**? → `utm_campaign` on inquiries
- Which generate **enrollments**? → join to `member_program.created_at`
- Which generate **revenue**? → Phase 2+ billing
- Which pages produce best customers? → LTV by `landing_path` (future)

---

## Step 6: Cookie, Consent & Retargeting Strategy

### 6.1 Cookie categories

| Category | Examples | Default (pre-consent) |
|----------|----------|------------------------|
| Necessary | Admin JWT, CSRF, sport preference | On |
| Analytics | `_vortex_vid`, `_vortex_sid`, GA4 | Off |
| Marketing | Meta Pixel, Google Ads tags | Off |

### 6.2 Consent banner requirements

- First visit modal + footer “Cookie settings”
- Granular toggles (Analytics / Marketing)
- Log consent: `consent_records(visitor_id, choices, ip_country, policy_version, created_at)`
- GA4 **Consent Mode v2**: `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`
- Load gtag only after necessary; update consent flags when user accepts

### 6.3 Retargeting audiences (compliant)

| Audience | Rule | Exclusions |
|----------|------|------------|
| Gym page viewers, no inquiry | `program_page_view` gymnastics, no `inquiry_form_submit` 7d | Minors’ PII |
| Camp viewers | `camp_view`, no registration | — |
| Abandoned inquiry | `inquiry_form_start`, no submit 24h | Only if marketing consent |
| Schedule viewers | `schedule_view`, no enrollment 14d | — |
| Marketing opt-in parents | `newsletter` + explicit marketing consent | — |

**Prohibited:** “Age 6 gymnast in Bowie” custom audience; “Child named X”.

### 6.4 Data retention & deletion

| Data type | Retention | Deletion |
|-----------|-----------|----------|
| Raw `analytics_events` | 24 months | Aggregate then purge |
| `consent_records` | 3 years | Legal hold |
| Inquiry PII | Active business + 7 years tax **[ASSUMPTION]** | Admin + export erasure workflow |
| GA4 | Per Google settings | Google request + stop sending |

---

## Step 7: Competitor Intelligence System

### 7.1 Ethical data sources only

| Source | Method | Allowed |
|--------|--------|---------|
| Competitor website | Manual review / public pages | Yes |
| Google Business Profile | Manual + Places API **[ASSUMPTION: API key]** | Public fields only |
| Reviews | Manual themes; count/rating from GBP | Yes |
| Rankings | GSC for Vortex; competitors via manual checks or licensed SEO tool | No unauthorized scraping |
| Ads | Meta Ad Library, Google Ads Transparency | Public libraries |
| Pricing | Only if published on site | Yes |

### 7.2 Competitor comparison table (template)

| Competitor | Website | Programs offered | Review rating | Review count | SEO strengths | Content gaps | Pricing notes | Vortex opportunity |
|------------|---------|------------------|---------------|--------------|---------------|--------------|---------------|----------------------|
| Maryland Gymnastics (MGA) | mga-gym.com | Artistic, comp | **[Manual]** | **[Manual]** | Strong local brand | Preschool content depth | **[Public]** | Emphasize multi-sport athleticism |
| Bowie Gymnastics Club | **[URL]** | **[Manual]** | — | — | — | — | — | Trial + technology angle |
| *Add 5–10 DMV competitors* | | | | | | | | |

### 7.3 Monitoring cadence

| Frequency | Tasks |
|-----------|-------|
| Weekly | GBP review count/rating snapshot (top 5 competitors) |
| Monthly | Program/page changes (manual diff notes), keyword spot-checks |
| Quarterly | Full competitor table refresh, content gap workshop |
| Alerts | Review rating drop for Vortex; competitor new camp page (manual flag) |

### 7.4 Admin UI: competitor module

- CRUD competitors (`POST/PUT /api/admin/competitors`)
- Snapshot history (`competitor_snapshots`: rating, review_count, notes, captured_at)
- “Opportunity score” manual 1–5 per competitor per quarter

---

## Step 8: Data Model & Database Requirements

### 8.1 Core analytics tables

#### `analytics_events`

| Field | Type | Notes |
|-------|------|-------|
| id | BIGSERIAL PK | |
| event_id | UUID UNIQUE | Client dedupe |
| event_name | VARCHAR(80) | Indexed |
| occurred_at | TIMESTAMPTZ | Indexed |
| visitor_id | VARCHAR(64) | Indexed |
| session_id | VARCHAR(64) | |
| page_path | TEXT | |
| hostname | VARCHAR(255) | |
| properties | JSONB | Event-specific |
| consent_analytics | BOOLEAN | |
| consent_marketing | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

**Indexes:** `(event_name, occurred_at)`, `(visitor_id, occurred_at)`, GIN on `properties`.

**Privacy:** No raw child names in `properties`; use IDs/slugs.

**Retention:** 24 months → roll up to daily aggregates.

#### `visitor_sessions`

| Field | Type |
|-------|------|
| id | BIGSERIAL PK |
| session_id | UUID UNIQUE |
| visitor_id | VARCHAR(64) |
| started_at | TIMESTAMPTZ |
| ended_at | TIMESTAMPTZ |
| landing_path | TEXT |
| referrer | TEXT |
| device_type | VARCHAR(20) |
| geo_region | VARCHAR(100) |
| utm_source | VARCHAR(100) |
| utm_medium | VARCHAR(100) |
| utm_campaign | VARCHAR(100) |
| is_staff | BOOLEAN DEFAULT false |

#### `visitor_identities`

| Field | Type |
|-------|------|
| id | BIGSERIAL PK |
| visitor_id | VARCHAR(64) |
| inquiry_id | INT FK → registrations |
| member_id | BIGINT FK → member |
| linked_at | TIMESTAMPTZ |
| link_method | VARCHAR(30) | e.g. `email_match` |

#### `consent_records`

| Field | Type |
|-------|------|
| id | BIGSERIAL PK |
| visitor_id | VARCHAR(64) |
| policy_version | VARCHAR(20) |
| analytics | BOOLEAN |
| marketing | BOOLEAN |
| ip_country | VARCHAR(2) |
| user_agent | TEXT |
| created_at | TIMESTAMPTZ |

#### `utm_attribution`

| Field | Type |
|-------|------|
| id | BIGSERIAL PK |
| visitor_id | VARCHAR(64) |
| inquiry_id | INT NULL |
| touch_type | VARCHAR(10) | `first` / `last` |
| source | VARCHAR(100) |
| medium | VARCHAR(100) |
| campaign | VARCHAR(100) |
| content | VARCHAR(100) |
| term | VARCHAR(100) |
| landing_page | TEXT |
| click_ids | JSONB |
| created_at | TIMESTAMPTZ |

#### `conversion_events`

Denormalized funnel milestones for fast dashboards.

| Field | Type |
|-------|------|
| id | BIGSERIAL PK |
| inquiry_id | INT |
| member_id | BIGINT NULL |
| milestone | VARCHAR(50) |
| occurred_at | TIMESTAMPTZ |
| metadata | JSONB |

#### Extend `registrations` (existing)

| New field | Type | Purpose |
|-----------|------|---------|
| `lead_status` | ENUM | `new`, `contacted`, `trial_booked`, `enrolled`, `lost` |
| `first_contacted_at` | TIMESTAMPTZ | SLA metrics |
| `utm_source` | VARCHAR(100) | Last-touch |
| `utm_medium` | VARCHAR(100) | |
| `utm_campaign` | VARCHAR(100) | |
| `landing_page` | TEXT | |
| `visitor_id` | VARCHAR(64) | Stitching |

*`contacted` + `admin_notes` already shipped.*

#### `marketing_campaigns`

Manual campaign registry for offline spend.

| Field | Type |
|-------|------|
| id | SERIAL PK |
| name | TEXT |
| channel | VARCHAR(50) |
| start_date | DATE |
| end_date | DATE |
| budget | DECIMAL |
| utm_campaign | VARCHAR(100) |

#### `competitors` / `competitor_snapshots`

| competitors | competitor_snapshots |
|-------------|----------------------|
| id, name, website_url, gbp_place_id, notes | id, competitor_id, rating, review_count, programs_json, captured_at, source |

#### `seo_keywords` / `seo_rankings`

Synced from GSC **[ASSUMPTION: OAuth service account]**.

| seo_keywords | seo_rankings |
|--------------|--------------|
| query, page, device | keyword_id, date, impressions, clicks, position, ctr |

#### `admin_dashboard_widgets` / `report_exports`

User-saved filters and export audit.

### 8.2 Existing tables to reuse (no duplicate)

- `registrations`, `newsletter_subscribers`, `member`, `family`, `member_program`, `program`, `class_iteration`, events tables.

---

## Step 9: API Requirements

### 9.1 Public / first-party

#### `POST /api/analytics/event`

| | |
|--|--|
| **Purpose** | Ingest one or batched events |
| **Auth** | None (rate-limited by IP + visitor_id) |
| **Body** | `{ events: [{ event_id, event_name, occurred_at, page_path, properties, consent_* }] }` |
| **Response** | `{ success: true, accepted: number }` |
| **Security** | Schema validation, max body 64KB, strip PII from properties, bot filtering |

#### `POST /api/consent`

| | |
|--|--|
| **Purpose** | Record consent choices |
| **Body** | `{ visitor_id, analytics, marketing, policy_version }` |
| **Storage** | `consent_records` |

### 9.2 Admin analytics (all require `authenticateAdmin`)

| Endpoint | Purpose | Key params | Response shape |
|----------|---------|------------|----------------|
| `GET /api/admin/analytics/overview` | Executive KPIs | `from`, `to`, `hostname` | `{ traffic, inquiries, enrollments, capacityAlerts }` |
| `GET /api/admin/analytics/traffic` | Page/session stats | `from`, `to`, `path` | `{ sessions, pageViews[], topPages[] }` |
| `GET /api/admin/analytics/funnel` | Funnel counts | `from`, `to`, `program`, `utm_source` | `{ steps: [{ name, count, rate }] }` |
| `GET /api/admin/analytics/programs` | Demand & fill | `program_id?` | `{ inquiries[], enrollments[], capacity[] }` |
| `GET /api/admin/analytics/revenue` | Revenue KPIs | Phase 2+ | `{ mrr, churn, ... }` or `{ available: false }` |
| `GET /api/admin/analytics/retention` | At-risk families | Phase 2+ | |
| `GET /api/admin/analytics/seo` | GSC summary | `from`, `to` | `{ queries[], pages[], totals }` |
| `GET /api/admin/analytics/competitors` | Competitor list + latest snapshot | — | `{ competitors[] }` |
| `GET /api/admin/analytics/export` | CSV export | `reportType`, `from`, `to` | `text/csv` stream |
| `POST /api/admin/competitors` | Add competitor | body | `{ id }` |
| `PUT /api/admin/competitors/:id` | Update | body | `{ success }` |
| `GET /api/admin/reports/:reportType` | PDF/HTML report data | `from`, `to` | Report-specific JSON |

**Error handling:** 401 unauthorized, 403 forbidden (future RBAC), 422 validation, 503 if GSC unavailable.

**Security:** No PII in analytics export without `OWNER_ADMIN`; rate limit exports; audit log each export.

---

## Step 10: Admin UI Requirements

### 10.1 Information architecture

Replace single `AdminAnalytics` with sub-nav:

1. **Overview** (Executive)
2. **Marketing & SEO**
3. **Lead Funnel**
4. **Programs & Capacity**
5. **Revenue** (disabled until billing)
6. **Retention** (partial until attendance/billing)
7. **Competitors**
8. **Settings** (consent policy version, tracking status)

### 10.2 Global controls (all screens)

- Date range: Today / 7d / 30d / 90d / Custom
- Host filter: Hub / Gymnastics / All
- Program filter (multi-select)
- Source/channel filter (UTM)
- **Export CSV** button
- Last refreshed timestamp

### 10.3 Screen specification

| Screen | Purpose | Widgets | Filters | Data source | Actions |
|--------|---------|---------|---------|-------------|---------|
| Overview | Owner snapshot | 8 KPI cards, inquiry trend line, capacity alert list | Date, host | overview API + registrations | Export summary |
| Marketing & SEO | Acquisition | Channel bar chart, GSC keyword table, landing page table | Date, campaign | GA4+GSC+DB | Open GSC |
| Lead Funnel | Conversion | Funnel viz, drop-off table, contacted SLA | Program, source | funnel API | Drill to Inquiries |
| Programs & Capacity | Ops demand | Heatmap fill %, inquiry vs enrollment dual axis | Program | programs API | Link to Enrollments |
| Revenue | Money | MRR line, failed payments (future) | — | Stripe Phase 2 | — |
| Retention | Churn risk | At-risk table (rules-based v1) | Program | members + rules | Email draft **[manual]** |
| Competitors | Market | Comparison table, snapshot timeline | Competitor | competitors API | Add snapshot |
| Settings | Compliance | Consent rate, tag status, policy version | — | consent_records | — |

### 10.4 UX principles

- Plain English labels (“Families who inquired but didn’t enroll”)
- Traffic light indicators (green/yellow/red capacity)
- Mobile: cards stack; tables scroll horizontally
- Deprecate **Clear Data** for localStorage; show “Data through [date]” from server

### 10.5 Tech stack recommendation

- Charts: **Recharts** or **Chart.js** (lightweight)
- Tables: extend existing admin table patterns (`AdminInquiries`)
- State: React Query for API caching

---

## Step 11: Marketing Automation Recommendations

| Workflow | Trigger | Audience | Message goal | Channel | Timing | Success metric |
|----------|---------|----------|--------------|---------|--------|----------------|
| New inquiry confirmation | `inquiry_form_submit` | Submitter | Acknowledge + next steps | Email | Immediate | Open rate |
| Admin new lead alert | Inquiry created | Staff | Respond quickly | Email/Slack | Immediate | `first_contacted_at` &lt; 24h |
| No-response follow-up | Inquiry 48h, not contacted | Staff task | Prevent lead loss | Admin task | 48h | Contacted % |
| Trial reminder | `lead_status = trial_booked` | Parent | Show up | Email/SMS **[opt-in]** | 24h before | Trial attendance |
| Schedule-view nudge | `schedule_view`, no inquiry 3d | Consented visitor | CTA inquire | Email **[if email known]** | 72h | Inquiry rate |
| Camp inquiry follow-up | Camp page + inquiry | Parent | Register | Email | 24h | Camp enrollment |
| Enrollment confirmation | `member_program` created | Family | Onboarding | Email | Immediate | First class attended |
| Payment failed | Stripe webhook (future) | Parent | Update card | Email | Immediate | Recovery rate |
| At-risk family | 3 absences in 14d (future) | Staff | Retention call | Admin task | Rolling | Re-enrollment |
| Monthly SEO digest | Cron monthly | Owner | Prioritize content | Email | 1st of month | Keyword clicks ↑ |

**v1 automation (no new ESP required):** Use existing email (`TEAM_EMAIL`) + admin notifications; integrate Mailchimp/SendGrid in Phase 3.

---

## Step 12: Reporting & Exports

| Report | Metrics | Filters | Charts | CSV fields | Frequency | Decision |
|--------|---------|---------|--------|------------|-----------|----------|
| Executive summary | Traffic, inquiries, enrollments, fill % | Date | KPI + trends | All KPIs | Weekly | Owner priorities |
| Website performance | Sessions, top pages, CTA clicks | Host | Bar | page_path, views | Monthly | UX investments |
| SEO performance | Queries, clicks, position | Property | Table | query, clicks, ctr | Monthly | Content plan |
| Inquiry report | Count, source, contacted % | Program | Funnel | Full inquiry row | Weekly | Sales staffing |
| Enrollment report | New/dropped | Program | Line | member_program | Weekly | Class planning |
| Class capacity | Fill %, open spots | Iteration | Heatmap | program, capacity, enrolled | Weekly | Schedule changes |
| Campaign performance | UTMs, CPL | Campaign | Table | utm_*, inquiries | Per campaign | Budget |
| Competitor comparison | Ratings, gaps | — | Table | competitor fields | Quarterly | Positioning |
| At-risk families | Rules hits | Program | List | family, reason | Weekly | Retention calls |

**Export endpoint:** `GET /api/admin/analytics/export?reportType=inquiries&from=&to=` → CSV matching admin column needs.

---

## Step 13: Implementation Roadmap

### Phase 1: Fix broken analytics foundation (4–6 weeks)

| Task | Impact | Effort | Dependencies | Owner | Acceptance criteria |
|------|--------|--------|--------------|-------|---------------------|
| DB: `analytics_events`, `visitor_sessions`, `consent_records` | High | M | Postgres | Backend | Tables migrate on deploy |
| `POST /api/analytics/event` + client batching | High | M | DB | Full-stack | Events persist server-side |
| Cookie banner + Consent Mode v2 | High | M | Legal copy | Frontend | GA4 fires only after analytics consent |
| UTM capture + store on inquiry | High | S | Event client | Full-stack | New inquiries show source in admin |
| Replace AdminAnalytics with Overview API | High | L | APIs | Frontend | Dashboard shows real inquiry + traffic counts |
| Instrument P0 events | High | M | Event client | Frontend | Funnel steps 1–5 measurable |
| Date filters + CSV export (inquiries) | Med | S | APIs | Frontend | Owner exports last 30d inquiries |
| Deprecate localStorage analytics read path | Med | S | Server events | Frontend | Admin no longer uses LS metrics |

### Phase 2: Business intelligence dashboards (6–8 weeks)

| Task | Impact | Effort | Dependencies |
|------|--------|--------|--------------|
| Programs & capacity dashboard | High | M | `member_program`, `program` |
| Lead funnel API + UI | High | L | Events + registrations |
| `lead_status` on registrations | Med | S | DB migration |
| Identity stitch email → inquiry | High | M | `visitor_identities` |
| Enrollment + inquiry joined reports | High | M | Phase 1 |
| Admin audit log for exports | Med | S | `audit_log` table |

### Phase 3: SEO & marketing attribution (4–6 weeks)

| Task | Impact | Effort | Dependencies |
|------|--------|--------|--------------|
| GA4 Data API → admin traffic widgets | High | M | Service account |
| GSC API sync job | High | M | Google OAuth |
| GTM container **[optional]** | Med | M | Marketing |
| Campaign registry + CPL metrics | Med | M | Ad spend manual entry |
| Server-side conversion for ads **[if consented]** | Med | L | GTM server |

### Phase 4: Competitor intelligence (3–4 weeks)

| Task | Impact | Effort | Dependencies |
|------|--------|--------|--------------|
| Competitors CRUD + snapshots | Med | M | Manual process |
| Comparison UI | Med | S | Phase 4 DB |
| Quarterly review workflow doc | Low | S | Ops |

### Phase 5: Marketing automation & retention (ongoing)

| Task | Impact | Effort | Dependencies |
|------|--------|--------|--------------|
| ESP integration | High | L | Vendor choice |
| Stripe + revenue dashboard | High | XL | Billing module |
| Attendance + at-risk rules | High | L | Attendance module |
| Retargeting audiences (consent-only) | Med | M | Phase 3 |

---

## Step 14: Acceptance Criteria for Completion

### Phase 1 done when:

- [ ] Admin Overview shows **server-sourced** metrics (not localStorage).
- [ ] Public site collects events with consent; GA4 respects Consent Mode.
- [ ] New inquiries store **UTM + landing page + visitor_id**.
- [ ] Owner can export inquiries CSV with attribution columns.
- [ ] P0 event catalog firing in production (verify via `analytics_events` row counts).

### Phase 2 done when:

- [ ] Funnel dashboard matches manual spot-check (±2%) for 30-day window.
- [ ] Program capacity widget matches `AdminEnrollments` totals.
- [ ] “Inquired but not enrolled” list available by email match.

### Phase 3 done when:

- [ ] GSC top queries visible in admin (last 28 days).
- [ ] GA4 sessions chart aligns with GA4 UI (±10%).
- [ ] Campaign table shows inquiries per `utm_campaign`.

### Full program done when:

- [ ] All dashboard sections implemented or explicitly marked “awaiting billing/attendance.”
- [ ] Privacy policy + cookie policy published; consent logs retained.
- [ ] Role-based access documented and enforced for PII exports.
- [ ] Competitor module uses manual/public data only with source attribution.

---

## Appendix A: Immediate fixes (can ship before Phase 1)

1. **Label the current tab honestly:** Rename to “Browser Activity (This Device Only)” until server analytics ships.
2. **Wire `trackEngagement('button_click', ...)`** on primary CTAs for interim signal.
3. **Show inquiry KPIs** in Analytics via existing `GET /api/admin/registrations` (quick win).
4. **Pass UTMs** from `window.location.search` into `ContactForm` submit payload.

## Appendix B: Key file references

| File | Role |
|------|------|
| `src/components/AdminAnalytics.tsx` | Current analytics UI |
| `src/utils/analytics.ts` | localStorage tracking |
| `src/utils/googleAnalytics.ts` | GA4 SPA pageviews |
| `src/App.tsx` | Skips tracking for admin/member |
| `backend/server.js` | No analytics routes; registrations/members/enrollments |
| `src/components/AdminInquiries.tsx` | Inquiry ops (contacted, notes) |

---

*Document version: 2026-06-01. Assumptions marked inline. Update when billing, attendance, or GSC integrations land.*
