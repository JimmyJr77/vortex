import assert from 'node:assert/strict'
import test from 'node:test'
import { google } from 'googleapis'

import { createAdminAnalyticsHandlers } from '../adminHandlers.js'
import { getSearchConsoleProgramPages, getSearchConsoleTopics } from '../gscClient.js'

const PROPERTY = 'sc-domain:example.test'
const NOW = new Date('2026-11-16T07:59:59.000Z')
const TOPICS = [
  ['youth-athletics', 'Athletic training for teens in Bowie', 'sports for kids'],
  ['youth-gymnastics', 'Gymnastics classes for kids near me', 'adult gymnastics'],
  ['athleticism-development', 'Developing athleticism', 'adult gymnastics'],
  ['youth-sports', 'Sports for children in Bowie', 'youth fitness'],
  ['youth-fitness', 'Youth strength and conditioning', 'youth gymnastics'],
  ['adult-gymnastics', 'Gymnastics classes for adults', 'kids gymnastics'],
]

function configure(t, updates) {
  for (const key of ['GSC_SITE_URL', 'GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_APPLICATION_CREDENTIALS_JSON']) {
    const before = process.env[key]
    if (updates[key] === undefined) delete process.env[key]
    else process.env[key] = updates[key]
    t.after(() => {
      if (before === undefined) delete process.env[key]
      else process.env[key] = before
    })
  }
}

test('reports the exact missing Search Console setting without making any provider calls', async t => {
  configure(t, {})
  const factory = t.mock.method(google, 'searchconsole', () => assert.fail('Unexpected provider access'))
  const report = await getSearchConsoleTopics(NOW)
  assert.equal(report.scope, 'all')
  assert.equal(report.status, 'unconfigured')
  assert.equal(report.reason, 'missing_property')
  assert.deepEqual(report.topics.map(topic => [topic.id, topic.status, topic.metrics]),
    TOPICS.map(([id]) => [id, 'unavailable', null]))

  process.env.GSC_SITE_URL = PROPERTY
  const handlers = createAdminAnalyticsHandlers(null)
  const headers = new Map()
  let response
  await handlers.getSeoTopics({}, {
    set: (key, value) => headers.set(key, value),
    json: value => { response = value },
  })
  assert.equal(headers.get('Cache-Control'), 'no-store')
  assert.equal(response.success, true)
  assert.equal(response.data.scope, 'all')
  assert.equal(response.data.view, 'totals')
  assert.equal(response.data.reason, 'missing_credentials')
  await handlers.getSeoTopics({ query: { scope: 'without_vortex', view: 'pages' } }, {
    set() {},
    json: value => { response = value },
  })
  assert.equal(response.data.scope, 'without_vortex')
  assert.equal(response.data.view, 'pages')
  assert.equal(response.data.reason, 'missing_credentials')
  for (const query of [{ scope: 'other' }, { scope: ['all', 'without_vortex'] }, { view: ['totals', 'pages'] }]) {
    let status
    const res = {
      set() {},
      status: value => { status = value; return res },
      json: value => { response = value },
    }
    await handlers.getSeoTopics({ query }, res)
    assert.equal(status, 400)
    assert.equal(response.success, false)
  }
  assert.equal(factory.mock.callCount(), 0)
})

