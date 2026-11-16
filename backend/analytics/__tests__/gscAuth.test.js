import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { google } from 'googleapis'

import { createAdminAnalyticsHandlers } from '../adminHandlers.js'
import { syncGscRankings } from '../gscClient.js'
import { syncExternalAnalytics } from '../syncExternal.js'

const PROPERTY = 'sc-domain:example.test'
const PROJECT = 'render-gsc-fixture'
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const environmentKeys = [
  'GSC_SITE_URL',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON',
  'GOOGLE_CLOUD_PROJECT',
  'GA4_PROPERTY_ID',
]

function configure(t, updates) {
  const before = new Map(environmentKeys.map(key => [key, process.env[key]]))
  for (const key of environmentKeys) {
    if (updates[key] === undefined) delete process.env[key]
    else process.env[key] = updates[key]
  }
  t.after(() => {
    for (const [key, value] of before) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
}

test('Render ADC takes precedence for Search Console reports and never enables GA4 by itself', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'gsc-adc-test-'))
  t.after(() => rm(dir, { force: true, recursive: true }))
  const credentialFile = join(dir, 'credentials.json')
  await writeFile(credentialFile, JSON.stringify({
    type: 'external_account',
    audience: '//iam.googleapis.com/projects/123456789/locations/global/workloadIdentityPools/test-pool/providers/test-provider',
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/testing@${PROJECT}.iam.gserviceaccount.com:generateAccessToken`,
    // Initialize the client without requesting a token or making any network calls.
    credential_source: { file: join(dir, 'no-live-oidc-token'), format: { type: 'text' } },
  }), { mode: 0o600 })

  configure(t, {
    GSC_SITE_URL: PROPERTY,
    GOOGLE_APPLICATION_CREDENTIALS: credentialFile,
    GOOGLE_APPLICATION_CREDENTIALS_JSON: 'invalid legacy JSON; the ADC file takes precedence',
    GOOGLE_CLOUD_PROJECT: PROJECT,
  })

  const query = t.mock.fn(async () => ({ data: { rows: [] } }))
  const clientFactory = t.mock.method(google, 'searchconsole', ({ auth }) => (
    { searchanalytics: { query: async request => {
      const credential = await auth.getClient()
      assert.equal(credential.constructor.name, 'IdentityPoolClient')
      assert.deepEqual(credential.scopes, [GSC_SCOPE])
      assert.equal(await auth.getProjectId(), PROJECT)
      assert.equal(request.siteUrl, PROPERTY)
      assert.deepEqual(request.requestBody.dimensions, ['query', 'page', 'date'])
      return query(request)
    } } }
  ))

  assert.deepEqual(await syncGscRankings(null), { rowsSynced: 0 })
  // ADC-only configuration should reach the provider and mark the report ready to sync.
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  process.env.GA4_PROPERTY_ID = '12345'
  const pool = { query: async () => ({ rowCount: 0, rows: [] }) }
  const result = await syncExternalAnalytics(pool)
  assert.deepEqual(result.gsc, { rowsSynced: 0 })
  assert.ok(result.ga4.skipped)
  assert.equal(clientFactory.mock.callCount(), 2)

  const handlers = createAdminAnalyticsHandlers(pool)
  let response
  await handlers.getSeo({ query: { from: '2026-10-01', to: '2026-10-02' } }, {
    json(value) { response = value },
  })
  assert.equal(response.data.configured, true)
  delete process.env.GSC_SITE_URL
  await handlers.getSeo({ query: { from: '2026-10-01', to: '2026-10-02' } }, {
    json(value) { response = value },
  })
  assert.equal(response.data.configured, false)
})

test('legacy Search Console JSON remains supported and preserves the API error', async t => {
  configure(t, {
    GSC_SITE_URL: PROPERTY,
    GOOGLE_APPLICATION_CREDENTIALS_JSON: JSON.stringify({
      type: 'service_account',
      project_id: PROJECT,
      client_email: `test@${PROJECT}.iam.gserviceaccount.com`,
      private_key: 'synthetic key; no signing or token exchange will occur',
    }),
  })

  const authFailure = new Error('Search Console permission denied')
  t.mock.method(google, 'searchconsole', ({ auth }) => ({
    searchanalytics: { query: async () => {
      const credential = await auth.getClient()
      assert.equal(credential.constructor.name, 'JWT')
      assert.deepEqual(credential.scopes, [GSC_SCOPE])
      throw authFailure
    } },
  }))
  const fallback = t.mock.method(google, 'webmasters', () => assert.fail('unexpected fallback'))
  await assert.rejects(() => syncGscRankings(null), error => error === authFailure)
  assert.equal(fallback.mock.callCount(), 0)
})
