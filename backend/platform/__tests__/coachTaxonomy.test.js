import test from 'node:test'
import assert from 'node:assert/strict'
import { loadSessionPhaseTaxonomy } from '../coachPortalRoutes.js'

test('phase taxonomy retains session phases when an optional phase table is unavailable', async () => {
  const phaseRows = [{ id: 1, key: 'prepare_and_access', name: 'Prepare & Access' }]
  const slotRows = [{ id: 2, key: 'raise', phase_key: 'prepare_and_access' }]
  const warnings = []
  let queryIndex = 0
  const pool = {
    query() {
      queryIndex += 1
      if (queryIndex === 1) return Promise.resolve({ rows: phaseRows })
      if (queryIndex === 2) return Promise.resolve({ rows: slotRows })
      return Promise.reject(new Error('relation coaching.phase_subrole does not exist'))
    },
  }

  const result = await loadSessionPhaseTaxonomy(pool, {
    warn: (...args) => warnings.push(args.join(' ')),
  })

  assert.deepEqual(result, [phaseRows, slotRows, []])
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /phase_subrole unavailable/)
})
