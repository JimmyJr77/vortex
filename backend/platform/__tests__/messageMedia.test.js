import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { messageHasContent, normalizeMessageBodyForInsert } from '../messageContent.js'

describe('messageMedia', () => {
  it('allows attachment-only messages', () => {
    const attachment = { url: 'https://example.com/file.pdf', name: 'file.pdf', mime: 'application/pdf' }
    assert.equal(messageHasContent('', attachment), true)
    assert.equal(normalizeMessageBodyForInsert(''), '')
  })

  it('rejects empty message with no attachment', () => {
    assert.equal(messageHasContent('', null), false)
    assert.equal(messageHasContent('   ', null), false)
  })

  it('preserves trimmed text', () => {
    assert.equal(normalizeMessageBodyForInsert('  hello  '), 'hello')
  })
})
