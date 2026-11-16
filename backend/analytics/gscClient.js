const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

export function isSearchConsoleConfigured(env = process.env) {
  return Boolean(env.GSC_SITE_URL &&
    (env.GOOGLE_APPLICATION_CREDENTIALS || env.GOOGLE_APPLICATION_CREDENTIALS_JSON))
}

function createSearchConsoleAuth(google) {
  const options = { scopes: [SEARCH_CONSOLE_SCOPE] }

  // Render supplies a credential file for Workload Identity Federation.
  // Allow GoogleAuth to read and refresh that identity via ADC.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (process.env.GOOGLE_CLOUD_PROJECT) options.projectId = process.env.GOOGLE_CLOUD_PROJECT
  } else {
    try {
      options.credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    } catch {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON must be valid JSON')
    }
  }

  return new google.auth.GoogleAuth(options)
}

export async function syncGscRankings(pool) {
  if (!isSearchConsoleConfigured()) {
    return { skipped: 'GSC_SITE_URL or credentials not set' }
  }

  let google
  try {
    const mod = await import('googleapis')
    google = mod.google
  } catch {
    return { skipped: 'googleapis package not installed' }
  }

  const searchconsole = google.searchconsole({ version: 'v1', auth: createSearchConsoleAuth(google) })
  const end = new Date()
  const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000)
  const response = await searchconsole.searchanalytics.query({
    siteUrl: process.env.GSC_SITE_URL,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ['query', 'page', 'date'],
      rowLimit: 500,
    },
  })

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
