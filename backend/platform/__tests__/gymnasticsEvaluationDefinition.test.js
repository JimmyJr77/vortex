import test from 'node:test'
import assert from 'node:assert/strict'
import { GYMNASTICS_EVALUATION_DEFINITION, buildGymnasticsFocusReport } from '../gymnasticsEvaluationDefinition.js'

test('gymnastics evaluation definition includes required movements, variants, and supplied issues', () => {
  const byKey = new Map(GYMNASTICS_EVALUATION_DEFINITION.map((movement) => [movement.key, movement]))
  for (const key of ['forward_roll', 'back_roll', 'cartwheel', 'handstand', 'bridge', 'back_walkover', 'splits', 'backbend']) assert.ok(byKey.has(key))
  assert.deepEqual(byKey.get('cartwheel').variants, ['Left', 'Right'])
  assert.deepEqual(byKey.get('splits').variants, ['Left', 'Right', 'Sideways'])
  assert.ok(byKey.get('forward_roll').components.flatMap((component) => component.defaultIssues).includes('Hard landing'))
  assert.ok(byKey.get('back_roll').components.flatMap((component) => component.defaultIssues).includes('Hands not by shoulders/ears'))
  assert.ok(byKey.get('handstand').components.flatMap((component) => component.defaultIssues).includes('Does not squeeze butt'))
})

test('focus report converts low scores and selected issues into constructive focus language', () => {
  const report = buildGymnasticsFocusReport({
    coachNote: 'Keep building confidence.',
    movements: [{ label: 'Handstand', components: [
      { label: 'Entry control', score: 2, issues: ['Crashes into wall'] },
      { label: 'Pointed toes', score: 5, issues: [] },
    ] }],
  })
  assert.equal(report.focus.length, 2)
  assert.match(report.focus[0].text, /Build more consistency/i)
  assert.match(report.focus[1].text, /Focus on entry control/i)
  assert.equal(report.strengths[0].text, 'Strong pointed toes.')
  assert.equal(report.coachNote, 'Keep building confidence.')
  assert.equal(JSON.stringify(report).match(/missed|subpar/i), null)
})
