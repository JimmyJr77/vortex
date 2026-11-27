import assert from 'node:assert/strict'
import test from 'node:test'
import { classSwapEmailBody, validateClassSwapEmailBody } from '../classSwapNotifications.js'
import { normalizeOutboundEmailHtml, normalizeOutboundEmailText, plainTextToEmailHtml } from '../../email/emailHtml.js'

test('one-time class-change letter names both occurrences without altering regular tuition or enrollment', () => {
  const body=classSwapEmailBody({mode:'temporary',athleteName:'Avery Rivera',effectiveDate:'2030-01-09',
    originalSessions:['Tumbling, Friday, January 11, 2030, 4:00 PM–5:00 PM'],
    replacementSessions:['Gymnastics, Wednesday, January 9, 2030, 5:00 PM–6:00 PM']})
  assert.match(body,/Dear Avery Rivera’s family/)
  assert.match(body,/Original session: Tumbling, Friday, January 11, 2030, 4:00 PM–5:00 PM/)
  assert.match(body,/Replacement session: Gymnastics, Wednesday, January 9, 2030, 5:00 PM–6:00 PM/)
  assert.match(body,/regular enrollment and tuition remain unchanged/)
  assert.match(body,/\n\nWarmly,\nThe Vortex Athletics Team$/)
  assert.doesNotMatch(body,/return.*(?:after|following).*replacement/i,
    'a replacement can occur before the original session without redefining the regular schedule')
})

test('permanent letter lists every replacement and uses a neutral effective date without inventing billing promises', () => {
  const body=classSwapEmailBody({mode:'permanent',athleteName:'Avery Rivera',effectiveDate:'2030-01-07',
    originalSessions:['Package, Monday, 4:00 PM–5:00 PM','Package, Wednesday, 4:00 PM–5:00 PM'],
    replacementSessions:['Gymnastics, Tuesday, 5:00 PM–6:00 PM','Strength, Thursday, 5:00 PM–6:00 PM']})
  assert.match(body,/effective Monday, January 7, 2030/)
  assert.match(body,/\n\nPrevious schedule:\n[\s\S]*Monday[\s\S]*Wednesday/)
  assert.match(body,/\n\nUpdated schedule:\n[\s\S]*Tuesday[\s\S]*Thursday/)
  assert.match(body,/\n\nWarmly,\nThe Vortex Athletics Team$/)
  assert.doesNotMatch(body,/tuition|will change/)
  const html = normalizeOutboundEmailHtml(plainTextToEmailHtml(body))
  assert.match(html,/<p\b[^>]*>Previous schedule:<br\s*\/?>/)
  assert.match(html,/<p\b[^>]*>Updated schedule:<br\s*\/?>/)
  assert.equal((html.match(/Warmly,/g) || []).length,1)
  assert.equal((html.match(/The Vortex Athletics Team/g) || []).length,1)
  const text = normalizeOutboundEmailText(body)
  assert.equal((text.match(/Warmly,/g) || []).length,1)
  assert.match(text,/\n\nWarmly,\nThe Vortex Athletics Team\n\nVortex Gymnastics\n4961 Tesla Dr, Ste E, Bowie, MD 20715/)
})

test('edited parent letters preserve exact plain text while rejecting blank, oversized or promotional copy', () => {
  const body='Dear family,\n\nThe updated class is Thursday. Please bring <water> & reply with questions.\n'
  assert.equal(validateClassSwapEmailBody(body),body)
  assert.equal(validateClassSwapEmailBody(undefined),undefined)
  for(const value of ['', '   ', null, 123, 'x'.repeat(20001), 'Get a 20% off coupon'])assert.throws(()=>validateClassSwapEmailBody(value),error=>error.statusCode===400)
})
