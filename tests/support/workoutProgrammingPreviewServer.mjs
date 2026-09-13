import { createRequire } from 'node:module'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'vite'
import { registerWorkoutProgrammingRoutes } from '../../backend/platform/coachWorkoutProgrammingRoutes.js'
import { generateAndPersistWorkoutProgramming } from '../../backend/platform/workoutProgrammingService.js'
import { storageFixtures, storageSourcePool, memoryStorageDatabase } from '../../backend/platform/__tests__/workoutProgrammingStorageFixtures.js'
import { TAXONOMY_V2_FACETS } from '../../backend/platform/taxonomyV2.js'
import { evidenceFixtures } from '../../backend/platform/__tests__/workoutAthleteEvidenceFixtures.js'
import { modificationFixtureRegistry } from '../../backend/platform/__tests__/workoutProgrammingModificationFixtures.js'
import { scriptedInterpretationRegistry, syntheticInterpretationTaxonomy, withSyntheticInterpretationTaxonomy } from '../../backend/platform/__tests__/workoutProgrammingInterpretationFixtures.js'
import { exerciseProposalPreviewFixtures } from '../../backend/platform/__tests__/workoutExerciseProposalPreviewFixtures.js'
import { researchWorkoutExerciseGap } from '../../backend/platform/workoutExerciseGapResearch.js'
import { proposeWorkoutExercise, listWorkoutExerciseProposals, reviewWorkoutExerciseProposal, acceptWorkoutExerciseProposal, stageWorkoutExerciseProposal, loadWorkoutExerciseProposalRevision } from '../../backend/platform/workoutExerciseProposal.js'
import { loadStagedCanonicalRevision, changeStagedCanonicalRevision, reviewStagedCanonicalRevision } from '../../backend/platform/canonicalCardStagedRevision.js'

// Loopback-only preview. This process never opens a production DB or configures a paid model.
const express = createRequire(new URL('../../backend/package.json', import.meta.url))('express')
const port = Number(process.env.PROGRAMMING_PREVIEW_PORT ?? 5183)
const origin = `http://127.0.0.1:${port}`
process.env.VITE_API_URL = origin
const fixtures = await storageFixtures()
const exerciseLibrary = exerciseProposalPreviewFixtures()
const interpretation = { operations: [], questions: [], delayMs: 0, calls: [], inFlight: 0 }
const registry = scriptedInterpretationRegistry(modificationFixtureRegistry(fixtures.registry), interpretation)
const database = memoryStorageDatabase()
const storagePool = withSyntheticInterpretationTaxonomy(storageSourcePool(database, fixtures), syntheticInterpretationTaxonomy())
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
let syntheticUserId = '7'
app.use(express.json({ limit: '1mb' }))
app.use('/api/coach', (req, _res, next) => { req.platformAuth = { user: { facility_id: '9', id: syntheticUserId } }; next() })
app.get('/api/coach/canonical/rollout-status', (_req, res) => res.json({ data: { coachGeneration: { enabled: true }, aiIntent: { enabled: true } } }))
const taxonomyV2 = { version: '2.0.0', aliases: [], facets: Object.fromEntries(Object.entries(TAXONOMY_V2_FACETS)
  .map(([key, terms]) => [key, terms.map((term, index) => ({ ...term, id: index + 1, status: 'active', sortOrder: index, metadata: {} }))])) }
