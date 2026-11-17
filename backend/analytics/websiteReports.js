import { actionNames, conversionNames, intentNames, publicPaths, sanitizeHostname } from './eventContract.js'

const dateAtFacility = (timestamp) => `(${timestamp} AT TIME ZONE 'America/New_York')::date`
const allowedPaths = [...publicPaths]
const normalizeHostname = (col) => `REGEXP_REPLACE(LOWER(${col}), '^www\\.', '')`
const routePath = "LOWER(RTRIM(SPLIT_PART(SPLIT_PART(ae.page_path, '?', 1), '#', 1), '/'))"

function websiteParams({ from, to }, hostname) {
  return [from, to, sanitizeHostname(hostname), allowedPaths, actionNames, conversionNames]
}

// All report clocks and identities use the same scope. Exclude legacy anonymous/staff rows.
const eligibleEvents = `
  SELECT ae.id, ae.event_id, ae.event_name, ae.occurred_at, ae.visitor_id, ae.session_id,
         ${normalizeHostname('ae.hostname')} AS hostname, ae.properties,
         CASE WHEN ${routePath} = '' THEN '/'
              WHEN ${routePath} = ANY($4::text[]) THEN ${routePath}
              ELSE '/other' END AS page_path
  FROM analytics_events ae
  WHERE ae.occurred_at BETWEEN $1 AND $2
    AND ae.consent_analytics IS TRUE AND ae.is_staff IS NOT TRUE
    AND ae.visitor_id NOT IN ('anonymous', '') AND ae.session_id NOT IN ('anonymous', '')
    AND ${routePath} !~ '^/(admin|new-admin|member|coach|payroll)(/|$)'
    AND ae.hostname IS NOT NULL AND ae.hostname <> ''
    AND ($3::text IS NULL OR ae.hostname IN ($3, 'www.' || $3))
`

const pageViews = `
  SELECT *, CASE WHEN properties->>'device_type' IN ('desktop', 'mobile', 'tablet')
                  THEN properties->>'device_type' ELSE 'unknown' END AS device
  FROM events WHERE event_name = 'page_view'
`

const MAX_ACTIVE_MS = 24 * 60 * 60 * 1000
const activeTimes = `
  SELECT pv.hostname, pv.session_id, pv.visitor_id, pv.event_id,
         MAX(LEAST(${MAX_ACTIVE_MS}, (pe.properties->>'engaged_ms')::numeric))::int AS active_ms
  FROM page_views pv
  JOIN events pe ON pe.hostname = pv.hostname AND pe.session_id = pv.session_id
                AND pe.visitor_id = pv.visitor_id AND pe.event_name = 'page_engagement'
                AND pe.properties->>'page_view_id' = pv.event_id::text
  WHERE jsonb_typeof(pe.properties->'engaged_ms') = 'number'
  GROUP BY pv.hostname, pv.session_id, pv.visitor_id, pv.event_id
`

const sessionFacts = `
  SELECT hostname, session_id, visitor_id, COUNT(*)::int AS views,
         (ARRAY_AGG(page_path ORDER BY occurred_at, id))[1] AS landing_page,
         (ARRAY_AGG(page_path ORDER BY occurred_at DESC, id DESC))[1] AS exit_page,
         (ARRAY_AGG(device ORDER BY (device = 'unknown'), occurred_at, id))[1] AS device,
         MIN(occurred_at) AS first_view
  FROM page_views
  GROUP BY hostname, session_id, visitor_id
`

export async function countWebsiteSessions(pool, range, hostname) {
  const { rows: [row] } = await pool.query(`
    WITH events AS (${eligibleEvents})
    SELECT COUNT(DISTINCT (hostname, session_id, visitor_id))::int AS count
    FROM events WHERE event_name = 'page_view'`,
  websiteParams(range, hostname).slice(0, 4))
  return row.count
}