test('measures each topic independently using finalized Pacific data and preserves empty, zero-click, and error results', async t => {
  configure(t, {
    GSC_SITE_URL: PROPERTY,
    GOOGLE_APPLICATION_CREDENTIALS_JSON: '{}',
  })
  let requestIndex = 0
  const query = t.mock.fn(async () => {
    const index = requestIndex++
    if (index === 1) return { data: {} }
    if (index === 2) return { data: { rows: [{ clicks: 0, impressions: 9, position: 3 }] } }
    if (index === 3) throw Object.assign(new Error('private provider response'), { response: { status: 503 } })
    if (index === 4) throw Object.assign(new Error('private provider response'), { response: { status: 403 } })
    return { data: { rows: [{ clicks: 2, impressions: 10, position: 5.5 }] } }
  })
  t.mock.method(google, 'searchconsole', () => ({ searchanalytics: { query } }))

  const report = await getSearchConsoleTopics(NOW)
  assert.equal(query.mock.callCount(), TOPICS.length)
  for (const [index, call] of query.mock.calls.entries()) {
    const [request] = call.arguments
    const [, sample, unrelated] = TOPICS[index]
    const { dimensionFilterGroups, ...body } = request.requestBody
    assert.equal(request.siteUrl, PROPERTY)
    assert.deepEqual(body, {
      startDate: '2026-10-16',
      endDate: '2026-11-12',
      type: 'web',
      dataState: 'final',
      aggregationType: 'byProperty',
      rowLimit: 1,
    })
    const [{ groupType, filters: [{ dimension, operator, expression }] }] = dimensionFilterGroups
    assert.equal(groupType, 'and')
    assert.equal(dimensionFilterGroups[0].filters.length, 1)
    assert.equal(dimension, 'query')
    assert.equal(operator, 'includingRegex')
    assert.ok(expression.startsWith('(?i)'))
    const regex = new RegExp(expression.slice(4), 'i')
    assert.match(sample, regex)
    assert.doesNotMatch(unrelated, regex)

  }
  assert.equal(report.status, 'partial')
  assert.equal(report.timeZone, 'America/Los_Angeles')
  assert.deepEqual(report.topics.map(topic => topic.id), TOPICS.map(([id]) => id))
  assert.deepEqual(report.topics.map(topic => topic.status),
    ['reported', 'no_data', 'reported', 'error', 'error', 'reported'])
  assert.deepEqual(report.topics[0].metrics, { clicks: 2, impressions: 10, ctr: 0.2, position: 5.5 })
  assert.equal(report.topics[1].metrics, null)
  assert.deepEqual(report.topics[2].metrics, { clicks: 0, impressions: 9, ctr: 0, position: 3 })
  assert.equal(report.topics[3].reason, 'provider_error')
  assert.equal(report.topics[4].reason, 'access_denied')
  assert.ok(!JSON.stringify(report).includes('private provider response'))
})

test('excludes the Vortex name alongside each topic filter when requested', async t => {
  configure(t, { GSC_SITE_URL: PROPERTY, GOOGLE_APPLICATION_CREDENTIALS_JSON: '{}' })
  const query = t.mock.fn(async () => ({ data: { rows: [] } }))
  t.mock.method(google, 'searchconsole', () => ({ searchanalytics: { query } }))

  const report = await getSearchConsoleTopics(NOW, 'without_vortex')
  assert.equal(report.scope, 'without_vortex')
  assert.equal(report.status, 'ok')
  assert.ok(report.topics.every(topic => topic.status === 'no_data'))
  assert.equal(query.mock.callCount(), TOPICS.length)
  for (const [index, { arguments: [request] }] of query.mock.calls.entries()) {
    const groups = request.requestBody.dimensionFilterGroups
    assert.equal(groups.length, 1)
    const [{ groupType, filters }] = groups
    assert.equal(groupType, 'and')
    assert.deepEqual(filters.map(({ dimension, operator }) => [dimension, operator]), [
      ['query', 'includingRegex'], ['query', 'excludingRegex'],
    ])
    assert.match(TOPICS[index][1], new RegExp(filters[0].expression.slice(4), 'i'))
    const exclusion = filters[1].expression
    assert.ok(exclusion.startsWith('(?i)'))
    const regex = new RegExp(exclusion.slice(4), 'i')
    for (const branded of ['Vortex Athletics youth sports', 'VORTEXATHLETICS.COM adult gymnastics', 'vortex_gymnastics for kids', 'vortexgymnastics.com']) {
      assert.match(branded, regex)
    }
    for (const query of ['adult gymnastics in Bowie', 'Fit & Flip youth fitness', 'supervortex gymnastics', 'youth sports vortexes']) {
      assert.doesNotMatch(query, regex)
    }
  }
})

