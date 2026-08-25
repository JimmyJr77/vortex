import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['src/coach/flipFitPrescription.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node20',
})

const source = result.outputFiles[0].text
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const flipFit = await import(moduleUrl)
const program = flipFit.generateFlipFitProgram('2026-08-24')

test('every age-specific scheduled prescription fits its exercise allocation', () => {
  assert.deepEqual(flipFit.validateFlipFitPrescriptionFit(program), [])
})

test('scheduled prescriptions provide concrete reps, distance, duration, or attempts', () => {
  const modes = new Set()
  for (const session of program.sessions) {
    const exercises = [...session.phases.flatMap((phase) => phase.exercises), ...session.tumbling.exercises]
    for (const exercise of exercises) {
      for (const ageBand of flipFit.FLIP_FIT_AGE_BANDS) {
        const prescription = flipFit.buildFlipFitScheduledPrescription(exercise, ageBand)
        modes.add(prescription.mode)
        assert.ok(
          prescription.reps != null
          || prescription.distanceMeters != null
          || prescription.durationSeconds != null
          || prescription.attempts != null,
          `${exercise.id} ${ageBand} has no concrete dose`,
        )
      }
    }
  }
  assert.deepEqual([...modes].sort(), ['attempts', 'continuous', 'distance', 'duration', 'repetitions'])
})