export async function getWebsiteTraffic(pool, range, hostname) {
  const { rows: [row] } = await pool.query(`
    WITH events AS MATERIALIZED (${eligibleEvents}),
    page_views AS MATERIALIZED (${pageViews}),
    view_timing AS (${activeTimes}),
    sessions AS MATERIALIZED (${sessionFacts}),
    visitors AS (
      SELECT DISTINCT visitor_id FROM sessions
    ), known_visitors AS (
      SELECT v.visitor_id FROM visitors v
      WHERE EXISTS (
        SELECT 1 FROM analytics_events a
        WHERE a.visitor_id = v.visitor_id AND a.event_name = 'page_view' AND a.occurred_at < $1
          AND a.consent_analytics IS TRUE AND a.is_staff IS NOT TRUE
      )
    ), session_timing AS (
      SELECT hostname, session_id, visitor_id, SUM(active_ms)::bigint AS active_ms
      FROM view_timing GROUP BY hostname, session_id, visitor_id
    ), session_actions AS (
      SELECT hostname, session_id, visitor_id,
             BOOL_OR(event_name = ANY($6::text[])) AS converted
      FROM events WHERE event_name = ANY($5::text[] || $6::text[])
      GROUP BY hostname, session_id, visitor_id
    ), audience AS MATERIALIZED (
      SELECT s.*, COALESCE(a.converted, false) AS converted, t.active_ms,
             (s.views >= 2 OR COALESCE(t.active_ms >= 10000, false) OR a.session_id IS NOT NULL) AS engaged,
             CASE WHEN TRIM(vs.utm_source) ~ '^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,99}$' THEN TRIM(vs.utm_source) END AS utm_source,
             CASE WHEN TRIM(vs.utm_medium) ~ '^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,99}$' THEN LOWER(TRIM(vs.utm_medium)) END AS utm_medium,
             CASE WHEN TRIM(vs.utm_campaign) ~ '^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,99}$' THEN TRIM(vs.utm_campaign) END AS utm_campaign,
             ${normalizeHostname("SUBSTRING(vs.referrer FROM '^https?://([a-zA-Z0-9.-]+)')")} AS referrer_host
      FROM sessions s
      LEFT JOIN session_actions a USING (hostname, session_id, visitor_id)
      LEFT JOIN session_timing t USING (hostname, session_id, visitor_id)
      LEFT JOIN visitor_sessions vs ON vs.session_id = s.session_id AND vs.visitor_id = s.visitor_id
                                   AND ${normalizeHostname('vs.hostname')} = s.hostname
    ), attributed AS (
      SELECT *,
        CASE
          WHEN utm_medium ~ '(cpc|ppc|paid|display|cpm|cpv)' THEN 'Paid'
          WHEN utm_medium ~ '(email|newsletter)' THEN 'Email'
          WHEN utm_medium ~ '(sms|text)' THEN 'SMS'
          WHEN utm_medium ~ '(social)' THEN 'Organic social'
          WHEN utm_medium = 'organic' THEN 'Organic search'
          WHEN utm_medium = 'referral' THEN 'Referral'
          WHEN utm_medium IS NOT NULL OR utm_campaign IS NOT NULL OR utm_source IS NOT NULL THEN 'Other campaign'
          WHEN referrer_host ~ '(^|\\.)(google\\.[a-z.]+|bing\\.com|yahoo\\.com|duckduckgo\\.com|ecosia\\.org|search\\.brave\\.com)$' THEN 'Organic search'
          WHEN referrer_host ~ '(^|\\.)(instagram\\.com|facebook\\.com|tiktok\\.com|youtube\\.com|reddit\\.com|linkedin\\.com|t\\.co|x\\.com)$' THEN 'Organic social'
          WHEN referrer_host IS NULL OR referrer_host = hostname THEN 'Direct'
          ELSE 'Referral' END AS channel,
        COALESCE(utm_source, NULLIF(referrer_host, hostname), '(direct)') AS source
      FROM audience
    ), totals AS (
      SELECT COUNT(*)::int AS sessions,
             COALESCE(SUM(views), 0)::int AS page_views,
             (SELECT COUNT(*)::int FROM visitors) AS visitors,
             (SELECT COUNT(*)::int FROM known_visitors) AS returning_visitors,
             COUNT(*) FILTER (WHERE engaged)::int AS engaged_sessions,
             COUNT(*) FILTER (WHERE converted)::int AS converting_sessions,
             COUNT(active_ms)::int AS timed_sessions,
             ROUND(AVG(active_ms) / 1000, 1) AS avg_active_seconds
      FROM audience
    ), daily AS (
      SELECT ${dateAtFacility('first_view')}::text AS day,
             COUNT(*)::int AS sessions, COUNT(DISTINCT visitor_id)::int AS visitors
      FROM sessions GROUP BY day
    ), daily_views AS (
      SELECT ${dateAtFacility('occurred_at')}::text AS day, COUNT(*)::int AS page_views
      FROM page_views GROUP BY day
    ), trend AS (
      SELECT COALESCE(v.day, s.day) AS day, COALESCE(v.page_views, 0) AS page_views,
             COALESCE(s.sessions, 0) AS sessions, COALESCE(s.visitors, 0) AS visitors
      FROM daily_views v FULL JOIN daily s USING (day)
    ), top_pages AS (
      SELECT hostname, page_path, COUNT(*)::int AS views,
             COUNT(DISTINCT (visitor_id, session_id))::int AS sessions
      FROM page_views GROUP BY hostname, page_path ORDER BY views DESC, hostname, page_path LIMIT 20
    ), page_paths AS (
      SELECT hostname, landing_page AS page_path, COUNT(*)::int AS entrances,
             COUNT(*) FILTER (WHERE converted)::int AS conversions, 0 AS exits
      FROM audience GROUP BY hostname, landing_page
      UNION ALL
      SELECT hostname, exit_page, 0, 0, COUNT(*)::int
      FROM audience GROUP BY hostname, exit_page
    ), paths AS (
      SELECT hostname, page_path, SUM(entrances)::int AS entrances,
             SUM(exits)::int AS exits, SUM(conversions)::int AS conversions
      FROM page_paths GROUP BY hostname, page_path
      ORDER BY SUM(entrances) + SUM(exits) DESC, hostname, page_path LIMIT 20
    ), devices AS (
      SELECT device, COUNT(*)::int AS sessions, COUNT(*) FILTER (WHERE converted)::int AS conversions
      FROM audience GROUP BY device ORDER BY sessions DESC, device
    ), channels AS (
      SELECT channel, COUNT(*)::int AS sessions, COUNT(*) FILTER (WHERE converted)::int AS conversions
      FROM attributed GROUP BY channel ORDER BY sessions DESC, channel
    ), sources AS (
      SELECT channel, source, utm_medium AS medium, utm_campaign AS campaign,
             COUNT(*)::int AS sessions, COUNT(*) FILTER (WHERE converted)::int AS conversions
      FROM attributed GROUP BY channel, source, utm_medium, utm_campaign
      ORDER BY sessions DESC, channel, source, medium, campaign LIMIT 25
    )
    SELECT TO_JSONB(totals) AS totals,
           COALESCE((SELECT JSONB_AGG(trend ORDER BY day) FROM trend), '[]') AS "pageViewsByDay",
           COALESCE((SELECT JSONB_AGG(top_pages ORDER BY views DESC, hostname, page_path) FROM top_pages), '[]') AS "topPages",
           COALESCE((SELECT JSONB_AGG(paths ORDER BY entrances + exits DESC, hostname, page_path) FROM paths), '[]') AS paths,
           COALESCE((SELECT JSONB_AGG(devices ORDER BY sessions DESC, device) FROM devices), '[]') AS devices,
           COALESCE((SELECT JSONB_AGG(channels ORDER BY sessions DESC, channel) FROM channels), '[]') AS channels,
           COALESCE((SELECT JSONB_AGG(sources ORDER BY sessions DESC, channel, source, medium, campaign) FROM sources), '[]') AS sources
    FROM totals`,
  [...websiteParams(range, hostname).slice(0, 4), intentNames, conversionNames])
  return row
}

