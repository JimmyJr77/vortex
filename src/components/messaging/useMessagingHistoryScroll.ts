import { useCallback, useLayoutEffect, useRef } from 'react'
import { getScrollParent, scrollToEndWithinContainer } from './scrollMessagingContainer'

export function useMessagingHistoryScroll({
  threadId,
  visible,
  latestMessageId,
}: {
  threadId: number | null
  visible: boolean
  latestMessageId: number | undefined
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const position = useRef({ threadId, top: 0, following: true })

  useLayoutEffect(() => {
    if (position.current.threadId !== threadId) {
      position.current = { threadId, top: 0, following: true }
    }
    if (!visible) return

    const scroller = getScrollParent(messagesEndRef.current)
    if (!scroller) return
    if (position.current.following) scrollToEndWithinContainer(messagesEndRef.current, 'instant')
    else scroller.scrollTop = position.current.top

    const trackPosition = () => {
      position.current = {
        threadId,
        top: scroller.scrollTop,
        following: scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 64,
      }
    }

    scroller.addEventListener('scroll', trackPosition, { passive: true })
    return () => scroller.removeEventListener('scroll', trackPosition)
  }, [threadId, visible])

  useLayoutEffect(() => {
    if (visible && position.current.following) {
      scrollToEndWithinContainer(messagesEndRef.current, 'instant')
    }
  }, [latestMessageId, visible])

  const followLatest = useCallback(() => {
    position.current.following = true
    scrollToEndWithinContainer(messagesEndRef.current, 'instant')
  }, [])

  return { messagesEndRef, followLatest }
}
