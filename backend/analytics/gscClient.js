import { sanitizeAnalyticsPath } from './eventContract.js'

const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const SEARCH_PAGES_PER_TOPIC = 5

function searchConsoleConfigurationIssue(env) {
  if (!env.GSC_SITE_URL?.trim()) return 'missing_property'
  if (!env.GOOGLE_APPLICATION_CREDENTIALS?.trim() && !env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim()) {
    return 'missing_credentials'
  }
  return null
}

export function isSearchConsoleConfigured(env = process.env) {
  return searchConsoleConfigurationIssue(env) === null
}

function createSearchConsoleAuth(google) {
  const options = { scopes: [SEARCH_CONSOLE_SCOPE] }

  // Render supplies a credential file for Workload Identity Federation.
  // Allow GoogleAuth to read and refresh that identity via ADC.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
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

async function loadSearchConsoleGoogle() {
  try {
    return (await import('googleapis')).google
  } catch {
    return null
  }
}

function createSearchConsoleClient(google) {
  return google.searchconsole({ version: 'v1', auth: createSearchConsoleAuth(google) })
}

export async function syncGscRankings(pool) {
  if (!isSearchConsoleConfigured()) {
    return { skipped: 'GSC_SITE_URL or credentials not set' }
  }

  const google = await loadSearchConsoleGoogle()
  if (!google) return { skipped: 'googleapis package not installed' }
  const searchconsole = createSearchConsoleClient(google)
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

const YOUTH = "(?:youth|kids?['’]?|child(?:ren|['’]s)?|teens?|juniors?)"
const VORTEX_NAME_QUERY = String.raw`(?i)(?:^|[^a-z0-9])vortex(?:athletics|gymnastics)?(?:$|[^a-z0-9])`

function youthQueryExpression(activity) {
  return `(?i)\\b(?:${YOUTH}[ -]+${activity}|${activity}(?:[ -]+class(?:es)?)?[ -]+for[ -]+${YOUTH})\\b`
}

const SEARCH_TOPICS = [
  {
    id: 'youth-athletics',
    label: 'Youth Athletics',
    expression: youthQueryExpression('athletic(?:s|[ -]+(?:training|development|performance))'),
  },
  { id: 'youth-gymnastics', label: 'Youth Gymnastics', expression: youthQueryExpression('gymnastics') },
  {
    id: 'athleticism-development',
    label: 'Athleticism Development',
    expression: String.raw`(?i)\b(?:athleticism[ -]+(?:development|training)|develop(?:ing|ment[ -]+of)?[ -]+athleticism|(?:athletic|athlete)[ -]+development)\b`,
  },
  { id: 'youth-sports', label: 'Youth Sports', expression: youthQueryExpression('sports?') },
  {
    id: 'youth-fitness',
    label: 'Youth Fitness',
    expression: youthQueryExpression('(?:fitness|conditioning|strength[ -]+(?:and[ -]+|&[ -]+)?conditioning)'),
  },
  {
    id: 'adult-gymnastics',
    label: 'Adult Gymnastics',
    expression: String.raw`(?i)\b(?:adults?[ -]+gymnastics|gymnastics(?:[ -]+class(?:es)?)?[ -]+for[ -]+adults?)\b`,
  },
]

const TIME_ZONE = 'America/Los_Angeles'
const pacificDate = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric',
})

function topicDateWindow(now) {
  const fields = Object.fromEntries(pacificDate.formatToParts(now).map(({ type, value }) => [type, value]))
  const date = new Date(Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day)))
  // Use the Pacific calendar for the three-day reporting delay.
  date.setUTCDate(date.getUTCDate() - 3)
  const endDate = date.toISOString().slice(0, 10)
  date.setUTCDate(date.getUTCDate() - 27)
  return { startDate: date.toISOString().slice(0, 10), endDate, timeZone: TIME_ZONE }
}

