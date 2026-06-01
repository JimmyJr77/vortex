/** Sync first-party aggregates; optional GA4/GSC when credentials are configured. */

export async function syncExternalAnalytics(pool) {
  const result = {
    firstParty: null,
    ga4: null,
    gsc: null,
  }

  const fp = await pool.query(`
    INSERT INTO analytics_daily_traffic (date, hostname, source, sessions, users, page_views)
    SELECT DATE(started_at) AS date,
      COALESCE(hostname, 'unknown'),
      'first_party',
      COUNT(*)::int,
      COUNT(DISTINCT visitor_id)::int,
      (SELECT COUNT(*)::int FROM analytics_events ae
        WHERE ae.event_name = 'page_view'
        AND DATE(ae.occurred_at) = DATE(vs.started_at)
        AND COALESCE(ae.hostname, 'unknown') = COALESCE(vs.hostname, 'unknown')
        AND ae.is_staff IS NOT TRUE)
    FROM visitor_sessions vs
    WHERE vs.started_at >= now() - interval '90 days' AND vs.is_staff IS NOT TRUE
    GROUP BY DATE(started_at), COALESCE(hostname, 'unknown')
    ON CONFLICT (date, hostname, source) DO UPDATE SET
      sessions = EXCLUDED.sessions,
      users = EXCLUDED.users,
      page_views = EXCLUDED.page_views
    RETURNING COUNT(*)::int AS rows
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
