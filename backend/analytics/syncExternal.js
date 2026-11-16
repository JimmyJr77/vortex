/** Sync first-party aggregates; optional GA4/GSC when credentials are configured. */

export async function syncExternalAnalytics(pool) {
  const result = {
    firstParty: null,
    ga4: null,
    gsc: null,
  }

  const fp = await pool.query(`
    WITH page_views AS MATERIALIZED (
      SELECT (occurred_at AT TIME ZONE 'America/New_York')::date AS date,
             REGEXP_REPLACE(LOWER(hostname), '^www[.]', '') AS hostname,
             session_id, visitor_id
      FROM analytics_events
      WHERE event_name = 'page_view' AND consent_analytics IS TRUE AND is_staff IS NOT TRUE
        AND occurred_at >= now() - interval '90 days' AND hostname IS NOT NULL
        AND visitor_id NOT IN ('anonymous', '') AND session_id NOT IN ('anonymous', '')
        AND page_path !~ '^/(admin|new-admin|member|coach|payroll)(/|$)'
    )
    INSERT INTO analytics_daily_traffic (date, hostname, source, sessions, users, page_views)
    SELECT date, hostname, 'first_party',
           COUNT(DISTINCT (session_id, visitor_id))::int,
           COUNT(DISTINCT visitor_id)::int, COUNT(*)::int
    FROM page_views GROUP BY date, hostname
    ON CONFLICT (date, hostname, source) DO UPDATE SET
      sessions = EXCLUDED.sessions,
      users = EXCLUDED.users,
      page_views = EXCLUDED.page_views
  `)
  result.firstParty = { rowsUpdated: fp.rowCount }

  if (process.env.GA4_PROPERTY_ID && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      const { syncGa4Daily } = await import('./ga4Client.js')
      result.ga4 = await syncGa4Daily(pool)
    } catch (e) {
      result.ga4 = { error: e.message }
    }
  } else {
    result.ga4 = { skipped: 'GA4_PROPERTY_ID or GOOGLE_APPLICATION_CREDENTIALS_JSON not set' }
  }

  if (process.env.GSC_SITE_URL && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      const { syncGscRankings } = await import('./gscClient.js')
      result.gsc = await syncGscRankings(pool)
    } catch (e) {
      result.gsc = { error: e.message }
    }
  } else {
    result.gsc = { skipped: 'GSC_SITE_URL or credentials not set' }
  }

  return result
}
