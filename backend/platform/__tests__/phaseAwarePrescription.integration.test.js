import assert from 'node:assert/strict'
import test from 'node:test'
import { runPhaseAwarePrescription } from '../phaseAwarePrescription.js'
import { exerciseViolatesEquipmentAvoid } from '../equipmentAvoidPolicy.js'
import { isBeginnerExcludedSlug } from '../beginnerExclusionPolicy.js'
import { allowedSkillLevelsFor } from '../skillLevelPolicy.js'

test('beginner skill filter allows early stage and beginner only', () => {
  const allowed = allowedSkillLevelsFor('BEGINNER')
  assert.ok(allowed?.has('BEGINNER'))
  assert.ok(allowed?.has('EARLY_STAGE'))
  assert.ok(!allowed?.has('ADVANCED'))
})

test('beginner excludes handstand slugs', () => {
  assert.equal(isBeginnerExcludedSlug('wall-handstand-hold', 'Wall Handstand Hold'), true)
  assert.equal(isBeginnerExcludedSlug('snap-down-to-stick', 'Snap Down to Stick'), false)
})

test('semantic box avoid catches drop landing slug', () => {
  assert.equal(
    exerciseViolatesEquipmentAvoid({ slug: 'drop-landing-stick', name: 'Drop Landing to Stick' }, [], new Set(), ['box']),
    true,
  )
})

test('prescription scenario: beginner excludes handstand from scored pool', async () => {
  const exercises = [
    { id: 1, name: 'Handstand Hold', slug: 'handstand-hold', programming_kind: 'exercise', default_sets: 2, default_reps: null, default_rest_seconds: 30, est_seconds_per_set: 45, facility_id: 1, archived: false, is_published: true, skill_level: 'ADVANCED', movement_family: 'handstand' },
    { id: 2, name: 'Snap Down to Stick', slug: 'snap-down-to-stick', programming_kind: 'exercise', default_sets: 3, default_reps: 3, default_rest_seconds: 30, est_seconds_per_set: 45, facility_id: 1, archived: false, is_published: true, skill_level: 'BEGINNER', movement_family: 'jump' },
  ]
  const pool = {
    query: async (sql, params) => {
      if (sql.includes('FROM coaching.session_phase')) {
        return { rows: [{ id: 3, key: 'movement_intelligence', name: 'Movement Intelligence' }] }
      }
      if (sql.includes('FROM coaching.exercise e WHERE')) {
        return {
          rows: exercises.filter((e) => !e.skill_level || e.skill_level === 'BEGINNER' || e.skill_level === 'EARLY_STAGE'),
        }
      }
      if (sql.includes('FROM coaching.exercise_tag')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_phase_profile')) {
        return {
          rows: [
            { exercise_id: 1, phase_id: 3, phase_key: 'movement_intelligence', role: 'primary', fit_weight: 8, order_slot: null, notes: null, impact_level: 2, order_index: 1, freshness_required: false, fatigue_sensitivity: 1, fatigue_cost: 1, technical_complexity: 8, intensity_ceiling: null },
            { exercise_id: 2, phase_id: 3, phase_key: 'movement_intelligence', role: 'primary', fit_weight: 8, order_slot: null, notes: null, impact_level: 1, order_index: 1, freshness_required: false, fatigue_sensitivity: 1, fatigue_cost: 1, technical_complexity: 3, intensity_ceiling: null },
          ],
        }
      }
      if (sql.includes('FROM coaching.exercise_difficulty_profile')) {
        return {
          rows: [
            { exercise_id: 1, technical: 6, load: 4, overall: 6, recommended_age_min: null, recommended_age_max: null, attention_demand: 8, notes: null, source: 'derived' },
            { exercise_id: 2, technical: 4, load: 3, overall: 4, recommended_age_min: null, recommended_age_max: null, attention_demand: 4, notes: null, source: 'derived' },
          ],
        }
      }
      if (sql.includes('FROM coaching.equipment WHERE')) return { rows: [] }
      if (sql.includes('entity_type =')) return { rows: [] }
      if (sql.includes('exercise_scaling_profile') || sql.includes('exercise_dosage_profile') || sql.includes('exercise_safety_profile') || sql.includes('exercise_regimen_rule')) {
        return { rows: [] }
      }
      return { rows: [] }
    },
  }
  const result = await runPhaseAwarePrescription(pool, 1, {
    skillLevel: 'BEGINNER',
    ageMin: 8,
    ageMax: 14,
    phasePlan: [{ phaseKey: 'movement_intelligence', minutes: 13, label: 'MI' }],
  })
  const names = result.blocks.flatMap((b) => b.items.map((it) => it.exercise_name))
  assert.ok(!names.some((n) => /handstand/i.test(n)))
  assert.ok(names.includes('Snap Down to Stick'))
})

