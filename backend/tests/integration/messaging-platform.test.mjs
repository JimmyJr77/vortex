import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { messageHasContent } from '../../platform/messageContent.js'
import { parseMentions } from '../../platform/criticalAlerts.js'

describe('messaging platform integration', () => {
  it('accepts attachment-only or text messages', () => {
    assert.equal(messageHasContent('', { url: 'https://x.test/f.pdf' }), true)
    assert.equal(messageHasContent('hello', null), true)
    assert.equal(messageHasContent('', null), false)
  })

  it('parses @mentions for notifications', () => {
    const m = parseMentions('@user:1 please see @member:99')
    assert.equal(m.length, 2)
  })
})
