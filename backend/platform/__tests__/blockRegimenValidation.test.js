import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateTrainingBlockDraft } from '../trainingBlockValidation.js'
import { validateRegimenDraft } from '../regimenValidation.js'

describe('validateTrainingBlockDraft', () => {
  it('requires a name', async () => {
    const result = await validateTrainingBlockDraft(null, { sessions: [] })
    assert.equal(result.status, 'error')
    assert.ok(result.errors.some((e) => e.rule_key === 'name_required'))
  })

  it('warns on back-to-back hard neural days', async () => {
    const result = await validateTrainingBlockDraft(null, {
      name: 'Test',
      duration_days: 7,
      sessions_per_week: 3,
      rule: { minimum_hours_between_hard_neural: 48 },
      sessions: [
        { day_index: 1, neural_load: 5, duration_minutes: 60 },
        { day_index: 2, neural_load: 5, duration_minutes: 60 },
      ],
    })
    assert.ok(result.warnings.some((w) => w.rule_key === 'neural_recovery_gap'))
  })
})

describe('validateRegimenDraft', () => {
  it('warns when phase minutes mismatch session duration', async () => {
    const result = await validateRegimenDraft(null, {
      name: 'Test',
      duration_type: '60',
      weeks: 4,
      sessions_per_week: 3,
      phase_distributions: [
        { phase_key: 'prepare_and_access', default_minutes: 5 },
        { phase_key: 'capacity', default_minutes: 80 },
      ],
    })
    assert.ok(result.warnings.some((w) => w.rule_key === 'phase_minutes_mismatch'))
  })

  it('recommends phase distribution when empty', async () => {
    const result = await validateRegimenDraft(null, { name: 'Test', duration_type: '60', weeks: 4, sessions_per_week: 3, phase_distributions: [] })
    assert.ok(result.recommendations.some((r) => r.rule_key === 'no_phase_distribution'))
  })
})
