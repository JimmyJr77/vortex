import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isHighlightNotification } from '../notificationHighlight.js'

describe('isHighlightNotification', () => {
  it('includes @mentions', () => {
    assert.equal(isHighlightNotification('message_mention', { mentioned: true }), true)
  })

  it('includes critical messages', () => {
    assert.equal(isHighlightNotification('message', { critical: true, thread_id: 1 }), true)
  })

  it('excludes routine thread replies', () => {
    assert.equal(isHighlightNotification('message', { thread_id: 1, message_id: 2 }), false)
  })

  it('includes other kinds like assignments', () => {
    assert.equal(isHighlightNotification('assignment', {}), true)
  })
})