test('distinguishes property access rejection from a successful provider query with no published topic data', async t => {
  configure(t, {
    GSC_SITE_URL: PROPERTY,
    GOOGLE_APPLICATION_CREDENTIALS_JSON: '{}',
  })
  let denied = true
  t.mock.method(google, 'searchconsole', () => ({
    searchanalytics: {
      query: async () => {
        if (denied) throw Object.assign(new Error('private Google details'), { response: { status: 403 } })
        return { data: { rows: [] } }
      },
    },
  }))

  const failure = await getSearchConsoleTopics(NOW)
  assert.equal(failure.status, 'error')
  assert.equal(failure.reason, 'access_denied')
  assert.ok(failure.topics.every(topic => topic.status === 'error' && topic.metrics === null))
  denied = false
  const empty = await getSearchConsoleTopics(NOW)
  assert.equal(empty.status, 'ok')
  assert.ok(empty.topics.every(topic => topic.status === 'no_data' && topic.metrics === null))
})

test('reports a bounded set of pages per topic without exposing unknown paths or URL identifiers', async t => {
  configure(t, { GSC_SITE_URL: PROPERTY, GOOGLE_APPLICATION_CREDENTIALS_JSON: '{}' })
  const row = (url, clicks = 2) => ({ keys: [url], clicks, impressions: 10, position: 5 })
  const pageRows = [
    row('https://user:private-credential@www.vortex-gymnastics.com/artistic-gymnastics?vcid=private-query#private-hash'),
    row('https://vortexathletics.com/verify-email/private-token', 1),
    row('https://vortexathletics.com/blog/gymnastics-vs-tumbling?vcid=private-query#private-hash'),
    row('https://vortexathletics.com/unknown/private-segment', 0),
  ]
  const responses = [pageRows, [], [row('javascript:alert(1)')], Array(6).fill(pageRows[0]), [], []]
  let callIndex = 0
  const query = t.mock.fn(async () => ({ data: { rows: responses[callIndex++] } }))
  t.mock.method(google, 'searchconsole', () => ({ searchanalytics: { query } }))

  const report = await getSearchConsoleTopics(NOW, 'without_vortex', 'pages')
  assert.equal(report.view, 'pages')
  assert.equal(report.status, 'partial')
  assert.equal(query.mock.callCount(), TOPICS.length)
  for (const { arguments: [{ requestBody }] } of query.mock.calls) {
    assert.deepEqual(requestBody.dimensions, ['page'])
    assert.equal(requestBody.aggregationType, 'auto')
    assert.equal(requestBody.rowLimit, 5)
    assert.equal(requestBody.startDate, '2026-10-16')
    assert.deepEqual(requestBody.dimensionFilterGroups[0].filters.map(filter => filter.operator), ['includingRegex', 'excludingRegex'])
  }
  assert.equal(report.topics[0].metrics, null)
  assert.deepEqual(report.topics[0].pages, [
    { page: 'https://www.vortex-gymnastics.com/artistic-gymnastics', metrics: { clicks: 2, impressions: 10, ctr: 0.2, position: 5 } },
    { page: 'https://vortexathletics.com/verify-email', metrics: { clicks: 1, impressions: 10, ctr: 0.1, position: 5 } },
    { page: 'https://vortexathletics.com/blog/gymnastics-vs-tumbling', metrics: { clicks: 2, impressions: 10, ctr: 0.2, position: 5 } },
    { page: null, metrics: { clicks: 0, impressions: 10, ctr: 0, position: 5 } },
  ])
  assert.deepEqual(report.topics.map(topic => topic.status), ['reported', 'no_data', 'error', 'error', 'no_data', 'no_data'])
  assert.ok(!JSON.stringify(report).includes('private-'))
})

