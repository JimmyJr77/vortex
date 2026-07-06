import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgrammingPlacement, scoreProgrammingMethodForBlock } from '../programmingValidation.js'

describe('programmingValidation', () => {
  it('flags hard conditioning before output phase', () => {
    const issues = analyzeProgrammingPlacement({
      blocks: [
        { phase_key: 'sustained_capacity', block_format: 'amrap', programming_method_id: 1 },
        { phase_key: 'output', block_format: 'straight_sets' },
      ],
    }, new Map([['1', { programming_type: 'amrap' }]]))
    assert.ok(issues.some((i) => i.ruleKey === 'conditioning_before_output'))
  })

  it('warns when sustained capacity block lacks quality standard', () => {
    const issues = analyzeProgrammingPlacement({
      blocks: [
        { phase_key: 'sustained_capacity', block_format: 'amrap', programming_method_id: 2 },
      ],
    }, new Map([['2', { programming_type: 'amrap' }]]))
    assert.ok(issues.some((i) => i.ruleKey === 'missing_quality_standards'))
  })

  it('scores youth away from high fatigue methods', () => {
    const method = {
      phase_profiles: [{ phaseKey: 'sustained_capacity', role: 'primary' }],
      fatigue_profile: { fatigue_level: 'high' },
      workout_builder_rules: { group_friendly: true },
      primary_development_goal: 'repeatability',
    }
    const youthScore = scoreProgrammingMethodForBlock(method, { phaseKey: 'sustained_capacity', youth: true, groupSize: 12 })
    const adultScore = scoreProgrammingMethodForBlock(method, { phaseKey: 'sustained_capacity', youth: false, groupSize: 12 })
    assert.ok(adultScore > youthScore)
  })

  it('boosts group-friendly methods for large groups', () => {
    const method = {
      phase_profiles: [{ phaseKey: 'capacity', role: 'secondary' }],
      fatigue_profile: { fatigue_level: 'moderate' },
      workout_builder_rules: { group_friendly: true },
    }
    const large = scoreProgrammingMethodForBlock(method, { phaseKey: 'capacity', groupSize: 12 })
    const small = scoreProgrammingMethodForBlock(method, { phaseKey: 'capacity', groupSize: 4 })
    assert.ok(large > small)
  })
})
