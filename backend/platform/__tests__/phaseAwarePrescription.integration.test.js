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
