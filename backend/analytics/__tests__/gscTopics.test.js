import assert from 'node:assert/strict'
import test from 'node:test'
import { google } from 'googleapis'

import { createAdminAnalyticsHandlers } from '../adminHandlers.js'
import { getSearchConsoleTopics } from '../gscClient.js'

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
  assert.equal(response.data.reason, 'missing_credentials')
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
