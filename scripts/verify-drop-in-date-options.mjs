import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/utils/dropInDateOptions.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { getDropInDateOptions } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const session = (date, startTime = '17:30', overrides = {}) => ({
  classId: 9, slotGroupId: 41, date, startTime, isFull: false, ...overrides,
})

test('selected-day options stay with the chosen class and include full sessions in time order', () => {
  const late = session('2026-11-18', '19:00')
  const full = session('2026-11-18', '16:00', { isFull: true })
  const sessions = [late, session('2026-11-18', '15:00', { classId: 12 }), full]
  const { onSelectedDate } = getDropInDateOptions(sessions, 9, '2026-11-18')
  assert.deepEqual(onSelectedDate, [full, late])
  assert.equal(sessions[0], late, 'sorting does not mutate the API data')
})

test('alternatives exclude the chosen day, earlier days, full sessions, and other classes', () => {
  const available = session('2026-11-20', '18:00', { slotGroupId: 55 })
  const sessions = [
    session('2026-11-17'), session('2026-11-18'),
    session('2026-11-19', '17:30', { isFull: true }),
    session('2026-11-19', '17:30', { classId: 12 }), available,
  ]
  const { alternatives } = getDropInDateOptions(sessions, 9, '2026-11-18')
  assert.deepEqual(alternatives, [available])
  assert.equal(alternatives[0], available, 'the selected alternative keeps its actual booking date and slot')
})

test('alternatives use chronological date/time order and stop at six', () => {
  const sessions = [
    session('2026-11-24'), session('2026-11-23'), session('2026-11-22'),
    session('2026-11-21'), session('2026-11-20'), session('2026-11-19', '19:00'),
    session('2026-11-19', '16:00'), session('2026-11-25'),
  ]
  const { alternatives } = getDropInDateOptions(sessions, 9, '2026-11-18')
  assert.deepEqual(alternatives.map(({ date, startTime }) => `${date} ${startTime}`), [
    '2026-11-19 16:00', '2026-11-19 19:00', '2026-11-20 17:30',
    '2026-11-21 17:30', '2026-11-22 17:30', '2026-11-23 17:30',
  ])
})

test('no class or no date produces no alternate booking suggestions', () => {
  assert.deepEqual(getDropInDateOptions([session('2026-11-20')], null, '2026-11-18'), { onSelectedDate: [], alternatives: [] })
  assert.deepEqual(getDropInDateOptions([session('2026-11-20')], 9, ''), { onSelectedDate: [], alternatives: [] })
})
