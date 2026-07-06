import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  phaseIndex,
  itemSeconds,
  blockSeconds,
  computePriorFatigue,
  computeTimeSummary,
  PHASE_ORDER,
  analyzePrepareAccessDrain,
  analyzePrepareLowerLegReadiness,
  analyzePrepareHipAccessReadiness,
  analyzePrepareActivationReadiness,
} from '../workoutValidation.js'

describe('workoutValidation helpers', () => {
  it('orders phases correctly', () => {
    assert.equal(phaseIndex('prepare_access'), 0)
    assert.equal(phaseIndex('output'), 2)
    assert.equal(phaseIndex('restore'), PHASE_ORDER.length - 1)
    assert.equal(phaseIndex('unknown'), 999)
  })

  it('computes item and block seconds', () => {
    assert.equal(itemSeconds({ sets: 3, work_seconds: 30, rest_seconds: 20 }), 150)
    assert.equal(blockSeconds({ rounds: 2, rest_between_rounds_seconds: 10, items: [{ sets: 2, work_seconds: 20, rest_seconds: 10 }] }), 130)
  })

  it('accumulates prior fatigue from profiles and fitness phase', () => {
    const blockMeta = [
      { phaseKey: 'fitness_repeatability', block: { items: [{ exercise_id: 1, exercise_name: 'Burpees' }] } },
      { phaseKey: 'output', block: { items: [{ exercise_id: 2, exercise_name: 'Sprint' }] } },
    ]
    const profileByExercisePhase = new Map([
      ['1:fitness_repeatability', { fatigue_cost: 4 }],
    ])
    const regimenByExercise = new Map()
    const fatigue = computePriorFatigue(blockMeta, 1, profileByExercisePhase, regimenByExercise)
    assert.ok(fatigue >= 4)
  })

  it('computes time summary against budget', () => {
    const blockMeta = [
      { block: { rounds: 1, items: [{ sets: 2, work_seconds: 60, rest_seconds: 0 }] } },
    ]
    const time = computeTimeSummary(blockMeta, 2)
    assert.equal(time.planned_seconds, 120)
    assert.equal(time.budget_seconds, 120)
    assert.equal(time.delta_seconds, 0)
  })

  it('flags prepare blocks that steal output readiness', () => {
    const profileByExercisePhase = new Map([
      ['1:prepare_access', { fatigue_cost: 4, impact_level: 0, intensity_ceiling: 'low' }],
      ['2:prepare_access', { fatigue_cost: 3, impact_level: 3, intensity_ceiling: 'moderate' }],
    ])
    const methodologyKeysByExercise = new Map([
      ['3', ['hiit']],
    ])
    const dosageByExercise = new Map([
      ['4', { default_work_seconds: 60, default_sets: 2 }],
    ])
    const drain = analyzePrepareAccessDrain(
      [
        { exercise_id: 1, exercise_name: 'Heavy drill' },
        { exercise_id: 2, exercise_name: 'Impact drill' },
        { exercise_id: 3, exercise_name: 'HIIT drill' },
        { exercise_id: 4, exercise_name: 'Long plank' },
      ],
      {
        profileByExercisePhase,
        methodologyKeysByExercise,
        dosageByExercise,
        phaseKey: 'prepare_access',
      },
    )
    assert.equal(drain.counts.high_fatigue, 2)
    assert.equal(drain.counts.conditioning_like, 1)
    assert.equal(drain.stealsOutput, true)
  })

  it('flags excessive pogo contacts in prepare lower-leg analysis', () => {
    const slugByExercise = new Map([['1', 'low-pogos']])
    const dosageByExercise = new Map([['1', { default_sets: 1, default_contacts: 20 }]])
    const findings = analyzePrepareLowerLegReadiness(
      [{ exercise_id: 1, exercise_name: 'Low Pogos', contacts: 50 }],
      { slugByExercise, dosageByExercise, profileByExercisePhase: new Map(), blockMeta: [], prepareBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'prepare_pogos_output_dose'))
  })

  it('flags excessive jump rope duration in prepare lower-leg analysis', () => {
    const slugByExercise = new Map([['2', 'jump-rope-easy-bounce']])
    const dosageByExercise = new Map([['2', { default_sets: 1, default_work_seconds: 60 }]])
    const findings = analyzePrepareLowerLegReadiness(
      [{ exercise_id: 2, exercise_name: 'Jump Rope', work_seconds: 120 }],
      { slugByExercise, dosageByExercise, profileByExercisePhase: new Map(), blockMeta: [], prepareBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'prepare_jump_rope_fitness_dose'))
  })

  it('flags excessive deep squat pry duration in hip-access analysis', () => {
    const slugByExercise = new Map([['3', 'deep-squat-pry']])
    const dosageByExercise = new Map([['3', { default_sets: 1, default_work_seconds: 30 }]])
    const findings = analyzePrepareHipAccessReadiness(
      [{ exercise_id: 3, exercise_name: 'Deep Squat Pry', work_seconds: 90 }],
      { slugByExercise, dosageByExercise, profileByExercisePhase: new Map(), methodologyKeysByExercise: new Map(), blockMeta: [], prepareBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'prepare_squat_pry_duration'))
  })

  it('flags excessive frontal-plane reps before output in hip-access analysis', () => {
    const slugByExercise = new Map([['4', 'cossack-shift']])
    const dosageByExercise = new Map([['4', { default_sets: 1, default_reps: 6 }]])
    const blockMeta = [
      { phaseKey: 'prepare_access', block: {} },
      { phaseKey: 'output', block: {} },
    ]
    const findings = analyzePrepareHipAccessReadiness(
      [{ exercise_id: 4, exercise_name: 'Cossack Shift', sets: 3, reps: 8 }],
      { slugByExercise, dosageByExercise, profileByExercisePhase: new Map(), methodologyKeysByExercise: new Map(), blockMeta, prepareBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'prepare_frontal_plane_fatigue'))
  })

  it('flags excessive glute bridge reps in activation analysis', () => {
    const slugByExercise = new Map([['5', 'glute-bridge']])
    const dosageByExercise = new Map([['5', { default_sets: 1, default_reps: 8 }]])
    const findings = analyzePrepareActivationReadiness(
      [{ exercise_id: 5, exercise_name: 'Glute Bridge', sets: 2, reps: 10 }],
      { slugByExercise, dosageByExercise, blockMeta: [], prepareBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'prepare_glute_bridge_dose'))
  })

  it('flags excessive mini-band lateral walk steps in activation analysis', () => {
    const slugByExercise = new Map([['6', 'mini-band-lateral-walk']])
    const dosageByExercise = new Map([['6', { default_sets: 1, default_reps: 8 }]])
    const findings = analyzePrepareActivationReadiness(
      [{ exercise_id: 6, exercise_name: 'Mini-Band Lateral Walk', sets: 2, reps: 14 }],
      { slugByExercise, dosageByExercise, blockMeta: [], prepareBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'prepare_mini_band_lateral_dose'))
  })

  it('flags A-March after conditioning in activation analysis', () => {
    const slugByExercise = new Map([['7', 'a-march']])
    const dosageByExercise = new Map([['7', { default_sets: 1, default_rpe_max: 4 }]])
    const blockMeta = [
      { phaseKey: 'fitness_repeatability', block: {} },
      { phaseKey: 'prepare_access', block: {} },
    ]
    const findings = analyzePrepareActivationReadiness(
      [{ exercise_id: 7, exercise_name: 'A-March' }],
      { slugByExercise, dosageByExercise, blockMeta, prepareBlockIndex: 1 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'prepare_amarch_after_conditioning'))
  })
})