const latestVitals = `
  SELECT DISTINCT ON (hostname, session_id, visitor_id, sample, metric)
    hostname, page_path, device, metric, value, session_id, visitor_id, sample
  FROM (
    SELECT hostname, page_path, occurred_at, id, session_id, visitor_id,
           COALESCE(properties->>'page_view_id', event_id::text) AS sample,
           COALESCE(properties->>'device_type', 'unknown') AS device,
           properties->>'name' AS metric, (properties->>'value')::float8 AS value
    FROM events
    WHERE event_name = 'web_vital' AND properties->>'name' IN ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')
      AND jsonb_typeof(properties->'value') = 'number'
  ) samples
  WHERE value BETWEEN 0 AND CASE WHEN metric = 'CLS' THEN 10 ELSE 300000 END
  ORDER BY hostname, session_id, visitor_id, sample, metric, occurred_at DESC, id DESC
`

const p75 = "ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value)::numeric, CASE WHEN metric = 'CLS' THEN 3 ELSE 0 END)"

export async function getWebsiteEngagement(pool, range, hostname) {
  const { rows: [row] } = await pool.query(`
    WITH events AS MATERIALIZED (${eligibleEvents}),
    page_views AS MATERIALIZED (${pageViews}),
    view_timing AS (${activeTimes}),
    vitals AS MATERIALIZED (${latestVitals}),
    action_totals AS (
      SELECT event_name, COUNT(*)::int AS events,
             COUNT(DISTINCT (hostname, session_id, visitor_id))::int AS sessions
      FROM events WHERE event_name = ANY($5::text[] || $6::text[])
      GROUP BY event_name ORDER BY events DESC, event_name
    ), action_targets AS (
      SELECT hostname, page_path, event_name,
             CASE
               WHEN event_name = 'trial_availability'
                 THEN CONCAT_WS(' / ', properties->>'program_slug', properties->>'outcome')
               WHEN event_name = 'program_interest' THEN COALESCE(properties->>'program_slug', properties->>'target')
               ELSE COALESCE(properties->>'target', properties->>'program_slug', properties->>'form_name', properties->>'form')
             END AS target,
             COUNT(*)::int AS events, COUNT(DISTINCT (session_id, visitor_id))::int AS sessions
      FROM events
      WHERE event_name = ANY($5::text[] || $6::text[])
      GROUP BY hostname, page_path, event_name, target
    ), ranked_actions AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY event_name ORDER BY events DESC, hostname, page_path, target) AS action_rank
      FROM action_targets WHERE target ~ '^[a-zA-Z0-9][a-zA-Z0-9 ._/-]{0,164}$'
    ), top_actions AS (
      SELECT hostname, page_path, event_name, target, events, sessions
      FROM ranked_actions WHERE action_rank <= 12
    ), scroll_max AS (
      SELECT pv.event_id, MAX((se.properties->>'percent')::int) AS depth
      FROM page_views pv JOIN events se ON se.hostname = pv.hostname AND se.session_id = pv.session_id
                        AND se.visitor_id = pv.visitor_id AND se.event_name = 'scroll_depth'
                        AND se.properties->>'page_view_id' = pv.event_id::text
      WHERE se.properties->>'percent' IN ('25', '50', '75', '90', '100')
      GROUP BY pv.event_id
    ), scroll AS (
      SELECT percent, COUNT(*) FILTER (WHERE depth >= percent)::int AS views
      FROM (VALUES (25), (50), (75), (90), (100)) milestones(percent)
      LEFT JOIN scroll_max ON true
      GROUP BY percent
    ), timing_pages AS (
      SELECT pv.hostname, pv.page_path, COUNT(*)::int AS views,
             COUNT(vt.event_id)::int AS timed_views,
             ROUND(AVG(vt.active_ms)::numeric / 1000, 1) AS avg_active_seconds,
             COUNT(sm.event_id) FILTER (WHERE sm.depth >= 75)::int AS depth_75_views
      FROM page_views pv
      LEFT JOIN view_timing vt USING (event_id, hostname, visitor_id, session_id)
      LEFT JOIN scroll_max sm USING (event_id)
      GROUP BY pv.hostname, pv.page_path
      ORDER BY views DESC, pv.hostname, pv.page_path LIMIT 20
    ), vital_summary AS (
      SELECT metric, device, COUNT(*)::int AS samples, ${p75} AS p75
      FROM vitals GROUP BY metric, device
    ), vital_pages AS (
      SELECT hostname, page_path, metric, COUNT(*)::int AS samples, ${p75} AS p75
      FROM vitals GROUP BY hostname, page_path, metric
      ORDER BY samples DESC, hostname, page_path, metric LIMIT 30
    )
    SELECT (SELECT COUNT(*)::int FROM page_views) AS "pageViews",
           (SELECT COUNT(*)::int FROM view_timing) AS "timedViews",
           COALESCE((SELECT JSONB_AGG(action_totals ORDER BY events DESC, event_name) FROM action_totals), '[]') AS actions,
           COALESCE((SELECT JSONB_AGG(top_actions ORDER BY events DESC, event_name, hostname, page_path, target) FROM top_actions), '[]') AS "topActions",
           COALESCE((SELECT JSONB_AGG(scroll ORDER BY percent) FROM scroll), '[]') AS scroll,
           COALESCE((SELECT JSONB_AGG(timing_pages ORDER BY views DESC, hostname, page_path) FROM timing_pages), '[]') AS pages,
           COALESCE((SELECT JSONB_AGG(vital_summary ORDER BY metric, device) FROM vital_summary), '[]') AS vitals,
           COALESCE((SELECT JSONB_AGG(vital_pages ORDER BY samples DESC, hostname, page_path, metric) FROM vital_pages), '[]') AS "vitalPages"`,
  websiteParams(range, hostname))
  return row
}

