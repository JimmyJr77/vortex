import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import { initAnalyticsTables } from '../initTables.js'
import { createPublicAnalyticsHandlers } from '../publicHandlers.js'
import { parseDateRange } from '../helpers.js'
import { getWebsiteTraffic, getWebsiteEngagement, getWebsiteFunnel } from '../websiteReports.js'
import { syncExternalAnalytics } from '../syncExternal.js'
import { createAdminAnalyticsHandlers } from '../adminHandlers.js'
import { getBusinessOutcomes } from '../businessOutcomes.js'

const connectionString = process.env.ANALYTICS_TEST_DATABASE_URL

test('report boundaries follow Eastern dates through daylight saving changes', () => {
  const range = parseDateRange({ from: '2026-11-01', to: '2026-11-01' })
  assert.equal(range.from.toISOString(), '2026-11-01T04:00:00.000Z')
  assert.equal(range.to.toISOString(), '2026-11-02T04:59:59.999Z')
  assert.equal(parseDateRange({ from: '2026-11-02', to: '2026-11-01' }), null)
  assert.equal(parseDateRange({ from: '2026-02-30', to: '2026-03-01' }), null)
})

test('consented site events produce deduplicated traffic, engagement, and ordered funnels in Postgres', {
  skip: !connectionString && 'Set ANALYTICS_TEST_DATABASE_URL to a disposable database',
}, async (t) => {
  const pool = new pg.Pool({ connectionString, max: 1 })
  const schema = 'website_analytics_' + randomUUID().replaceAll('-', '')
  await pool.query(`CREATE SCHEMA ${schema}`)
  t.after(async () => {
    await pool.query(`DROP SCHEMA ${schema} CASCADE`)
    await pool.end()
  })
  await pool.query(`SET search_path TO ${schema}, public`)
  await pool.query('CREATE TABLE registrations (id integer PRIMARY KEY, created_at timestamptz, archived boolean)')
  await initAnalyticsTables(pool)

  const { ingestEvents } = createPublicAnalyticsHandlers(pool)
  const send = async events => {
    let status = 200
    let result
    await ingestEvents({ body: { events } }, {
      status(value) { status = value; return this },
      json(value) { result = value; return this },
    })
    assert.equal(status, 200, JSON.stringify(result))
    return result.accepted
  }

  const iso = (minute, second = 0) => new Date(Date.UTC(2026, 10, 16, 16, minute, second)).toISOString()
  const event = (eventName, occurredAt, extra = {}) => ({
    eventId: randomUUID(), eventName, occurredAt,
    hostname: 'www.vortexathletics.com', visitorId: 'v_user1_test',
    sessionId: 's_session1_test', pagePath: '/', consentAnalytics: true,
    ...extra,
  })
  const other = { visitorId: 'v_user2_test', sessionId: 's_session2_test', hostname: 'vortex-gymnastics.com' }
  const localVisitor = { visitorId: 'v_user3_test', sessionId: 's_session3_test' }
  const denied = event('page_view', iso(0), { consentAnalytics: false, visitorId: 'anonymous', sessionId: 'anonymous' })
  const staff = event('page_view', iso(0), { isStaff: true })
  const privatePath = event('page_view', iso(0), { pagePath: '/member/athlete' })
  const landing = event('page_view', iso(1), {
    pagePath: '/?email=sensitive@example.com',
    referrer: 'https://example.org/private/path?token=secret',
    utm: { source: 'facebook', medium: 'paid_social', campaign: 'Free trial', term: 'private@example.com' },
    properties: { device_type: 'mobile', email: 'private@example.com', payload: { phone: '555-555-5555' } },
  })
  const next = event('page_view', iso(2), { pagePath: '/enroll' })
  const sameView = { page_view_id: landing.eventId }
  const events = [
    denied, staff, privatePath, landing, next,
    event('page_engagement', iso(1, 15), { properties: { ...sameView, engaged_ms: 12000 } }),
    event('page_engagement', iso(1, 25), { properties: { ...sameView, engaged_ms: 22000 } }),
    event('scroll_depth', iso(1, 10), { properties: { ...sameView, percent: 25 } }),
    event('scroll_depth', iso(1, 11), { properties: { ...sameView, percent: 75 } }),
    event('web_vital', iso(1, 3), { properties: { ...sameView, name: 'LCP', value: 2000, device_type: 'mobile' } }),
    event('web_vital', iso(1, 5), { properties: { ...sameView, name: 'LCP', value: 2400, device_type: 'mobile' } }),
    event('cta_click', iso(1, 5), { properties: { target: 'free_trial', message: 'private' } }),
    event('inquiry_form_start', iso(1, 5)),
    event('generate_lead', iso(1, 5)), // This premature completion cannot advance the funnel.
    event('inquiry_form_submit', iso(1, 5)),
    event('generate_lead', iso(1, 5)),
    event('page_view', iso(4), { ...other, pagePath: '/unknown-sensitive-name/token' }),
    event('inquiry_form_start', iso(4), other),
    event('generate_lead', iso(5), other), // Missing any ordered submit event.
    event('page_view', iso(4), { ...localVisitor, pagePath: '/ninja' }),
    event('program_page_view', iso(4), { ...localVisitor, pagePath: '/ninja' }),
  ]

  // Admit the later page first to verify that earlier arrivals restore correct session acquisition.
  assert.equal(await send([next]), 1)
  assert.equal(await send(events), events.length - 4)
  assert.equal(await send([landing, next]), 0)
  await send([event('page_view', '2026-11-15T20:00:00.000Z', { sessionId: 's_historical_test' })])
  await pool.query(`INSERT INTO analytics_events (
    event_id, event_name, occurred_at, visitor_id, session_id, page_path, hostname, consent_analytics, is_staff
  ) VALUES ($1, 'page_view', $2, 'anonymous', 'anonymous', '/contact', 'vortexathletics.com', false, false)`, [randomUUID(), iso(9)])

  const { rows: [persisted] } = await pool.query(
    'SELECT page_path, properties FROM analytics_events WHERE event_id = $1', [landing.eventId],
  )
  assert.deepEqual(persisted, { page_path: '/', properties: { device_type: 'mobile' } })
  const { rows: [session] } = await pool.query(
    'SELECT landing_path, referrer, utm_campaign, started_at, ended_at FROM visitor_sessions WHERE session_id = $1',
    [landing.sessionId],
  )
  assert.equal(session.landing_path, '/')
  assert.equal(session.referrer, 'https://example.org')
  assert.equal(session.utm_campaign, 'Free trial')
  assert.equal(session.started_at.toISOString(), iso(1))
  assert.equal(session.ended_at.toISOString(), iso(2))

  const range = parseDateRange({ from: '2026-11-16', to: '2026-11-16' })
  const traffic = await getWebsiteTraffic(pool, range)
  assert.deepEqual(traffic.totals, {
    sessions: 3, visitors: 3, page_views: 4, returning_visitors: 1, engaged_sessions: 2,
    converting_sessions: 2, timed_sessions: 1, avg_active_seconds: 22,
  })
  assert.equal(traffic.paths.find(path => path.page_path === '/enroll').exits, 1)
  assert.ok(traffic.topPages.some(path => path.page_path === '/other'))
  assert.deepEqual(traffic.sources.find(source => source.channel === 'Paid'), {
    channel: 'Paid', source: 'facebook', medium: 'paid_social', campaign: 'Free trial', sessions: 1, conversions: 1,
  })
  assert.equal((await getWebsiteTraffic(pool, range, 'vortex-gymnastics.com')).totals.sessions, 1)
  assert.equal((await getWebsiteTraffic(pool, range, 'vortexathletics.com')).totals.sessions, 2)

  const engagement = await getWebsiteEngagement(pool, range)
  assert.equal(engagement.timedViews, 1)
  assert.deepEqual(engagement.scroll.map(({ views }) => views), [1, 1, 1, 0, 0])
  assert.deepEqual(engagement.vitals, [{ metric: 'LCP', device: 'mobile', p75: 2400, samples: 1 }])

  const funnel = await getWebsiteFunnel(pool, range)
  const inquiry = funnel.journeys.find(journey => journey.name === 'Inquiry')
  assert.deepEqual(inquiry.steps.map(({ count }) => count), [2, 1, 1])
  assert.deepEqual(inquiry.steps.map(({ conversionFromPrevious }) => conversionFromPrevious), [null, 50, 100])
  await pool.query(`
    CREATE TABLE program (id bigint, facility_id bigint);
    CREATE TABLE scheduling_form (id bigint, program_id bigint);
    CREATE TABLE drop_in_registration (form_id bigint, benefit_type text, status text, created_at timestamptz);
    CREATE TABLE account_enrollment (record_facility_id bigint, status text, created_at timestamptz, archived_at timestamptz,
                                     orphaned_at timestamptz, historical_only bool, record_deleted bool);
    CREATE VIEW account_enrollment_current AS SELECT * FROM account_enrollment WHERE NOT record_deleted;
    CREATE TABLE store_order (facility_id bigint, source text, status text, created_at timestamptz, total_cents int);
    INSERT INTO program VALUES (10, 7), (11, 8);
    INSERT INTO scheduling_form VALUES (1, 10), (2, 11);
    INSERT INTO drop_in_registration VALUES
      (1, 'free_trial', 'confirmed', '2026-11-16 12:00-05'),
      (1, 'paid', 'attended', '2026-11-16 12:00-05'),
      (1, 'free_trial', 'account_required', '2026-11-16 12:00-05'),
      (2, 'free_trial', 'confirmed', '2026-11-16 12:00-05');
    INSERT INTO account_enrollment VALUES
      (7, 'confirmed', '2026-11-16 12:00-05', NULL, NULL, false, false),
      (7, 'waitlisted', '2026-11-16 12:00-05', NULL, NULL, false, false),
      (7, 'confirmed', '2026-11-16 12:00-05', NULL, NULL, true, false),
      (7, 'confirmed', '2026-11-16 12:00-05', NULL, NULL, false, true),
      (8, 'confirmed', '2026-11-16 12:00-05', NULL, NULL, false, false);
    INSERT INTO store_order VALUES
      (7, 'public', 'placed', '2026-11-16 12:00-05', 2500),
      (7, 'member', 'fulfilled', '2026-11-16 12:00-05', 1500),
      (7, 'admin', 'placed', '2026-11-16 12:00-05', 500),
      (7, 'public', 'awaiting_payment', '2026-11-16 12:00-05', 500),
      (8, 'member', 'placed', '2026-11-16 12:00-05', 500);
  `)
  assert.deepEqual(await getBusinessOutcomes(pool, range, 7), {
    free_trials: 1, other_drop_ins: 1, enrollments: 1, store_orders: 2, store_order_value_cents: 4000,
  })

  await send([event('page_view', new Date().toISOString(), { sessionId: 's_fresh_rollup_test' })])
  assert.ok((await syncExternalAnalytics(pool)).firstParty.rowsUpdated > 0)
  await pool.query(`
    INSERT INTO seo_keywords (id, query, page) VALUES
      (1, 'gymnastics', 'https://vortexathletics.com/enroll'),
      (2, 'gymnastics', 'https://vortex-gymnastics.com/enroll');
    INSERT INTO seo_rankings (keyword_id, date, clicks, impressions, position) VALUES
      (1, '2026-11-15', 3, 50, 2),
      (1, '2026-11-16', 7, 200, 8),
      (1, '2026-11-17', 9, 100, 5),
      (2, '2026-11-16', 8, 100, 2);
    INSERT INTO registrations (id, created_at, landing_page) VALUES
      (1, '2026-11-16 12:00-05', '/enroll?private=token'),
      (2, '2026-11-16 12:00-05', '/pasted-sensitive-name/invite');
  `)
  const admin = createAdminAnalyticsHandlers(pool)
  let seo
  await admin.getSeo({ query: { from: '2026-11-15', to: '2026-11-16', hostname: 'vortexathletics.com' } }, {
    status(status) { assert.equal(status, 200); return this },
    json(result) { seo = result.data },
  })
  assert.deepEqual(seo.keywords, [
    { query: 'gymnastics', page: 'https://vortexathletics.com/enroll', clicks: 10, impressions: 250, position: 6.8, ctr: 0.04 },
  ])
  assert.deepEqual(seo.inquiriesByLandingPage, [
    { landing_page: '/enroll', inquiries: 1 }, { landing_page: '/other', inquiries: 1 },
  ])

})
