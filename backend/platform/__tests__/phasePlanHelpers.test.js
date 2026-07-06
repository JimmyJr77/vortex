import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const PHASE_ORDER = [
  'prepare_and_access',
  'movement_intelligence',
  'output',
  'capacity',
  'resilience',
  'sustained_capacity',
  'restore',
]

function normalizePhasePlanRow(raw) {
  const phaseKey = String(raw.phaseKey ?? raw.phase ?? '').trim()
  const minutes = Number(raw.minutes)
  if (!phaseKey || !Number.isFinite(minutes) || minutes < 0) return null
  return { phaseKey, minutes }
}

function applyAddOnToPlan(plan, addOnFocus, addOnMinutes) {
  if (!addOnFocus || addOnMinutes <= 0) return plan
  const rows = [...plan]
  const fitnessIdx = rows.findIndex((r) => r.phaseKey === 'sustained_capacity')
  if (addOnFocus === 'fitness' && fitnessIdx >= 0) {
    rows[fitnessIdx] = { ...rows[fitnessIdx], minutes: rows[fitnessIdx].minutes + addOnMinutes }
  }
  return rows
}

describe('phase plan template normalization', () => {
  it('accepts phase or phaseKey', () => {
    assert.deepEqual(normalizePhasePlanRow({ phase: 'output', minutes: 15 }), { phaseKey: 'output', minutes: 15 })
    assert.deepEqual(normalizePhasePlanRow({ phaseKey: 'output', minutes: 15 }), { phaseKey: 'output', minutes: 15 })
  })

  it('extends fitness phase for fitness add-on', () => {
    const plan = PHASE_ORDER.map((phaseKey, i) => ({ phaseKey, minutes: i === 5 ? 5 : 8 }))
    const updated = applyAddOnToPlan(plan, 'fitness', 10)
    const fitness = updated.find((p) => p.phaseKey === 'sustained_capacity')
    assert.equal(fitness.minutes, 15)
  })
})
