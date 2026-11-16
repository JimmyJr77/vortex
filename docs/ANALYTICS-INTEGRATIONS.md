# Analytics integrations (GA4, GTM & Search Console)

Server-side sync is optional. The admin **Marketing & SEO** tab works with first-party data even when Google APIs are not configured.

## Client-side tags (index.html)

The inline defaults run on every public page. On Vortex domains, the optional Google scripts load only after the visitor grants analytics or marketing consent:

1. **Consent Mode v2 defaults** — inline script pushes `consent default: denied` to the
   `dataLayer` *before* any Google script loads. The cookie banner
   (`CookieConsent.tsx` → `updateGoogleConsent`) upgrades consent at runtime; GTM tags
   with built-in consent checks respect it automatically. The same early block enables
   URL passthrough and cross-domain linking, and redacts ad-click data while advertising
   storage is denied.
2. **Google Tag Manager** — container `GTM-T38PSLXX`. No pre-consent iframe.
3. **GA4 gtag.js (direct)** — property `G-XDE178DQWY`, `send_page_view: false`; SPA route
   changes are reported by `trackGooglePageView` (`src/utils/googleAnalytics.ts`).

### Rules to avoid double-tracking

- **Do NOT add a GA4 Google Tag for `G-XDE178DQWY` inside the GTM container.** GA4 is
  loaded directly via gtag.js; a duplicate tag in GTM would double-count every page view
  and event. Use GTM for non-GA4 tags (ads pixels, remarketing, etc.).
- In the GA4 web stream's Enhanced Measurement settings, turn off **Page changes based on browser history events** under Page views. The app already sends its own `page_view`; setting `send_page_view: false` alone does not turn off history-based page views. See [Google's manual pageview guide](https://developers.google.com/analytics/devguides/collection/ga4/views#disable_page_changes_based_on_browser_history_events).

### SPA page views in GTM

This is a single-page app, so GTM's "Initialization / Page View" trigger fires once per
full load only. `trackGooglePageView` also pushes a `spa_page_view` event (with
`page_path`, `page_location`, `page_title`) to the `dataLayer` on every client-side route
change after analytics consent. Use this custom event for tags that need the sanitized path; avoid enabling a second trigger for the same tag.

## Environment variables (Render / backend)

| Variable | Description |
|----------|-------------|
| `GA4_PROPERTY_ID` | Numeric GA4 property ID (Admin → Property settings) |
| `GSC_SITE_URL` | Search Console property URL, e.g. `sc-domain:vortexathletics.com` or `https://www.vortexathletics.com/` |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Full service account JSON (single line or base64) with access to GA4 Data API and Search Console |

Grant the service account:

- **GA4:** Property → Admin → Property access management → Viewer (or Analyst)
- **Search Console:** Settings → Users and permissions → Full or Restricted user

## Manual sync

Admins can run **Sync GA4 / GSC** in the portal (`POST /api/admin/analytics/sync`) to refresh the latest 28 days of external data. First-party traffic and engagement reports read directly from stored events.

## Cached tables

- `analytics_daily_traffic` — daily sessions/users/page views (first-party rollup + GA4 when configured)
- `seo_keywords` / `seo_rankings` — GSC query/page metrics

## Privacy

**Analytics & Engagement** uses consented browser events in PostgreSQL. Traffic reports show first-touch attribution for the session, landing/exit pages, device, and conversions. Engagement includes active time in the visible tab (counting up to 30 seconds since the last activity), scroll milestones, contact links, program interest, and page speed. Web Vitals use the [standard web-vitals library](https://github.com/GoogleChrome/web-vitals) for the initial document navigation. Reports show the 75th percentile and sample size; shorter visits and unsupported metrics may have no measured time or vitals.

The booking funnels distinguish trial availability and registration attempts from confirmed trials, drop-ins, enrollments, and store orders. Hosted checkout is counted when the app can verify a completed order; browser figures may omit visitors who declined analytics or did not return from the payment provider. Use operational records for financial totals.

Analytics event payloads contain no form fields, child attributes, raw URL queries, invite tokens, or payment identifiers. A visitor can withdraw consent via Cookie settings, which clears the first-party identifiers, stops collection, and drops queued data. Staff sessions are excluded. Date filters use the gym’s Eastern calendar days. New event types populate after release; they are not backfilled.
