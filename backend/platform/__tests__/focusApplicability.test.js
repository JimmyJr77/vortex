import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PHASE_FOCUS_KEYS,
  focusKeysForPhase,
  isFocusKeyApplicable,
} from '../focusApplicability.js'
import { CANONICAL_PHASE_ORDER } from '../sessionPhaseKeys.js'

test('focus applicability covers every canonical phase and focus facet', () => {
  for (const phaseKey of CANONICAL_PHASE_ORDER) {
    assert.ok(PHASE_FOCUS_KEYS[phaseKey], `missing policy for ${phaseKey}`)
    for (const facetType of ['tenet', 'methodology', 'physiology']) {
      assert.ok(Array.isArray(PHASE_FOCUS_KEYS[phaseKey][facetType]), `${phaseKey}.${facetType} must be explicit`)
    }
  }
})

test('Prepare & Access cannot select Explosiveness as a tenet focus', () => {
  assert.equal(isFocusKeyApplicable('prepare_and_access', 'tenet', 'explosiveness'), false)
  assert.deepEqual(focusKeysForPhase('prepare_and_access', 'tenet'), [
    'flexibility',
    'balance',
    'coordination',
    'body_control',
  ])
})

test('fatigue-creating and high-output focuses stay in their phase homes', () => {
  assert.equal(isFocusKeyApplicable('sustained_capacity', 'methodology', 'hiit'), true)
  assert.equal(isFocusKeyApplicable('prepare_and_access', 'methodology', 'hiit'), false)
  assert.equal(isFocusKeyApplicable('output', 'tenet', 'explosiveness'), true)
  assert.equal(isFocusKeyApplicable('restore', 'tenet', 'explosiveness'), false)
})

test('a facet can be intentionally unavailable for a phase', () => {
  assert.deepEqual(focusKeysForPhase('sustained_capacity', 'tenet'), [])
  assert.deepEqual(focusKeysForPhase('restore', 'physiology'), ['recovery_downregulation'])
})