test('prescription scenario: 120-min explosiveness fitness with HIIT sustained and restore gates', async () => {
  const fitnessSportId = 10
  const barId = 20
  const medBallId = 21
  const conesId = 22
  const hiitMethodId = 30
  const explosivenessTenetId = 40

  const exercises = [
    { id: 101, name: 'Cossack Shift', slug: 'cossack-shift', programming_kind: 'exercise', primary_phase_key: 'prepare_and_access', sport_id: fitnessSportId, default_sets: 2, default_reps: 6, default_rest_seconds: 20, est_seconds_per_set: 40, facility_id: 1, archived: false, is_published: true, skill_level: 'INTERMEDIATE', movement_family: 'hip_mobility' },
    { id: 113, name: 'Dead Bug', slug: 'dead-bug-heel-tap', programming_kind: 'exercise', primary_phase_key: 'prepare_and_access', sport_id: null, default_sets: 2, default_reps: 8, default_rest_seconds: 20, est_seconds_per_set: 35, facility_id: 1, archived: false, is_published: true, skill_level: 'INTERMEDIATE', movement_family: 'core_prep' },
    { id: 102, name: 'Bird Dog', slug: 'bird-dog', programming_kind: 'exercise', primary_phase_key: 'movement_intelligence', sport_id: null, default_sets: 2, default_reps: 6, default_rest_seconds: 20, est_seconds_per_set: 35, facility_id: 1, archived: false, is_published: true, skill_level: 'INTERMEDIATE', movement_family: 'core' },
    { id: 103, name: 'Football Catch Drill', slug: 'jog-cut-catch-scan-drill', programming_kind: 'exercise', primary_phase_key: 'movement_intelligence', sport_id: fitnessSportId, default_sets: 2, default_reps: 5, default_rest_seconds: 30, est_seconds_per_set: 45, facility_id: 1, archived: false, is_published: true, skill_level: 'INTERMEDIATE', movement_family: 'catch' },
    { id: 104, name: 'Single-Leg Pogo', slug: 'single-leg-pogo', programming_kind: 'exercise', primary_phase_key: 'output', sport_id: fitnessSportId, default_sets: 3, default_reps: 8, default_rest_seconds: 30, est_seconds_per_set: 50, facility_id: 1, archived: false, is_published: true, skill_level: 'INTERMEDIATE', movement_family: 'pogo' },
    { id: 105, name: 'Ankle Pogo', slug: 'ankle-pogo-in-place', programming_kind: 'exercise', primary_phase_key: 'output', sport_id: fitnessSportId, default_sets: 2, default_reps: 12, default_rest_seconds: 30, est_seconds_per_set: 45, facility_id: 1, archived: false, is_published: true, skill_level: 'INTERMEDIATE', movement_family: 'pogo' },
    { id: 106, name: 'Med Ball Toss', slug: 'med-ball-scoop-toss', programming_kind: 'exercise', primary_phase_key: 'output', sport_id: fitnessSportId, default_sets: 3, default_reps: 3, default_rest_seconds: 60, est_seconds_per_set: 90, facility_id: 1, archived: false, is_published: true, skill_level: 'INTERMEDIATE', movement_family: 'throw' },
    { id: 107, name: 'Inverted Row', slug: 'inverted-row', programming_kind: 'exercise', primary_phase_key: 'capacity', sport_id: fitnessSportId, default_sets: 3, default_reps: 8, default_rest_seconds: 45, est_seconds_per_set: 120, facility_id: 1, archived: false, is_published: true, skill_level: 'INTERMEDIATE', movement_family: 'row' },
    { id: 108, name: 'Box Drop Stick', slug: 'low-box-drop-stick', programming_kind: 'exercise', primary_phase_key: 'resilience', sport_id: fitnessSportId, default_sets: 3, default_reps: 4, default_rest_seconds: 45, est_seconds_per_set: 90, facility_id: 1, archived: false, is_published: true, skill_level: 'INTERMEDIATE', movement_family: 'landing' },
    { id: 109, name: 'Cone Shuttle HIIT', slug: 'cone-shuttle-touch-hiit-fitness', programming_kind: 'exercise', primary_phase_key: 'sustained_capacity', phase_subrole: 'conditioning_intervals', sport_id: fitnessSportId, default_sets: 4, default_reps: 4, default_rest_seconds: 25, est_seconds_per_set: 45, facility_id: 1, archived: false, is_published: true, skill_level: 'INTERMEDIATE', movement_family: 'shuttle' },
    { id: 110, name: 'Med Ball HIIT', slug: 'med-ball-squat-press-hiit-fitness', programming_kind: 'exercise', primary_phase_key: 'sustained_capacity', phase_subrole: 'conditioning_intervals', sport_id: fitnessSportId, default_sets: 3, default_reps: 8, default_rest_seconds: 30, est_seconds_per_set: 60, facility_id: 1, archived: false, is_published: true, skill_level: 'INTERMEDIATE', movement_family: 'medball' },
    { id: 111, name: 'Box Breathing', slug: 'box-breathing-hold-restore', programming_kind: 'exercise', primary_phase_key: 'restore', sport_id: fitnessSportId, default_sets: 2, default_reps: 4, default_work_seconds: 60, default_rest_seconds: 15, est_seconds_per_set: 75, facility_id: 1, archived: false, is_published: true, skill_level: 'BEGINNER', movement_family: 'breathing' },
    { id: 112, name: 'Step-Behind Throw', slug: 'step-behind-rotational-medicine-ball-throw', programming_kind: 'exercise', primary_phase_key: 'output', sport_id: fitnessSportId, default_sets: 3, default_reps: 3, default_rest_seconds: 60, est_seconds_per_set: 90, facility_id: 1, archived: false, is_published: true, skill_level: 'INTERMEDIATE', movement_family: 'throw' },
  ]

  const phaseProfiles = [
    { exercise_id: 101, phase_key: 'prepare_and_access', role: 'primary', fit_weight: 5, impact_level: 0, intensity_ceiling: 'low', fatigue_cost: 1 },
    { exercise_id: 113, phase_key: 'prepare_and_access', role: 'primary', fit_weight: 5, impact_level: 0, intensity_ceiling: 'low', fatigue_cost: 1 },
    { exercise_id: 102, phase_key: 'movement_intelligence', role: 'primary', fit_weight: 5, impact_level: 0, intensity_ceiling: 'low', fatigue_cost: 1 },
    { exercise_id: 103, phase_key: 'movement_intelligence', role: 'primary', fit_weight: 5, impact_level: 1, intensity_ceiling: 'moderate', fatigue_cost: 2 },
    { exercise_id: 104, phase_key: 'output', role: 'primary', fit_weight: 5, impact_level: 2, intensity_ceiling: 'high', fatigue_cost: 2 },
    { exercise_id: 105, phase_key: 'output', role: 'primary', fit_weight: 5, impact_level: 2, intensity_ceiling: 'high', fatigue_cost: 2 },
    { exercise_id: 106, phase_key: 'output', role: 'primary', fit_weight: 5, impact_level: 2, intensity_ceiling: 'high', fatigue_cost: 2 },
    { exercise_id: 107, phase_key: 'capacity', role: 'primary', fit_weight: 5, impact_level: 1, intensity_ceiling: 'moderate', fatigue_cost: 2 },
    { exercise_id: 108, phase_key: 'resilience', role: 'primary', fit_weight: 5, impact_level: 1, intensity_ceiling: 'moderate', fatigue_cost: 2 },
    { exercise_id: 109, phase_key: 'sustained_capacity', role: 'primary', fit_weight: 5, impact_level: 2, intensity_ceiling: 'moderate', fatigue_cost: 4 },
    { exercise_id: 110, phase_key: 'sustained_capacity', role: 'primary', fit_weight: 5, impact_level: 2, intensity_ceiling: 'moderate', fatigue_cost: 4 },
    { exercise_id: 111, phase_key: 'restore', role: 'primary', fit_weight: 5, impact_level: 0, intensity_ceiling: 'low', fatigue_cost: 1, order_slot: 'cooldown_breathing' },
    { exercise_id: 112, phase_key: 'restore', role: 'conditional', fit_weight: 2, impact_level: 2, intensity_ceiling: 'high', fatigue_cost: 3 },
  ]

  const tags = [
    { exercise_id: 106, facet_type: 'equipment', facet_id: medBallId },
    { exercise_id: 107, facet_type: 'equipment', facet_id: barId },
    { exercise_id: 109, facet_type: 'equipment', facet_id: conesId },
    { exercise_id: 109, facet_type: 'methodology', facet_id: hiitMethodId },
    { exercise_id: 110, facet_type: 'equipment', facet_id: medBallId },
    { exercise_id: 110, facet_type: 'methodology', facet_id: hiitMethodId },
    { exercise_id: 104, facet_type: 'tenet', facet_id: explosivenessTenetId },
    { exercise_id: 106, facet_type: 'tenet', facet_id: explosivenessTenetId },
  ]

  const difficulties = exercises.map((e) => ({
    exercise_id: e.id, technical: 4, load: 3, overall: 4, recommended_age_min: 8, recommended_age_max: 14, attention_demand: 4,
  }))

  const phaseIdMap = {
    prepare_and_access: 1,
    movement_intelligence: 2,
    output: 3,
    capacity: 4,
    resilience: 5,
    sustained_capacity: 6,
    restore: 7,
  }

  const mockPool = {
    query: async (sql, params) => {
      if (sql.includes('FROM coaching.methodology')) {
        return { rows: [{ id: hiitMethodId, key: 'hiit' }, { id: 31, key: 'mobility_flexibility' }, { id: 32, key: 'plyometrics' }] }
      }
      if (sql.includes('FROM coaching.exercise_intent')) return { rows: [{ id: 1, key: 'conditioning' }] }
      if (sql.includes('FROM coaching.sport')) {
        if (sql.includes('WHERE id =')) return { rows: [{ key: 'fitness' }] }
        return { rows: [{ id: fitnessSportId, key: 'fitness' }, { id: 99, key: 'football' }] }
      }
      if (sql.includes('FROM coaching.session_phase')) {
        return {
          rows: Object.entries(phaseIdMap).map(([key, id]) => ({ id, key, name: key })),
        }
      }
      if (sql.includes('FROM coaching.exercise e WHERE')) return { rows: exercises }
      if (sql.includes('FROM coaching.exercise_tag')) {
        return { rows: tags.map((t) => ({ ...t, weight: 5 })) }
      }
      if (sql.includes('FROM coaching.exercise_phase_profile')) {
        return {
          rows: phaseProfiles.map((p) => ({
            ...p,
            phase_id: phaseIdMap[p.phase_key],
            phase_name: p.phase_key,
            order_index: 1,
            freshness_required: false,
            fatigue_sensitivity: 2,
            technical_complexity: 3,
            notes: null,
          })),
        }
      }
      if (sql.includes('FROM coaching.exercise_difficulty_profile')) return { rows: difficulties }
      if (sql.includes('FROM coaching.equipment WHERE')) {
        return { rows: [{ id: barId, name: 'Bar' }, { id: medBallId, name: 'Medicine Ball' }, { id: conesId, name: 'Cones' }] }
      }
      if (sql.includes('entity_type =')) return { rows: [] }
      if (sql.includes('exercise_scaling_profile') || sql.includes('exercise_dosage_profile') || sql.includes('exercise_safety_profile') || sql.includes('exercise_regimen_rule')) {
        return { rows: [] }
      }
      if (sql.includes('FROM coaching.tenet')) {
        return { rows: [{ id: explosivenessTenetId, key: 'explosiveness' }] }
      }
      if (sql.includes('FROM coaching.phase_order_slot')) return { rows: [] }
      return { rows: [] }
    },
  }

  const result = await runPhaseAwarePrescription(mockPool, 1, {
    workMode: 'exercise',
    sportId: fitnessSportId,
    skillLevel: 'INTERMEDIATE',
    ageMin: 8,
    ageMax: 14,
    sessionObjective: 'explosiveness_power_priority',
    equipmentUseIds: [barId, medBallId, conesId],
    audienceSplits: [
      { label: 'Split 1', ageMin: 8, ageMax: 10, difficultyOverride: 6 },
      { label: 'Split 2', ageMin: 11, ageMax: 14, difficultyOverride: 10 },
    ],
    phasePlan: [
      { phaseKey: 'prepare_and_access', minutes: 10, label: 'Prepare' },
      { phaseKey: 'movement_intelligence', minutes: 13, label: 'MI' },
      { phaseKey: 'output', minutes: 42, label: 'Output', focusTargets: [{ facetType: 'tenet', facetKey: 'explosiveness' }] },
      { phaseKey: 'capacity', minutes: 34, label: 'Capacity' },
      { phaseKey: 'resilience', minutes: 15, label: 'Resilience' },
      { phaseKey: 'sustained_capacity', minutes: 4, label: 'Sustained', focusTargets: [{ facetType: 'methodology', facetKey: 'hiit' }] },
      { phaseKey: 'restore', minutes: 2, label: 'Restore' },
    ],
  })

  const byPhase = Object.fromEntries(result.blocks.map((b) => [b.phase_key, b]))
  const allSlugs = result.blocks.flatMap((b) => b.items.map((it) => {
    const ex = exercises.find((e) => e.id === it.exercise_id)
    return ex?.slug
  })).filter(Boolean)

  assert.ok(byPhase.sustained_capacity.items.length >= 2, 'HIIT sustained should have at least 2 items')
  assert.ok(!allSlugs.includes('step-behind-rotational-medicine-ball-throw'), 'restore should exclude explosive throw')
  assert.ok(byPhase.restore.items.some((it) => /breathing/i.test(it.exercise_name)), 'restore should pick breathing card')
  assert.ok(byPhase.movement_intelligence.items.some((it) => it.exercise_name === 'Bird Dog'), 'MI should prefer general fitness over football catch')
  assert.equal(new Set(allSlugs).size, allSlugs.length, 'no duplicate slugs session-wide')
  assert.ok(byPhase.prepare_and_access.items.length >= 2)
  assert.ok(result.constraint_report?.phase_fill?.length === 7)
})