const journeys = [
  { name: 'Inquiry', steps: [
    ['inquiry_form_start', 'Inquiry started'],
    ['inquiry_form_submit', 'Submit attempted'],
    ['generate_lead', 'Inquiry received'],
  ] },
  { name: 'Free trial', steps: [
    ['trial_start', 'Trial opened'],
    ['trial_class_select', 'Class selected'],
    ['trial_registration_start', 'Registration started'],
    ['trial_confirm_submit', 'Confirmation attempted'],
    ['trial_confirmed', 'Trial confirmed'],
  ] },
  { name: 'Drop-in', steps: [
    ['drop_in_start', 'Drop-in started'],
    ['drop_in_confirmed', 'Drop-in confirmed'],
  ] },
  { name: 'Family account', steps: [
    ['sign_up_start', 'Account setup started'],
    ['sign_up', 'Account created'],
  ] },
  { name: 'Class enrollment checkout', steps: [
    ['begin_checkout', 'Enrollment checkout started'],
    ['enrollment_confirmed', 'Enrollment confirmed'],
  ] },
  { name: 'Online store', steps: [
    ['store_add_to_cart', 'Added to cart'],
    ['store_checkout_start', 'Checkout started'],
    ['store_purchase', 'Purchase confirmed'],
  ] },
]

