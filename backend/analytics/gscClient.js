/**
 * Google Search Console sync (optional). Requires googleapis + GSC_SITE_URL.
 */

export async function syncGscRankings(pool) {
  let google
  try {
    const mod = await import('googleapis')
    google = mod.google
  } catch {
    return { skipped: 'googleapis package not installed' }
  }

  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  const siteUrl = process.env.GSC_SITE_URL
  if (!credsJson || !siteUrl) {
    return { skipped: 'Missing GSC env' }
  }

  const credentials = JSON.parse(credsJson)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })
  const webmasters = google.webmasters({ version: 'v3', auth })
  const searchconsole = google.searchconsole({ version: 'v1', auth })

  const end = new Date()
  const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000)

  let response
  try {
    response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        dimensions: ['query', 'page', 'date'],
        rowLimit: 500,
      },
    })
  } catch {
    response = await webmasters.searchanalytics.query({
      siteUrl,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ['query', 'page', 'date'],
      rowLimit: 500,
    })
  }

  let rows = 0
  for (const row of response.data.rows || []) {
    const [query, page, date] = row.keys
    const existing = await pool.query(
      `SELECT id FROM seo_keywords WHERE query = $1 AND page IS NOT DISTINCT FROM $2 LIMIT 1`,
      [query, page],
    )
    let keywordId = existing.rows[0]?.id
    if (!keywordId) {
      const ins = await pool.query(
        `INSERT INTO seo_keywords (query, page) VALUES ($1, $2) RETURNING id`,
        [query, page],
      )
      keywordId = ins.rows[0]?.id
    }
    if (!keywordId) continue

    await pool.query(
      `INSERT INTO seo_rankings (keyword_id, date, impressions, clicks, position, ctr)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (keyword_id, date) DO UPDATE SET
         impressions = EXCLUDED.impressions,
         clicks = EXCLUDED.clicks,
         position = EXCLUDED.position,
         ctr = EXCLUDED.ctr`,
      [
        keywordId,
        date,
        row.impressions,
        row.clicks,
        row.position,
        row.ctr,
      ],
    )
    rows++
  }

  return { rowsSynced: rows }
}