function searchConsoleErrorReason(error) {
  const httpStatus = Number(error?.response?.status ?? error?.status ?? error?.code)
  const providerStatus = error?.response?.data?.error?.status
  const providerReason = error?.response?.data?.error?.errors?.[0]?.reason
  if (providerStatus === 'RESOURCE_EXHAUSTED' || /limit|quota/i.test(providerReason ?? '')) return 'provider_error'
  return httpStatus === 401 || httpStatus === 403 || providerStatus === 'UNAUTHENTICATED' || providerStatus === 'PERMISSION_DENIED'
    ? 'access_denied'
    : 'provider_error'
}

function topicMetrics({ clicks, impressions, position }) {
  if (!Number.isFinite(clicks) || clicks < 0 || !Number.isFinite(impressions) || impressions < 0) {
    throw new Error('Unexpected Search Console metrics')
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : null,
    position: impressions > 0 && Number.isFinite(position) ? position : null,
  }
}

function readReportedPage(row) {
  const url = new URL(row.keys?.[0])
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Unexpected Search Console page URL')
  }
  const path = sanitizeAnalyticsPath(url.pathname)
  return {
    page: path && path !== '/other' ? `${url.origin}${path}` : null,
    metrics: topicMetrics(row),
  }
}

async function fetchTopic(searchconsole, siteUrl, { startDate, endDate, scope, view }, { id, label, expression }) {
  const filters = [{ dimension: 'query', operator: 'includingRegex', expression }]
  if (scope === 'without_vortex') {
    filters.push({ dimension: 'query', operator: 'excludingRegex', expression: VORTEX_NAME_QUERY })
  }
  const groupByPage = view === 'pages'
  const rowLimit = groupByPage ? SEARCH_PAGES_PER_TOPIC : 1
  try {
    const { data } = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        type: 'web',
        dataState: 'final',
        ...(groupByPage ? { aggregationType: 'auto', dimensions: ['page'] } : { aggregationType: 'byProperty' }),
        dimensionFilterGroups: [{ groupType: 'and', filters }],
        rowLimit,
      },
    }, { timeout: 10000, retry: false })

    const rows = data.rows ?? []
    if (!Array.isArray(rows) || rows.length > rowLimit) throw new Error('Unexpected Search Console rows')
    if (!rows.length) return { id, label, status: 'no_data', metrics: null }
    if (groupByPage) {
      return { id, label, status: 'reported', metrics: null, pages: rows.map(readReportedPage) }
    }
    return { id, label, status: 'reported', metrics: topicMetrics(rows[0]) }
  } catch (error) {
    return { id, label, status: 'error', metrics: null, reason: searchConsoleErrorReason(error) }
  }
}

/** Fetch totals or reported pages for each search topic independently. */
export async function getSearchConsoleTopics(now = new Date(), scope = 'all', view = 'totals') {
  const window = { ...topicDateWindow(now), scope, view }
  const unavailable = (status, reason) => ({
    ...window, status, reason,
    topics: SEARCH_TOPICS.map(({ id, label }) => ({ id, label, status: 'unavailable', metrics: null })),
  })

  const missing = searchConsoleConfigurationIssue(process.env)
  if (missing) return unavailable('unconfigured', missing)

  let searchconsole
  try {
    const google = await loadSearchConsoleGoogle()
    if (!google) return unavailable('error', 'provider_error')
    searchconsole = createSearchConsoleClient(google)
  } catch (error) {
    return unavailable('error', searchConsoleErrorReason(error))
  }

  const siteUrl = process.env.GSC_SITE_URL.trim()
  const topics = await Promise.all(SEARCH_TOPICS.map(topic => fetchTopic(searchconsole, siteUrl, window, topic)))
  const failures = topics.filter(topic => topic.status === 'error')
  if (failures.length === topics.length) {
    const reason = failures.every(topic => topic.reason === 'access_denied') ? 'access_denied' : 'provider_error'
    return { ...window, status: 'error', reason, topics }
  }
  return { ...window, status: failures.length ? 'partial' : 'ok', topics }
}
