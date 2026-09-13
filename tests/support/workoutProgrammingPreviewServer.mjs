import { createRequire } from 'node:module'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'vite'
import { registerWorkoutProgrammingRoutes } from '../../backend/platform/coachWorkoutProgrammingRoutes.js'
import { generateAndPersistWorkoutProgramming } from '../../backend/platform/workoutProgrammingService.js'
import { storageFixtures, storageSourcePool, memoryStorageDatabase } from '../../backend/platform/__tests__/workoutProgrammingStorageFixtures.js'
import { TAXONOMY_V2_FACETS } from '../../backend/platform/taxonomyV2.js'
import { evidenceFixtures } from '../../backend/platform/__tests__/workoutAthleteEvidenceFixtures.js'
import { modificationFixtureRegistry } from '../../backend/platform/__tests__/workoutProgrammingModificationFixtures.js'

// Loopback-only preview. This process never opens a production DB or configures a paid model.
const express = createRequire(new URL('../../backend/package.json', import.meta.url))('express')
const port = Number(process.env.PROGRAMMING_PREVIEW_PORT ?? 5183)
const origin = `http://127.0.0.1:${port}`
process.env.VITE_API_URL = origin
const fixtures = await storageFixtures()
const registry = modificationFixtureRegistry(fixtures.registry)
const database = memoryStorageDatabase()
const storagePool = storageSourcePool(database, fixtures)
const athleteSource = evidenceFixtures(Array.from({ length: 15 }, (_, index) => String(101 + index)))
athleteSource['skill_progress:explicit'][0].data.coachUserId = '7'
athleteSource['skill_progress:history'] = athleteSource['skill_progress:explicit']
// Synthetic rows only; the registered production evidence reader still creates all contracts and hashes.
const pool = { async connect() {
  const client = await storagePool.connect()
  return { async query(sql, values = []) {
    if (!sql.includes('programming_athlete_evidence:')) return client.query(sql, values)
    if (sql.includes('programming_athlete_evidence:clock')) return { rows: [{ reference_date: athleteSource.referenceDate,
      reference_timestamp: `${athleteSource.referenceDate}T18:00:00.000000Z` }] }
    if (sql.includes('programming_athlete_evidence:members')) return { rows: athleteSource.members.filter((row) => values[0].includes(row.id)) }
    const [, kind, mode] = sql.match(/programming_athlete_evidence:([a-z_]+):([a-z]+)/)
    const refs = JSON.parse(values[2])
    return { rows: structuredClone((athleteSource[`${kind}:${mode}`] ?? []).filter((row) => values[0].includes(row.member_id)
      && (mode === 'explicit' ? refs.some((ref) => ref.id === row.id && ref.memberId === row.member_id) : row.observed_at.slice(0, 10) <= values[3]))) }
  }, release: (error) => client.release(error) }
} }
const app = express()
app.use(express.json({ limit: '1mb' }))
app.use('/api/coach', (req, _res, next) => { req.platformAuth = { user: { facility_id: '9', id: '7' } }; next() })
app.get('/api/coach/canonical/rollout-status', (_req, res) => res.json({ data: { coachGeneration: { enabled: true }, aiIntent: { enabled: true } } }))
app.get('/api/coach/taxonomy-v2', (_req, res) => res.json({ data: { version: '2.0.0', aliases: [], facets: Object.fromEntries(Object.entries(TAXONOMY_V2_FACETS)
  .map(([key, terms]) => [key, terms.map((term, index) => ({ ...term, id: index + 1, status: 'active', sortOrder: index, metadata: {} }))])) } }))
app.get('/api/coach/members', (_req, res) => res.json({ data: Array.from({ length: 15 }, (_, index) => ({ id: 101 + index, name: `Fixture athlete ${index + 1}` })) }))
let delayMs = 0
let lastRequest = null
let inFlight = 0
const originalSourceInstructions = fixtures.options.cards[3].deliveryProfiles[0].coachInstructions
registerWorkoutProgrammingRoutes(app, pool, {
  can: () => [], ok: (res, data) => res.json({ success: true, data }),
  bad: (res, message, status = 400, details = null) => res.status(status).json({ success: false, message, details }),
  featureAccess: async () => ({ enabled: true }), registryFactory: () => registry,
  generate: async (args) => {
    lastRequest = args.rawRequest
    inFlight++
    try {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
      return await generateAndPersistWorkoutProgramming(args)
    } finally { inFlight-- }
  },
})
app.get('/__preview/state', (_req, res) => res.json({ savedCount: database.rows.size, lastRequest, inFlight }))
app.post('/__preview/reset', (_req, res) => {
  if (inFlight) return res.status(409).json({ message: 'Wait for the current synthetic request to finish.' })
  database.rows.clear(); lastRequest = null; delayMs = 0
  fixtures.options.cards[3].deliveryProfiles[0].coachInstructions = originalSourceInstructions
  res.json({ reset: true })
})
app.post('/__preview/change-source', (_req, res) => { fixtures.options.cards[3].deliveryProfiles[0].coachInstructions = 'Synthetic source changed after the saved review.'; res.json({ changed: true }) })
app.post('/__preview/delay', (req, res) => { delayMs = Math.min(3000, Math.max(0, Number(req.body.milliseconds) || 0)); res.json({ delayMs }) })
const server = createHttpServer(app)
const vite = await createServer({ server: { middlewareMode: true, host: '127.0.0.1', hmr: { server, host: '127.0.0.1' } }, appType: 'mpa' })
app.use(vite.middlewares)
server.listen(port, '127.0.0.1', () => console.log(`Programming preview: ${origin}/tests/fixtures/workout-programming.html`))
const stop = async () => { await vite.close(); server.close(() => process.exit(0)); server.closeAllConnections() }
process.on('SIGTERM', stop); process.on('SIGINT', stop)
