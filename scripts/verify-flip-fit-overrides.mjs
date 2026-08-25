import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['src/coach/flipFitOverrides.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node20',
})

const source = result.outputFiles[0].text
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const flipFit = await import(moduleUrl)

function fixtureProgram() {
  const session = {
    id: 'flip-fit-w01-d1',
    objective: 'Original objective',
  }
  return {
    sessions: [session],
    weeks: [{ days: [session] }],
  }
}

test('normalizes only stable Flip & Fit session override fields', () => {
  assert.deepEqual(flipFit.normalizeFlipFitSessionOverrides({
    'flip-fit-w01-d1': { objective: '  Coach objective  ', coachNotes: '  Keep landing quiet.  ', unsafe: true },
    '../not-a-session': { objective: 'Ignore me' },
  }), {
    'flip-fit-w01-d1': { objective: 'Coach objective', coachNotes: 'Keep landing quiet.' },
  })
})

test('applies objective and notes to sessions and their weekly references', () => {
  const program = fixtureProgram()
  const updated = flipFit.applyFlipFitSessionOverrides(program, {
    'flip-fit-w01-d1': { objective: 'Edited objective', coachNotes: 'Athlete set note' },
  })
  assert.equal(updated.sessions[0].objective, 'Edited objective')
  assert.equal(updated.weeks[0].days[0], updated.sessions[0])
  assert.equal(flipFit.flipFitCoachNotes(updated.sessions[0]), 'Athlete set note')
  assert.equal(program.sessions[0].objective, 'Original objective')
})
