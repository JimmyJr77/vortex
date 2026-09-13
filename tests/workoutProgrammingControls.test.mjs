import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { normalizeCoachWorkoutRequest } from '../backend/platform/workoutProgrammingRequest.js'

// Compile the browser-only, type-import-only adapter without pulling server modules into its runtime.
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/coach/workoutProgramming.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
})
const { newProgrammingRequest, programmingRequestForSubmit, requestFromSaved } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('default coach controls submit a valid athletic session and retain inactive Body Control preferences', () => {
  const request = newProgrammingRequest()
  request.components.find((component) => component.key === 'body_control').priorities = [{ facet: 'tenet', value: 'flexibility', strength: 'preferred' }]
  request.athletes[0].limitations = ['  Respect existing restriction  ', '', 'Respect existing restriction']
  const normalized = normalizeCoachWorkoutRequest(programmingRequestForSubmit(request))
  assert.deepEqual(normalized.components.map((component) => component.key), ['prepare_and_access', 'explosiveness', 'strength', 'capacity_competition'])
  assert.deepEqual(normalized.athletes[0].limitations, ['Respect existing restriction'])
  assert.equal(request.components.length, 5)
  assert.equal(request.components[4].priorities.length, 1)
  request.logistics.tumblingMinutes = 30
  request.logistics.totalBookedMinutes = 90
  assert.equal(normalizeCoachWorkoutRequest(programmingRequestForSubmit(request)).components[4].priorities.length, 1)
})

test('reusing saved controls creates a fresh valid request and restores equipment aliases and optional tumbling controls', () => {
  const intent = normalizeCoachWorkoutRequest(programmingRequestForSubmit(newProgrammingRequest()))
  const restored = requestFromSaved({ workout: { intent } })
  assert.notEqual(restored.requestId, intent.requestId)
  assert.notEqual(restored.revision, intent.revision)
  assert.deepEqual(restored.equipment.available, ['bodyweight'])
  assert.equal(restored.components.length, 5)
  assert.equal(restored.components[4].equipment.allowed, undefined)
  assert.ok(restored.components.every((component) => !component.lockedBlocks.length))
  assert.equal(normalizeCoachWorkoutRequest(programmingRequestForSubmit(restored)).components.length, 4)
  restored.logistics.tumblingMinutes = 30
  restored.logistics.totalBookedMinutes = 90
  assert.equal(normalizeCoachWorkoutRequest(programmingRequestForSubmit(restored)).components[4].budgetSeconds, 1800)
})
