/**
 * GA4 Data API sync (optional). Requires:
 * - npm package googleapis
 * - GA4_PROPERTY_ID
 * - GOOGLE_APPLICATION_CREDENTIALS_JSON (service account JSON string)
 */

export async function syncGa4Daily(pool) {
  let google
  try {
    const mod = await import('googleapis')
    google = mod.google
  } catch {
    return { skipped: 'googleapis package not installed' }
  }

  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  const propertyId = process.env.GA4_PROPERTY_ID
  if (!credsJson || !propertyId) {
    return { skipped: 'Missing GA4 env' }
  }

  const credentials = JSON.parse(credsJson)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  })
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth })

  const end = new Date()
  const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000)
  const format = (d) => d.toISOString().slice(0, 10).replace(/-/g, '')

  const response = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: format(start), endDate: format(end) }],
      dimensions: [{ name: 'date' }, { name: 'hostName' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
      ],
    },
  })

  let rows = 0
  for (const row of response.data.rows || []) {
    const dateRaw = row.dimensionValues[0].value
    const date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
    const hostname = row.dimensionValues[1]?.value || 'unknown'
    const sessions = parseInt(row.metricValues[0].value, 10)
    const users = parseInt(row.metricValues[1].value, 10)
    const pageViews = parseInt(row.metricValues[2].value, 10)

    await pool.query(
      `INSERT INTO analytics_daily_traffic (date, hostname, source, sessions, users, page_views)
       VALUES ($1, $2, 'ga4', $3, $4, $5)
       ON CONFLICT (date, hostname, source) DO UPDATE SET
         sessions = EXCLUDED.sessions, users = EXCLUDED.users, page_views = EXCLUDED.page_views`,
      [date, hostname, sessions, users, pageViews],
    )
    rows++
  }

  return { rowsSynced: rows }
}
