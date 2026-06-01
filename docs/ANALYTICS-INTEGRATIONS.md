# Analytics integrations (GA4 & Search Console)

Server-side sync is optional. The admin **Marketing & SEO** tab works with first-party data even when Google APIs are not configured.

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
