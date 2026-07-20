# Analytics integrations (GA4, GTM & Search Console)

Server-side sync is optional. The admin **Marketing & SEO** tab works with first-party data even when Google APIs are not configured.

## Client-side tags (index.html)

Loaded on every page, in this order (order matters):

1. **Consent Mode v2 defaults** — inline script pushes `consent default: denied` to the
   `dataLayer` *before* any Google script loads. The cookie banner
   (`CookieConsent.tsx` → `updateGoogleConsent`) upgrades consent at runtime; GTM tags
   with built-in consent checks respect it automatically.
2. **Google Tag Manager** — container `GTM-T38PSLXX` (plus the `<noscript>` iframe after
   `<body>`).
3. **GA4 gtag.js (direct)** — property `G-XDE178DQWY`, `send_page_view: false`; SPA route
   changes are reported by `trackGooglePageView` (`src/utils/googleAnalytics.ts`).

### Rules to avoid double-tracking

- **Do NOT add a GA4 Google Tag for `G-XDE178DQWY` inside the GTM container.** GA4 is
  loaded directly via gtag.js; a duplicate tag in GTM would double-count every page view
  and event. Use GTM for non-GA4 tags (ads pixels, remarketing, etc.).
- Any additional GA4 property tag added in GTM will also double-count unless the direct
  gtag snippet is removed at the same time.

### SPA page views in GTM

This is a single-page app, so GTM's "Initialization / Page View" trigger fires once per
full load only. `trackGooglePageView` also pushes a `spa_page_view` event (with
`page_path`, `page_location`, `page_title`) to the `dataLayer` on every client-side route
change — use a **Custom Event trigger on `spa_page_view`** (or the built-in History
Change trigger) for tags that must fire per route.

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

Admins can run **Sync GA4 / GSC** in the portal (`POST /api/admin/analytics/sync`). On server startup, a best-effort sync also runs when credentials are present.

## Cached tables

- `analytics_daily_traffic` — daily sessions/users/page views (first-party rollup + GA4 when configured)
- `seo_keywords` / `seo_rankings` — GSC query/page metrics

## Privacy

Public event collection requires analytics cookie consent. GA4 uses Consent Mode v2 (default denied until the user opts in).