test('compares current and former landing pages in two finalized windows across all search terms', async t => {
  configure(t, { GSC_SITE_URL: PROPERTY, GOOGLE_APPLICATION_CREDENTIALS_JSON: '{}' })
  const homepage = 'https://vortexathletics.com/'
  const gymnastics = 'https://vortexathletics.com/gymnastics'
  const fitAndFlip = 'https://vortexathletics.com/fit-and-flip'
  const formerYouthSports = 'https://vortexathletics.com/vortex-athletics'
  const adultGymnastics = 'https://vortexathletics.com/adult-gymnastics'
  const trainingGuides = 'https://vortexathletics.com/blog'
  const preschoolGuide = 'https://vortexathletics.com/blog/preschool-gymnastics-what-toddlers-learn'
  const tumblingGuide = 'https://vortexathletics.com/blog/gymnastics-vs-tumbling'
  const returningGuide = 'https://vortexathletics.com/blog/returning-to-gymnastics-as-an-adult'
  const pages = [
    homepage, gymnastics, fitAndFlip, formerYouthSports, adultGymnastics, trainingGuides,
    'https://vortexathletics.com/blog/youth-sports-bowie',
    'https://vortexathletics.com/blog/athletic-development-young-athletes',
    preschoolGuide, tumblingGuide, returningGuide,
  ]
  const query = t.mock.fn(async ({ requestBody }) => {
    const latest = requestBody.startDate === '2026-10-16'
    if (requestBody.aggregationType === 'byProperty') {
      return { data: { rows: [{ impressions: latest ? 230 : 142 }] } }
    }
    return { data: { rows: latest ? [
      { keys: [homepage], impressions: 80, clicks: 3 },
      { keys: [homepage.slice(0, -1)], impressions: 77, clicks: 2 },
      { keys: [gymnastics], impressions: 30, clicks: 0 },
      { keys: [fitAndFlip], impressions: 15, clicks: 1 },
      { keys: [adultGymnastics], impressions: 0, clicks: 0 },
      { keys: [trainingGuides], impressions: 6, clicks: 1 },
      { keys: [preschoolGuide], impressions: 4, clicks: 0 },
      { keys: [tumblingGuide], impressions: 8, clicks: 1 },
      { keys: [returningGuide], impressions: 5, clicks: 0 },
    ] : [
      { keys: [homepage.slice(0, -1)], impressions: 63, clicks: 2 },
      { keys: [gymnastics], impressions: 21, clicks: 1 },
      { keys: [formerYouthSports], impressions: 17, clicks: 1 },
      { keys: [tumblingGuide], impressions: 3, clicks: 0 },
    ] } }
  })
  t.mock.method(google, 'searchconsole', () => ({ searchanalytics: { query } }))

  const report = await getSearchConsoleProgramPages(NOW)
  assert.equal(report.timeZone, 'America/Los_Angeles')
  assert.equal(report.status, 'ok')
  assert.deepEqual(report.current, { startDate: '2026-10-16', endDate: '2026-11-12', status: 'ok' })
  assert.deepEqual(report.previous, { startDate: '2026-09-18', endDate: '2026-10-15', status: 'ok' })
  assert.deepEqual(report.pages.map(({ page }) => page), pages)
  assert.deepEqual(report.pages.map(({ currentImpressions, previousImpressions }) => [currentImpressions, previousImpressions]),
    [[80, 63], [30, 21], [15, null], [null, 17], [0, null], [6, null], [null, null], [null, null], [4, null], [8, 3], [5, null]])
  assert.deepEqual(report.propertyTotals, {
    current: { status: 'ok', impressions: 230 }, previous: { status: 'ok', impressions: 142 },
  })
  assert.equal(query.mock.callCount(), 4)
  const pageCalls = query.mock.calls.filter(({ arguments: [request] }) => request.requestBody.aggregationType === 'auto')
  const totalsCalls = query.mock.calls.filter(({ arguments: [request] }) => request.requestBody.aggregationType === 'byProperty')
  assert.equal(pageCalls.length, 2)
  assert.equal(totalsCalls.length, 2)
  for (const [index, { arguments: [request, options] }] of pageCalls.entries()) {
    const { dimensionFilterGroups, ...body } = request.requestBody
    const { startDate, endDate } = [report.current, report.previous][index]
    assert.equal(request.siteUrl, PROPERTY)
    assert.deepEqual(body, {
      startDate, endDate, type: 'web', dataState: 'final', aggregationType: 'auto', dimensions: ['page'], rowLimit: 12,
    })
    assert.deepEqual(options, { timeout: 10000, retry: false })
    assert.equal(dimensionFilterGroups.length, 1)
    const [{ groupType, filters }] = dimensionFilterGroups
    assert.equal(groupType, 'and')
    assert.equal(filters.length, 1)
    assert.equal(filters[0].dimension, 'page')
    assert.equal(filters[0].operator, 'includingRegex')
    const filter = new RegExp(filters[0].expression)
    for (const page of [...pages, homepage.slice(0, -1)]) assert.match(page, filter)
    for (const page of [homepage + '?private=1', formerYouthSports + '?vcid=private', gymnastics + '/',
      trainingGuides + '/private-draft', tumblingGuide + '?vcid=private',
      'https://www.vortexathletics.com/gymnastics', 'https://vortexathleticsXcom/gymnastics', 'https://vortexathletics.com/enroll']) assert.doesNotMatch(page, filter)
  }
  for (const [index, { arguments: [request, options] }] of totalsCalls.entries()) {
    const { startDate, endDate } = [report.current, report.previous][index]
    assert.equal(request.siteUrl, PROPERTY)
    assert.deepEqual(request.requestBody, {
      startDate, endDate, type: 'web', dataState: 'final', aggregationType: 'byProperty', rowLimit: 1,
    })
    assert.deepEqual(options, { timeout: 10000, retry: false })
  }
})

