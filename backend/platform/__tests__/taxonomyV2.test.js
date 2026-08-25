import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EQUIPMENT_V2_KEYS,
  TAXONOMY_V2_FACETS,
  evaluateTaxonomyV2Completeness,
  normalizeTaxonomyV2Assignment,
  normalizeTaxonomyV2Decision,
  resolveEquipmentV2Key,
  taxonomyV2Catalog,
  taxonomyV2Term,
  validateTaxonomyV2Assignments,
} from '../taxonomyV2.js'

test('Taxonomy v2 keys are unique inside each controlled facet', () => {
  for (const [facetType, terms] of Object.entries(TAXONOMY_V2_FACETS)) {
    assert.equal(new Set(terms.map((entry) => entry.key)).size, terms.length, facetType)
    assert.ok(terms.every((entry) => entry.scopes.length > 0), facetType)
  }
})

test('Taxonomy v2 keeps semantically distinct terms in their correct facets', () => {
  assert.ok(taxonomyV2Term('tenet', 'strength'))
  assert.ok(taxonomyV2Term('training_family', 'calisthenics'))
  assert.equal(taxonomyV2Term('methodology', 'calisthenics'), null)
  assert.ok(taxonomyV2Term('physiology_mechanism', 'hypertrophy'))
  assert.equal(taxonomyV2Term('methodology', 'hypertrophy'), null)
  assert.ok(taxonomyV2Term('conditioning_protocol', 'hiit'))
  assert.equal(taxonomyV2Term('methodology', 'hiit'), null)
  assert.ok(taxonomyV2Term('force_velocity', 'strength_speed'))
  assert.equal(taxonomyV2Term('athletic_niche', 'first_step_quickness').key, 'first_step_quickness')
  assert.equal(taxonomyV2Term('athletic_niche', 'acceleration').key, 'acceleration')
  assert.equal(taxonomyV2Term('athletic_niche', 'deceleration').key, 'deceleration')
  assert.equal(taxonomyV2Term('athletic_niche', 'change_of_direction').key, 'change_of_direction')
})

test('Taxonomy v2 completeness distinguishes missing data from reviewed not-applicable decisions', () => {
  assert.deepEqual(normalizeTaxonomyV2Decision({
    facetType: 'conditioning_protocol',
    scope: 'delivery_profile',
    decision: 'not_applicable',
    rationale: 'This is a low-fatigue technical profile, not conditioning.',
  }), {
    facetType: 'conditioning_protocol',
    scope: 'delivery_profile',
    decision: 'not_applicable',
    rationale: 'This is a low-fatigue technical profile, not conditioning.',
    confidence: 50,
    reviewStatus: 'suggested',
    provenance: {},
  })
  assert.throws(() => normalizeTaxonomyV2Decision({
    facetType: 'conditioning_protocol',
    scope: 'delivery_profile',
    decision: 'not_applicable',
  }), /require a rationale/)

  const result = evaluateTaxonomyV2Completeness({
    assignments: [{ facetType: 'training_family', reviewStatus: 'approved' }],
    decisions: [{ facetType: 'movement_character', decision: 'not_applicable', reviewStatus: 'approved' }],
  }, 'definition')
  assert.equal(result.complete, true)
  assert.deepEqual(result.issues, [])
})

test('Taxonomy v2 assignment validation enforces scope, scores, review, and duplicates', () => {
  assert.deepEqual(normalizeTaxonomyV2Assignment({
    facetType: 'training_family',
    key: 'olympic_weightlifting',
    scope: 'variant',
    role: 'primary',
    weight: 5,
    confidence: 80,
    reviewStatus: 'review',
  }), {
    facetType: 'training_family',
    key: 'olympic_weightlifting',
    scope: 'variant',
    role: 'primary',
    weight: 5,
    confidence: 80,
    reviewStatus: 'review',
    provenance: {},
  })

  assert.throws(() => normalizeTaxonomyV2Assignment({
    facetType: 'programming_clock_structure',
    key: 'emom',
    scope: 'definition',
  }), /cannot be assigned at definition scope/)
  assert.throws(() => normalizeTaxonomyV2Assignment({
    facetType: 'training_family',
    key: 'powerlifting',
    scope: 'definition',
    reviewStatus: 'approved',
  }), /require a reviewer/)

  const duplicate = validateTaxonomyV2Assignments([
    { facetType: 'training_family', key: 'powerlifting', scope: 'definition' },
    { facetType: 'training_family', key: 'powerlifting', scope: 'definition' },
  ])
  assert.equal(duplicate.valid, false)
  assert.match(duplicate.errors[0].message, /Duplicate/)
})

test('equipment v2 resolves safe aliases and quarantines ambiguous generic terms', () => {
  assert.ok(EQUIPMENT_V2_KEYS.includes('force_plate'))
  assert.deepEqual(resolveEquipmentV2Key('Bodyweight'), { key: 'none', status: 'alias', source: 'bodyweight' })
  assert.deepEqual(resolveEquipmentV2Key('Dumbbells'), { key: 'dumbbell', status: 'alias', source: 'dumbbells' })
  assert.deepEqual(resolveEquipmentV2Key('Wall Ball'), { key: 'wall_ball', status: 'canonical', source: 'wall_ball' })
  assert.deepEqual(resolveEquipmentV2Key('rope'), { key: null, status: 'ambiguous', source: 'rope' })
  assert.deepEqual(resolveEquipmentV2Key('bands'), { key: null, status: 'ambiguous', source: 'bands' })
})

test('taxonomy v2 catalog returns detached scope arrays for API serialization', () => {
  const first = taxonomyV2Catalog()
  first.training_family[0].scopes.push('changed')
  const second = taxonomyV2Catalog()
  assert.equal(second.training_family[0].scopes.includes('changed'), false)
})
