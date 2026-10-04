import test from 'node:test'
import assert from 'node:assert/strict'
import { dailyRosterIsDue, startDailyRosterScheduler } from '../dailyRosterScheduler.js'

test('daily roster starts at 11 UTC in both daylight and standard time', () => {
  for (const month of ['01', '07']) {
    assert.equal(dailyRosterIsDue(new Date(`2026-${month}-04T10:59:59Z`)), false)
    assert.equal(dailyRosterIsDue(new Date(`2026-${month}-04T11:00:00Z`)), true)
  }
})

test('retries failed/suppressed delivery, catches up after startup, and sends once per date', async () => {
  let current = new Date('2026-10-04T10:00:00Z')
  const dates = []
  const outcomes = [new Error('SMTP unavailable'), { sent: false, reason: 'hard_bounce' }, { sent: true }, { sent: false, reason: 'duplicate' }]
  const job = startDailyRosterScheduler({}, {
    enabled: true, now: () => current, configured: () => true,
    logger: { log() {}, error() {} },
    send: async (_pool, { date }) => {
      dates.push(date)
      const outcome = outcomes.shift()
      if (outcome instanceof Error) throw outcome
      return { delivery: outcome }
    },
  })
  try {
    await job.run()
    assert.equal(dates.length, 0)
    current = new Date('2026-10-04T14:00:00Z')
    await job.run()
    await job.run()
    await job.run()
    await job.run()
    assert.deepEqual(dates, ['2026-10-04', '2026-10-04', '2026-10-04'])
    current = new Date('2026-10-05T11:00:00Z')
    await job.run()
    await job.run()
    assert.equal(dates.length, 4)
  } finally { job.stop() }
})

test('disabled scheduler never sends', () => {
  assert.equal(startDailyRosterScheduler({}, { enabled: false, send: () => assert.fail('sent') }), null)
})