test('keeps absent program page impressions distinct from failed and unconfigured windows', async t => {
  configure(t, {})
  const query = t.mock.fn(async ({ requestBody }) => {
    if (requestBody.aggregationType === 'byProperty' && requestBody.startDate === '2026-10-16') {
      return { data: { rows: [{ impressions: 45 }] } }
    }
    if (requestBody.startDate === '2026-10-16') {
      throw Object.assign(new Error('private provider response'), { response: { status: 403 } })
    }
    return { data: { rows: [] } }
  })
  const factory = t.mock.method(google, 'searchconsole', () => ({ searchanalytics: { query } }))
  const headers = new Map()
  let response
  await createAdminAnalyticsHandlers(null).getSeoProgramPages({}, {
    set: (key, value) => headers.set(key, value),
    json: value => { response = value },
  })
  assert.equal(headers.get('Cache-Control'), 'no-store')
  assert.equal(response.success, true)
  assert.equal(response.data.status, 'unconfigured')
  assert.equal(response.data.reason, 'missing_property')
  assert.equal(response.data.current.status, 'unavailable')
  assert.equal(response.data.previous.status, 'unavailable')
  assert.equal(factory.mock.callCount(), 0)

  process.env.GSC_SITE_URL = PROPERTY
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '{}'
  const partial = await getSearchConsoleProgramPages(NOW)
  assert.equal(partial.status, 'partial')
  assert.equal(partial.current.status, 'error')
  assert.equal(partial.current.reason, 'access_denied')
  assert.equal(partial.previous.status, 'ok')
  assert.ok(partial.pages.every(page => page.currentImpressions === null && page.previousImpressions === null))
  assert.deepEqual(partial.propertyTotals, {
    current: { status: 'ok', impressions: 45 }, previous: { status: 'ok', impressions: null },
  })
  assert.doesNotMatch(JSON.stringify(partial), /private provider response/)
})