export async function getWebsiteFunnel(pool, range, hostname) {
  const steps = journeys.flatMap(({ name, steps }) =>
    steps.map(([event_name], index) => ({ journey: name, position: index + 1, event_name })),
  )
  const { rows } = await pool.query(`
    WITH RECURSIVE events AS (${eligibleEvents}),
    stages AS (
      SELECT * FROM JSONB_TO_RECORDSET($5::jsonb) AS requested(journey text, position int, event_name text)
    ), journeys_by_session AS (
      SELECT s.journey, ARRAY_AGG(s.position ORDER BY e.occurred_at, e.id) AS sequence
      FROM events e JOIN stages s USING (event_name)
      WHERE e.event_name <> 'begin_checkout' OR e.properties->>'checkout_type' IN ('enrollment', 'public_account_signup')
      GROUP BY s.journey, e.hostname, e.session_id, e.visitor_id
    ), progress AS (
      SELECT journey, sequence, 1 AS position, ARRAY_POSITION(sequence, 1) AS marker
      FROM journeys_by_session
      WHERE 1 = ANY(sequence)
      UNION ALL
      SELECT p.journey, p.sequence, p.position + 1, next.marker
      FROM progress p CROSS JOIN LATERAL (
        SELECT ARRAY_POSITION(p.sequence, p.position + 1, p.marker + 1) AS marker
      ) next
      WHERE next.marker IS NOT NULL
    )
    SELECT journey, position, COUNT(*)::int AS count
    FROM progress GROUP BY journey, position`,
  [...websiteParams(range, hostname).slice(0, 4), JSON.stringify(steps)])

  const counts = new Map(rows.map(({ journey, position, count }) => [`${journey}:${position}`, count]))
  const reports = journeys.map(({ name, steps: journeySteps }) => ({
    name,
    steps: journeySteps.map(([, label], index) => {
      const count = counts.get(`${name}:${index + 1}`) ?? 0
      const previous = counts.get(`${name}:${index}`) ?? 0
      return {
        name: label,
        count,
        conversionFromPrevious: previous > 0 ? Math.round(count / previous * 1000) / 10 : null,
      }
    }),
  }))
  const inquiry = reports.find(report => report.name === 'Inquiry')
  return {
    journeys: reports,
    // Compatibility for the earlier admin bundle during the rolling release.
    steps: (inquiry?.steps ?? []).map((step, index) => ({
      ...step,
      conversionFromPrevious: step.conversionFromPrevious ?? (index === 0 ? 100 : 0),
    })),
  }
}
