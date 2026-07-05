import { describe, expect, it } from 'vitest'
import { isHighlightNotification } from '../notificationHighlight.js'

describe('isHighlightNotification', () => {
  it('includes @mentions', () => {
    expect(isHighlightNotification('message_mention', { mentioned: true })).toBe(true)
  })

  it('includes critical messages', () => {
    expect(isHighlightNotification('message', { critical: true, thread_id: 1 })).toBe(true)
  })

  it('excludes routine thread replies', () => {
    expect(isHighlightNotification('message', { thread_id: 1, message_id: 2 })).toBe(false)
  })

  it('includes other kinds like assignments', () => {
    expect(isHighlightNotification('assignment', {})).toBe(true)
  })
})
