import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  composeEmailHtml,
  EMAIL_LOGO_CID,
  EMAIL_LOGO_URL,
  emailLogoUrl,
  normalizeOutboundEmailHtml,
  preheaderHtml,
} from '../emailHtml.js'

test('composeEmailHtml uses black header, white body, grey footer, and logo', () => {
  const html = composeEmailHtml('<p>Hello</p>')
  assert.match(html, /background-color:#000000/i)
  assert.match(html, /background-color:#ffffff/i)
  assert.match(html, /background-color:#e5e5e5/i)
  assert.match(html, new RegExp(escapeRegex(`cid:${EMAIL_LOGO_CID}`)))
  assert.equal(emailLogoUrl(), EMAIL_LOGO_URL)
  assert.match(html, /<p>Hello<\/p>/)
  assert.match(html, /www\.vortexathletics\.com/)
  assert.doesNotMatch(html, /border:1px solid #c41e3a/i)
})

test('normalizeOutboundEmailHtml wraps fragments and preserves preheader', () => {
  const pre = preheaderHtml('Preview text')
  const wrapped = normalizeOutboundEmailHtml(`${pre}<p>Body copy</p>`)
  assert.match(wrapped, /data-vortex-email-layout="vortex"/)
  assert.match(wrapped, /Preview text/)
  assert.match(wrapped, /<p>Body copy<\/p>/)
})

test('normalizeOutboundEmailHtml unwraps legacy full documents', () => {
  const wrapped = normalizeOutboundEmailHtml(`<!DOCTYPE html><html><body><p>Legacy</p></body></html>`)
  assert.match(wrapped, /data-vortex-email-layout="vortex"/)
  assert.match(wrapped, /<p>Legacy<\/p>/)
})

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