app.get('/api/coach/taxonomy-v2', (_req, res) => res.json({ data: taxonomyV2 }))
app.get('/api/coach/members', (_req, res) => res.json({ data: Array.from({ length: 15 }, (_, index) => ({ id: 101 + index, name: `Fixture athlete ${index + 1}` })) }))
app.get('/api/coach/taxonomy', (_req, res) => res.json({ data: { ...exerciseLibrary.taxonomy, taxonomyV2 } }))
app.get('/api/coach/canonical/cards/:id', (req, res) => {
  const card = exerciseLibrary.getCard(req.params.id)
  if (!card) return res.status(404).json({ message: 'Synthetic canonical card not found.' })
  res.json({ data: card })
})
let delayMs = 0
let lastRequest = null
let inFlight = 0
const originalSourceInstructions = fixtures.options.cards[3].deliveryProfiles[0].coachInstructions
registerWorkoutProgrammingRoutes(app, pool, {
  can: (permission) => permission === 'library.manage' ? [(req, res, next) => exerciseLibrary.control.denyLibrary ? res.status(403).json({ message: 'Library management access required.' }) : next()] : [],
  ok: (res, data) => res.json({ success: true, data }),
  bad: (res, message, status = 400, details = null) => res.status(status).json({ success: false, message, details }),
  featureAccess: async () => ({ enabled: true }), registryFactory: () => registry,
  gapResearch: (_pool, context, input) => researchWorkoutExerciseGap(exerciseLibrary.pool, context, input),
  listExerciseProposals: (_pool, context, options) => listWorkoutExerciseProposals(exerciseLibrary.pool, context, options),
  reviewExerciseProposal: (_pool, context, id) => reviewWorkoutExerciseProposal(exerciseLibrary.pool, context, id),
  acceptExerciseProposal: (_pool, context, id, input) => acceptWorkoutExerciseProposal(exerciseLibrary.pool, context, id, input),
  stageExerciseProposal: (_pool, context, id, input) => stageWorkoutExerciseProposal(exerciseLibrary.pool, context, id, input),
  loadProposalRevision: (_pool, context, id) => loadWorkoutExerciseProposalRevision(exerciseLibrary.pool, context, id),
  loadStagedRevision: (_pool, context, id) => loadStagedCanonicalRevision(exerciseLibrary.pool, context, id),
  changeStagedRevision: (_pool, context, id, input) => changeStagedCanonicalRevision(exerciseLibrary.pool, context, id, input),
  reviewStagedRevision: (_pool, context, id, input) => reviewStagedCanonicalRevision(exerciseLibrary.pool, context, id, input),
  proposeExercise: async (args) => {
    exerciseLibrary.control.inFlight++; exerciseLibrary.control.lastInput = args.rawInput
    try { return await proposeWorkoutExercise({ ...args, pool: exerciseLibrary.pool, registry: exerciseLibrary.registry }) }
    finally { exerciseLibrary.control.inFlight-- }
  },
  generate: async (args) => {
    lastRequest = args.rawRequest
    inFlight++
    try {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
      return await generateAndPersistWorkoutProgramming(args)
    } finally { inFlight-- }
  },
})
app.get('/__preview/state', (_req, res) => res.json({ savedCount: database.rows.size, lastRequest, inFlight,
  interpretationCount: interpretation.calls.length, interpretationsInFlight: interpretation.inFlight, lastInterpretationRequest: interpretation.calls.at(-1)?.request ?? null,
  exerciseProposals: { ...exerciseLibrary.control, auditCount: exerciseLibrary.audit.rows.size, cardCount: exerciseLibrary.cards.size,
    stagedEventCount: exerciseLibrary.staged.events.size, sourceCard: exerciseLibrary.staged.source } }))
app.post('/__preview/reset', (_req, res) => {
  if (inFlight || interpretation.inFlight || exerciseLibrary.control.inFlight) return res.status(409).json({ message: 'Wait for the current synthetic request to finish.' })
  exerciseLibrary.reset()
  syntheticUserId = '7'
  database.rows.clear(); lastRequest = null; delayMs = 0
  interpretation.operations = []; interpretation.questions = []; interpretation.delayMs = 0; interpretation.calls = []
  fixtures.options.cards[3].deliveryProfiles[0].coachInstructions = originalSourceInstructions
  res.json({ reset: true })
})
app.post('/__preview/change-source', (_req, res) => { fixtures.options.cards[3].deliveryProfiles[0].coachInstructions = 'Synthetic source changed after the saved review.'; res.json({ changed: true }) })
app.post('/__preview/delay', (req, res) => { delayMs = Math.min(3000, Math.max(0, Number(req.body.milliseconds) || 0)); res.json({ delayMs }) })
app.post('/__preview/exercise-proposals', (req, res) => {
  if (exerciseLibrary.control.inFlight) return res.status(409).json({ message: 'Wait for the current synthetic exercise request.' })
  if (['new_card', 'profile', 'reuse', 'invalid', 'needs_review'].includes(req.body.mode)) exerciseLibrary.control.mode = req.body.mode
  exerciseLibrary.control.delayMs = Math.min(3000, Math.max(0, Number(req.body.delayMs) || 0))
  exerciseLibrary.control.denyLibrary = req.body.denyLibrary === true
  if (['7', '8', '9'].includes(req.body.syntheticReviewer)) syntheticUserId = req.body.syntheticReviewer
  if (req.body.completeSyntheticSource === true) exerciseLibrary.staged.useCompleteSyntheticSource()
  if (req.body.changeProfileSource === true) exerciseLibrary.staged.source.description = 'Synthetic published source changed after revision staging.'
  res.json({ configured: true })
})
app.post('/__preview/interpretation', (req, res) => {
  if (interpretation.inFlight) return res.status(409).json({ message: 'Wait for the synthetic interpretation to finish.' })
  interpretation.operations = req.body.operations ?? []; interpretation.questions = req.body.questions ?? []
  interpretation.delayMs = Math.min(3000, Math.max(0, Number(req.body.delayMs) || 0))
  res.json({ configured: true })
})
const server = createHttpServer(app)
const vite = await createServer({ server: { middlewareMode: true, host: '127.0.0.1', hmr: { server, host: '127.0.0.1' } }, appType: 'mpa' })
app.use(vite.middlewares)
server.listen(port, '127.0.0.1', () => console.log(`Programming preview: ${origin}/tests/fixtures/workout-programming.html`))
const stop = async () => { await vite.close(); server.close(() => process.exit(0)); server.closeAllConnections() }
process.on('SIGTERM', stop); process.on('SIGINT', stop)
