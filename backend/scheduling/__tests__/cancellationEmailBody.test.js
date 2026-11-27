import assert from 'node:assert/strict'
import test from 'node:test'
import { cancellationEmailBody } from '../calendarCancellationNotifications.js'

test('cancellation letters separate the class details and the standard closing into paragraphs', () => {
  const body = cancellationEmailBody([{ className: 'Tumbling', date: '2030-01-07', startTime: '16:00', endTime: '17:00' }], '2030-01-07')
  assert.match(body, /\n\nTumbling — Monday, January 7, 2030, 4:00 PM–5:00 PM\n\n/)
  assert.match(body, /\n\nWarmly,\nThe Vortex Athletics Team$/)
})

test('empty full-day closures keep paragraph spacing without a blank session section', () => {
  const body = cancellationEmailBody([], '2030-01-07', { fullDay: true })
  assert.match(body, /all classes and trials on Monday, January 7, 2030 have been canceled\.\n\nWe apologize/)
  assert.doesNotMatch(body, /\n{3,}/)
  assert.match(body, /\n\nWarmly,\nThe Vortex Athletics Team$/)
})
