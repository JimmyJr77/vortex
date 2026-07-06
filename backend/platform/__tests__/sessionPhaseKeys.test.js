import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhaseKey, phaseDisplayName, CANONICAL_PHASE_ORDER, dedupeSessionPhases } from '../sessionPhaseKeys.js'

describe('sessionPhaseKeys', () => {
  it('normalizes legacy aliases', () => {
    assert.equal(normalizePhaseKey('prepare_access'), 'prepare_and_access')
    assert.equal(normalizePhaseKey('skill_movement_intelligence'), 'movement_intelligence')
    assert.equal(normalizePhaseKey('control_resilience'), 'resilience')
    assert.equal(normalizePhaseKey('fitness_repeatability'), 'sustained_capacity')
  })

  it('returns canonical keys unchanged', () => {
    for (const key of CANONICAL_PHASE_ORDER) {
      assert.equal(normalizePhaseKey(key), key)
    }
  })

  it('returns display names', () => {
    assert.equal(phaseDisplayName('sustained_capacity'), 'Sustained Capacity')
    assert.equal(phaseDisplayName('skill_movement_intelligence'), 'Movement Intelligence')
  })

  it('dedupes legacy and canonical session phase rows', () => {
    const rows = dedupeSessionPhases([
      { id: 1, key: 'prepare_access', name: 'Prepare / Access' },
      { id: 2, key: 'prepare_and_access', name: 'Prepare & Access' },
      { id: 3, key: 'output', name: 'Output' },
    ])
    assert.equal(rows.length, 2)
    assert.equal(rows[0].key, 'prepare_and_access')
    assert.equal(rows[0].name, 'Prepare & Access')
    assert.equal(rows[1].key, 'output')
  })
})
