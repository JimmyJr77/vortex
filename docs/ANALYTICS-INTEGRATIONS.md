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
| `GSC_SITE_URL` | Search Console property URL, e.g. `sc-domain:vortexathletics.com` or `https://vortexathletics.com/` |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Raw service account JSON for GA4 Data API and legacy Search Console authentication |

Grant the service account:

- **GA4:** Property → Admin → Property access management → Viewer (or Analyst)
- **Search Console:** Settings → Users and permissions → Full or Restricted user

### Keyless Search Console authentication on Render

On a Render workspace that supports [managed OIDC](https://render.com/docs/oidc),
configure a Google Workload Identity Pool provider for the workspace and grant
the backend service’s exact Render subject `roles/iam.workloadIdentityUser` on the
service account with Search Console access. Enable the IAM, Security Token
Service, IAM Service Account Credentials, and Search Console APIs.

Set `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT_EMAIL` on the
backend service, optionally set `GOOGLE_CLOUD_PROJECT` to the project ID, and
redeploy. Render generates the credential file and sets
`GOOGLE_APPLICATION_CREDENTIALS` to its path. Search Console uses that file
first and falls back to raw JSON when no file path is set. GA4 Data API sync
continues to use `GOOGLE_APPLICATION_CREDENTIALS_JSON`.

## Manual sync

Admins can run **Sync GA4 / GSC** in the portal (`POST /api/admin/analytics/sync`) to refresh the latest 28 days of external data. First-party traffic and engagement reports read directly from stored events.

In **Marketing & SEO**, select **Check search visibility** for a live Search
Console report on the six Vortex search topics. It queries each topic separately
over 28 finalized Pacific dates, so the dashboard’s cached top-keyword limit
does not determine which topics appear. The selected dashboard filters apply to
the cached reports. The topic report uses the configured Search Console property
and its own fixed date window.

Choose **Queries without the Vortex name** to exclude searches that mention
Vortex or the current or retired site name. Use the same scope when comparing
time periods. Searches for program names such as Fit & Flip can still appear.

Choose **Top reported pages by clicks** to see up to five pages per topic for
the same date window and query scope. Google typically attributes performance to
its selected canonical URL. These rows represent Google's reported pages and
should be compared with the intended program pages. Query strings and unknown
paths are hidden in the report.

Choose **Landing page visibility** to compare Google-reported impressions for
the homepage, current program and guide pages, and the former `/vortex-athletics`
URL across two finalized 28-day periods. Read the former URL alongside
`/fit-and-flip` while Google recrawls the redirect. Google generally assigns
impressions to its selected canonical URL, so the former URL may have data only
in the earlier period. The table includes all web queries. It displays
**No data reported** when Google omits a row and calculates the change when both
periods have an impression count.

Compare the **Property total (all URLs)** row with the listed pages when
landing-page results are empty. It uses a separate, unfiltered Google Web
Search query for each of the same periods. This distinguishes activity
elsewhere on the property from a period with no reportable property data.

An empty topic means Google returned no reportable data for its query filter.
Google can omit some search terms, and topic filters overlap, so do not add the
topic counts together. The report shows missing configuration and provider
errors separately from empty results.

## Cached tables

- `analytics_daily_traffic` — daily sessions/users/page views (first-party rollup + GA4 when configured)
- `seo_keywords` / `seo_rankings` — GSC query/page metrics

## Privacy

**Analytics & Engagement** uses consented browser events in PostgreSQL. Traffic reports show first-touch attribution for the session, landing/exit pages, device, and conversions. Engagement includes active time in the visible tab (counting up to 30 seconds since the last activity), scroll milestones, contact links, program interest, and page speed. Web Vitals use the [standard web-vitals library](https://github.com/GoogleChrome/web-vitals) for the initial document navigation. Reports show the 75th percentile and sample size; shorter visits and unsupported metrics may have no measured time or vitals.

The booking funnels distinguish trial availability and registration attempts from confirmed trials, drop-ins, enrollments, and store orders. Hosted checkout is counted when the app can verify a completed order; browser figures may omit visitors who declined analytics or did not return from the payment provider. Use operational records for financial totals.

Analytics event payloads contain no form fields, child attributes, raw URL queries, invite tokens, or payment identifiers. A visitor can withdraw consent via Cookie settings, which clears the first-party identifiers, stops collection, and drops queued data. Staff sessions are excluded. Date filters use the gym’s Eastern calendar days. New event types populate after release; they are not backfilled.
