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
  analyzeSkillMovementIntelligenceReadiness,
  analyzeSkillTumblingReadiness,
  analyzeSkillSprintReadiness,
  analyzeSkillPerceptionReadiness,
  analyzeSprintPrepBeforeOutput,
  analyzeOutputReadiness,
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

  it('flags skill block fatigue when RPE and fatigue cost are high', () => {
    const slugByExercise = new Map([['8', 'hollow-body-hold'], ['9', 'a-skip']])
    const profileByExercisePhase = new Map([
      ['8:skill_movement_intelligence', { fatigue_cost: 4 }],
      ['9:skill_movement_intelligence', { fatigue_cost: 5 }],
    ])
    const dosageByExercise = new Map([
      ['8', { default_rpe_max: 7 }],
      ['9', { default_rpe_max: 7 }],
    ])
    const findings = analyzeSkillMovementIntelligenceReadiness(
      [
        { exercise_id: 8, exercise_name: 'Hollow Hold', rpe: 7 },
        { exercise_id: 9, exercise_name: 'A-Skip', rpe: 7 },
      ],
      { slugByExercise, profileByExercisePhase, dosageByExercise, blockMeta: [], skillBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_block_fatigue'))
  })

  it('flags tumbling after fitness in skill analysis', () => {
    const slugByExercise = new Map([['10', 'forward-roll-progression']])
    const blockMeta = [
      { phaseKey: 'fitness_repeatability', block: {} },
      { phaseKey: 'skill_movement_intelligence', block: {} },
    ]
    const findings = analyzeSkillMovementIntelligenceReadiness(
      [{ exercise_id: 10, exercise_name: 'Forward Roll' }],
      { slugByExercise, profileByExercisePhase: new Map(), dosageByExercise: new Map(), blockMeta, skillBlockIndex: 1 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_tumbling_after_fitness'))
  })

  it('flags excessive ladder duration in skill analysis', () => {
    const slugByExercise = new Map([['11', 'ladder-in-in-out-out']])
    const dosageByExercise = new Map([['11', { default_sets: 1, default_work_seconds: 60 }]])
    const findings = analyzeSkillMovementIntelligenceReadiness(
      [{ exercise_id: 11, exercise_name: 'Ladder In-In-Out-Out', work_seconds: 120, rest_seconds: 5 }],
      { slugByExercise, profileByExercisePhase: new Map(), dosageByExercise, blockMeta: [], skillBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_agility_conditioning_dose'))
  })

  it('flags balance cluster after fitness in skill analysis', () => {
    const slugByExercise = new Map([['12', 'beam-walk']])
    const blockMeta = [
      { phaseKey: 'fitness_repeatability', block: {} },
      { phaseKey: 'skill_movement_intelligence', block: {} },
    ]
    const findings = analyzeSkillMovementIntelligenceReadiness(
      [{ exercise_id: 12, exercise_name: 'Beam Walk' }],
      { slugByExercise, profileByExercisePhase: new Map(), dosageByExercise: new Map(), blockMeta, skillBlockIndex: 1 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_balance_after_fitness'))
  })

  it('flags excessive ladder pass volume in skill analysis', () => {
    const slugByExercise = new Map([['13', 'ladder-ickey-shuffle']])
    const dosageByExercise = new Map([['13', { default_sets: 3, default_reps: 2 }]])
    const findings = analyzeSkillMovementIntelligenceReadiness(
      [{ exercise_id: 13, exercise_name: 'Ickey Shuffle', sets: 3, reps: 2 }],
      { slugByExercise, profileByExercisePhase: new Map(), dosageByExercise, blockMeta: [], skillBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_ladder_pass_volume'))
  })

  it('flags high-RPE skipping as Output drift in skill analysis', () => {
    const slugByExercise = new Map([['14', 'skipping-rhythm-drill']])
    const findings = analyzeSkillMovementIntelligenceReadiness(
      [{ exercise_id: 14, exercise_name: 'Skipping Rhythm', rpe: 7 }],
      { slugByExercise, profileByExercisePhase: new Map(), dosageByExercise: new Map(), blockMeta: [], skillBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_skipping_high_intensity'))
  })
})

describe('analyzeSkillPerceptionReadiness', () => {
  it('recommends lateral shuffle before mirror shuffle in same block', () => {
    const slugByExercise = new Map([['20', 'mirror-shuffle-drill']])
    const findings = analyzeSkillPerceptionReadiness(
      [{ exercise_id: 20, exercise_name: 'Mirror Shuffle' }],
      { slugByExercise, dosageByExercise: new Map(), blockMeta: [], skillBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_mirror_shuffle_prerequisite'))
  })

  it('warns when mirror round exceeds skill duration cap', () => {
    const slugByExercise = new Map([['21', 'mirror-shuffle-drill']])
    const findings = analyzeSkillPerceptionReadiness(
      [{ exercise_id: 21, exercise_name: 'Mirror Shuffle', work_seconds: 20 }],
      { slugByExercise, dosageByExercise: new Map(), blockMeta: [], skillBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_mirror_round_duration'))
  })

  it('errors on diving during ball drop when watch text flags dive', () => {
    const slugByExercise = new Map([['22', 'ball-drop-reaction']])
    const findings = analyzeSkillPerceptionReadiness(
      [{ exercise_id: 22, exercise_name: 'Ball Drop' }],
      {
        slugByExercise,
        dosageByExercise: new Map(),
        draft: { watch_points: ['athlete diving for ball'] },
        blockMeta: [],
        skillBlockIndex: 0,
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_ball_drop_diving' && f.severity === 'error'))
  })

  it('warns reactive drills after fitness block', () => {
    const slugByExercise = new Map([['23', 'gate-reaction-drill']])
    const blockMeta = [
      { phaseKey: 'fitness_repeatability', block: {} },
      { phaseKey: 'skill_movement_intelligence', block: {} },
    ]
    const findings = analyzeSkillPerceptionReadiness(
      [{ exercise_id: 23, exercise_name: 'Gate Reaction' }],
      { slugByExercise, dosageByExercise: new Map(), blockMeta, skillBlockIndex: 1 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_reactive_after_fitness'))
  })
})

describe('analyzeSkillTumblingReadiness', () => {
  function equipMap(exerciseId, entries) {
    const m = new Map()
    const weights = new Map(entries)
    m.set(String(exerciseId), weights)
    return m
  }

  it('errors when roll slug lacks mat equipment tag', () => {
    const findings = analyzeSkillTumblingReadiness(
      [{ exercise_id: 1, exercise_name: 'Log Roll', slug: 'log-roll' }],
      {
        slugByExercise: new Map([['1', 'log-roll']]),
        dosageByExercise: new Map(),
        equipmentKeysByExercise: equipMap(1, []),
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_roll_mat_required'))
  })

  it('warns when forward roll lacks prerequisite drills earlier in block', () => {
    const findings = analyzeSkillTumblingReadiness(
      [{ exercise_id: 2, exercise_name: 'Forward Roll', slug: 'forward-roll-progression' }],
      {
        slugByExercise: new Map([['2', 'forward-roll-progression']]),
        dosageByExercise: new Map(),
        equipmentKeysByExercise: equipMap(2, [['mat', 5]]),
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_forward_roll_prerequisite'))
  })

  it('warns when backward roll lacks wedge or panel mat equipment', () => {
    const findings = analyzeSkillTumblingReadiness(
      [{ exercise_id: 3, exercise_name: 'Backward Roll', slug: 'backward-roll-progression' }],
      {
        slugByExercise: new Map([['3', 'backward-roll-progression']]),
        dosageByExercise: new Map(),
        equipmentKeysByExercise: equipMap(3, [['mat', 5]]),
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_backward_roll_progression'))
  })

  it('errors on backward roll when neck symptoms are flagged', () => {
    const findings = analyzeSkillTumblingReadiness(
      [{ exercise_id: 3, exercise_name: 'Backward Roll', slug: 'backward-roll-progression' }],
      {
        slugByExercise: new Map([['3', 'backward-roll-progression']]),
        dosageByExercise: new Map(),
        equipmentKeysByExercise: equipMap(3, [['mat', 5], ['wedge', 4]]),
        draft: { watch_points: ['neck pressure during rolling'] },
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_backward_roll_neck_stop'))
  })

  it('errors when shoulder roll lacks mat equipment', () => {
    const findings = analyzeSkillTumblingReadiness(
      [{ exercise_id: 4, exercise_name: 'Shoulder Roll', slug: 'shoulder-roll-progression' }],
      {
        slugByExercise: new Map([['4', 'shoulder-roll-progression']]),
        dosageByExercise: new Map(),
        equipmentKeysByExercise: equipMap(4, []),
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_shoulder_roll_surface'))
  })

  it('warns when handstand hold exceeds 20 seconds', () => {
    const findings = analyzeSkillTumblingReadiness(
      [{ exercise_id: 5, exercise_name: 'Wall Walk', slug: 'wall-walk-handstand-line', work_seconds: 25 }],
      {
        slugByExercise: new Map([['5', 'wall-walk-handstand-line']]),
        dosageByExercise: new Map([['5', { default_work_seconds: 8 }]]),
        equipmentKeysByExercise: equipMap(5, [['wall', 5], ['mat', 4]]),
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_handstand_endurance'))
  })

  it('warns when donkey kick volume exceeds 10 attempts', () => {
    const findings = analyzeSkillTumblingReadiness(
      [{ exercise_id: 6, exercise_name: 'Donkey Kick', slug: 'donkey-kick', sets: 3, reps: 4 }],
      {
        slugByExercise: new Map([['6', 'donkey-kick']]),
        dosageByExercise: new Map([['6', { default_sets: 2, default_reps: 4 }]]),
        equipmentKeysByExercise: equipMap(6, [['mat', 4]]),
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_donkey_kick_volume'))
  })

  it('recommends line drill before step-over when out of order', () => {
    const findings = analyzeSkillTumblingReadiness(
      [
        { exercise_id: 7, exercise_name: 'Step Over', slug: 'cartwheel-step-over' },
        { exercise_id: 8, exercise_name: 'Line Drill', slug: 'cartwheel' },
      ],
      {
        slugByExercise: new Map([['7', 'cartwheel-step-over'], ['8', 'cartwheel']]),
        dosageByExercise: new Map(),
        equipmentKeysByExercise: new Map(),
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_cartwheel_hand_placement'))
  })

  it('recommends finish lunge before round-off when out of order', () => {
    const findings = analyzeSkillTumblingReadiness(
      [
        { exercise_id: 9, exercise_name: 'Round-Off', slug: 'round-off' },
        { exercise_id: 10, exercise_name: 'Finish Lunge', slug: 'cartwheel-finish-lunge' },
      ],
      {
        slugByExercise: new Map([['9', 'round-off'], ['10', 'cartwheel-finish-lunge']]),
        dosageByExercise: new Map(),
        equipmentKeysByExercise: new Map(),
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_cartwheel_finish'))
  })

  it('errors when round-off lacks cartwheel and handstand line prerequisites', () => {
    const findings = analyzeSkillTumblingReadiness(
      [{ exercise_id: 9, exercise_name: 'Round-Off', slug: 'round-off' }],
      {
        slugByExercise: new Map([['9', 'round-off']]),
        dosageByExercise: new Map(),
        equipmentKeysByExercise: new Map(),
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_roundoff_prerequisite'))
  })

  it('recommends hurdle balance work when hurdle follows tumbling without finish drill', () => {
    const findings = analyzeSkillTumblingReadiness(
      [
        { exercise_id: 9, exercise_name: 'Round-Off', slug: 'round-off' },
        { exercise_id: 11, exercise_name: 'Hurdle', slug: 'hurdle-step-lunge' },
      ],
      {
        slugByExercise: new Map([['9', 'round-off'], ['11', 'hurdle-step-lunge']]),
        dosageByExercise: new Map(),
        equipmentKeysByExercise: new Map(),
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_hurdle_entry_balance'))
  })

  it('errors when rotational stop symptoms appear with tumbling drills', () => {
    const findings = analyzeSkillTumblingReadiness(
      [{ exercise_id: 1, exercise_name: 'Log Roll', slug: 'log-roll' }],
      {
        slugByExercise: new Map([['1', 'log-roll']]),
        dosageByExercise: new Map(),
        equipmentKeysByExercise: equipMap(1, [['mat', 5]]),
        draft: { coach_rationale_json: { watch_points: ['athlete reported dizziness'] } },
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_rotational_stop'))
  })
})

describe('analyzeSkillSprintReadiness', () => {
  it('warns when wall ISO hold exceeds 8 seconds', () => {
    const slugByExercise = new Map([['1', 'wall-drill-split-shin-hold']])
    const dosageByExercise = new Map([['1', { default_work_seconds: 5 }]])
    const findings = analyzeSkillSprintReadiness(
      [{ exercise_id: 1, exercise_name: 'Wall ISO', work_seconds: 12 }],
      { slugByExercise, dosageByExercise, profileByExercisePhase: new Map(), blockMeta: [], skillBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_sprint_iso_hold_duration'))
  })

  it('warns when wall switch volume is excessive', () => {
    const slugByExercise = new Map([['2', 'wall-drill-switch']])
    const dosageByExercise = new Map([['2', { default_sets: 2, default_reps: 3 }]])
    const findings = analyzeSkillSprintReadiness(
      [{ exercise_id: 2, exercise_name: 'Wall Switch', sets: 3, reps: 4 }],
      { slugByExercise, dosageByExercise, profileByExercisePhase: new Map(), blockMeta: [], skillBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_sprint_switch_volume'))
  })

  it('recommends Output when A-Skip RPE is high', () => {
    const slugByExercise = new Map([['3', 'a-skip']])
    const dosageByExercise = new Map([['3', { default_rpe_max: 5 }]])
    const profileByExercisePhase = new Map([['3:skill_movement_intelligence', { impact_level: 1 }]])
    const findings = analyzeSkillSprintReadiness(
      [{ exercise_id: 3, exercise_name: 'A-Skip', rpe: 7 }],
      { slugByExercise, dosageByExercise, profileByExercisePhase, blockMeta: [], skillBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_sprint_high_intensity_drill'))
  })

  it('recommends regress when toe-down contacts are flagged', () => {
    const slugByExercise = new Map([['4', 'a-march']])
    const findings = analyzeSkillSprintReadiness(
      [{ exercise_id: 4, exercise_name: 'A-March' }],
      {
        slugByExercise,
        dosageByExercise: new Map(),
        profileByExercisePhase: new Map(),
        blockMeta: [],
        skillBlockIndex: 0,
        draft: { watch_points: ['toe pointing down on contacts'] },
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_sprint_toe_down'))
  })

  it('warns on backward lean during sprint mechanics', () => {
    const slugByExercise = new Map([['5', 'ankling-dribble-march']])
    const findings = analyzeSkillSprintReadiness(
      [{ exercise_id: 5, exercise_name: 'Ankling' }],
      {
        slugByExercise,
        dosageByExercise: new Map(),
        profileByExercisePhase: new Map(),
        blockMeta: [],
        skillBlockIndex: 0,
        draft: { watch_points: ['athlete leaning back'] },
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_sprint_backward_lean'))
  })

  it('recommends ISO when wall drills show hips behind body', () => {
    const slugByExercise = new Map([['6', 'wall-drill-march']])
    const findings = analyzeSkillSprintReadiness(
      [{ exercise_id: 6, exercise_name: 'Wall March' }],
      {
        slugByExercise,
        dosageByExercise: new Map(),
        profileByExercisePhase: new Map(),
        blockMeta: [],
        skillBlockIndex: 0,
        draft: { watch_points: ['hips sitting back on wall drill'] },
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_sprint_hip_projection'))
  })

  it('warns when falling start shows waist hinge', () => {
    const slugByExercise = new Map([['7', 'falling-start-hold']])
    const findings = analyzeSkillSprintReadiness(
      [{ exercise_id: 7, exercise_name: 'Falling Start Hold' }],
      {
        slugByExercise,
        dosageByExercise: new Map(),
        profileByExercisePhase: new Map(),
        blockMeta: [],
        skillBlockIndex: 0,
        draft: { watch_points: ['hinging at the waist during fall'] },
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_sprint_falling_hinge'))
  })

  it('recommends Output when two-point walk-in distance is too long', () => {
    const slugByExercise = new Map([['8', 'two-point-start-walk-in']])
    const dosageByExercise = new Map([['8', { default_distance: '10 yards' }]])
    const findings = analyzeSkillSprintReadiness(
      [{ exercise_id: 8, exercise_name: 'Two-Point Walk-In', distance: '10 yards' }],
      { slugByExercise, dosageByExercise, profileByExercisePhase: new Map(), blockMeta: [], skillBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_sprint_start_overreach'))
  })

  it('recommends seated arm drill when arms cross midline', () => {
    const slugByExercise = new Map([['9', 'arm-action-drill']])
    const findings = analyzeSkillSprintReadiness(
      [{ exercise_id: 9, exercise_name: 'Arm Action' }],
      {
        slugByExercise,
        dosageByExercise: new Map(),
        profileByExercisePhase: new Map(),
        blockMeta: [],
        skillBlockIndex: 0,
        draft: { watch_points: ['arms crossing midline'] },
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_sprint_arm_midline'))
  })

  it('warns when sprint mechanics follow fitness phase', () => {
    const slugByExercise = new Map([['10', 'wall-drill-march']])
    const blockMeta = [
      { phaseKey: 'fitness_repeatability', block: {} },
      { phaseKey: 'skill_movement_intelligence', block: {} },
    ]
    const findings = analyzeSkillSprintReadiness(
      [{ exercise_id: 10, exercise_name: 'Wall March' }],
      { slugByExercise, dosageByExercise: new Map(), profileByExercisePhase: new Map(), blockMeta, skillBlockIndex: 1 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_sprint_after_fitness'))
  })

  it('warns when sprint block precedes tumbling with high fatigue', () => {
    const slugByExercise = new Map([['11', 'a-skip'], ['12', 'forward-roll-progression']])
    const profileByExercisePhase = new Map([
      ['11:skill_movement_intelligence', { fatigue_cost: 4 }],
    ])
    const blockMeta = [
      { phaseKey: 'skill_movement_intelligence', block: { items: [{ exercise_id: 11 }] } },
      { phaseKey: 'skill_movement_intelligence', block: { items: [{ exercise_id: 12 }] } },
    ]
    const findings = analyzeSkillSprintReadiness(
      [{ exercise_id: 11, exercise_name: 'A-Skip' }],
      {
        slugByExercise,
        dosageByExercise: new Map(),
        profileByExercisePhase,
        blockMeta,
        skillBlockIndex: 0,
        draft: { watch_points: ['calf tightness after skips'] },
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'skill_sprint_before_tumbling_fatigue'))
  })
})

describe('analyzeSprintPrepBeforeOutput', () => {
  it('recommends sprint mechanics before speed Output', () => {
    const slugByExercise = new Map([['20', '10-yard-sprint']])
    const blockMeta = [
      { phaseKey: 'prepare_access', block: { items: [] } },
      { phaseKey: 'output', block: { items: [{ exercise_id: 20, exercise_name: '10-Yard Sprint' }] } },
    ]
    const finding = analyzeSprintPrepBeforeOutput(blockMeta, slugByExercise)
    assert.ok(finding)
    assert.equal(finding.rule_key, 'skill_sprint_missing_prep_before_output')
  })
})

describe('analyzeOutputReadiness', () => {
  it('errors when Output follows Fitness', () => {
    const blockMeta = [
      { phaseKey: 'fitness_repeatability', block: {} },
      { phaseKey: 'output', block: {} },
    ]
    const findings = analyzeOutputReadiness(
      [{ exercise_id: 1, exercise_name: 'Flying 10' }],
      { slugByExercise: new Map(), profileByExercisePhase: new Map(), dosageByExercise: new Map(), blockMeta, outputBlockIndex: 1 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'output_after_fitness' && f.severity === 'error'))
  })

  it('warns on high RPE with short rest in Output', () => {
    const dosageByExercise = new Map([['2', { default_rpe_max: 9, default_rest_seconds: 20 }]])
    const findings = analyzeOutputReadiness(
      [{ exercise_id: 2, exercise_name: 'Countermovement Jump', rpe: 8, rest_seconds: 20 }],
      { slugByExercise: new Map([['2', 'countermovement-vertical-jump']]), profileByExercisePhase: new Map(), dosageByExercise, blockMeta: [], outputBlockIndex: 0 },
    )
    assert.ok(findings.some((f) => f.rule_key === 'output_high_rpe_short_rest'))
  })

  it('errors on tumbling output without skill prerequisites', () => {
    const findings = analyzeOutputReadiness(
      [{ exercise_id: 3, exercise_name: 'Round-Off Rebound' }],
      {
        slugByExercise: new Map([['3', 'round-off-rebound-snap-down-to-stick']]),
        profileByExercisePhase: new Map(),
        dosageByExercise: new Map(),
        blockMeta: [],
        outputBlockIndex: 0,
        skillSlugsInWorkout: new Set(),
      },
    )
    assert.ok(findings.some((f) => f.rule_key === 'output_roundoff_rebound_prerequisite' && f.severity === 'error'))
  })
})
