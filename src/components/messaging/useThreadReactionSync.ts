import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { MessageReactionGroup, MessageRow, MessagingRole } from './types'

type ReactionSnapshot = Record<string, MessageReactionGroup[]>

interface ThreadReactionSyncOptions {
  role: MessagingRole
  threadId: number | null
  activeThreadId: RefObject<number | null>
  detailRequest: RefObject<number>
  ready: boolean
  fetcher: (endpoint: string, options?: RequestInit) => Promise<unknown>
  setMessages: Dispatch<SetStateAction<MessageRow[]>>
}

interface ReactionSyncSession {
  threadId: number
  invalidate: () => void
  flush: () => void
  applyMutation: (messageId: number, reactions: MessageReactionGroup[], generation: number) => void
}

const NO_REACTIONS: MessageReactionGroup[] = []

function sameReactions(before: MessageReactionGroup[], after: MessageReactionGroup[]): boolean {
  return before.length === after.length && before.every((reaction, index) => {
    const next = after[index]
    return reaction.emoji === next.emoji && reaction.count === next.count
      && Boolean(reaction.reacted_by_viewer) === Boolean(next.reacted_by_viewer)
  })
}

function updateReactions(messages: MessageRow[], getReactions: (message: MessageRow) => MessageReactionGroup[]) {
  let changed = false
  const next = messages.map((message) => {
    const existing = message.reactions ?? NO_REACTIONS
    const reactions = getReactions(message)
    if (sameReactions(existing, reactions)) return message
    changed = true
    return { ...message, reactions }
  })
  return changed ? next : messages
}

function isReactionSnapshot(data: unknown): data is ReactionSnapshot {
  return data != null && typeof data === 'object' && !Array.isArray(data)
    && Object.values(data).every((groups) => Array.isArray(groups) && groups.every((group) =>
      group != null && typeof group.emoji === 'string' && Number.isInteger(group.count)
      && (group.reacted_by_viewer === undefined || typeof group.reacted_by_viewer === 'boolean')))
}

export function useThreadReactionSync({
  role, threadId, activeThreadId, detailRequest, ready, fetcher, setMessages,
}: ThreadReactionSyncOptions) {
  const generation = detailRequest.current
  const latest = useRef({ ready, generation, fetcher, setMessages })
  const sessionRef = useRef<ReactionSyncSession | null>(null)

  useLayoutEffect(() => {
    latest.current = { ready, generation, fetcher, setMessages }
  }, [ready, generation, fetcher, setMessages])

  useEffect(() => {
    if (threadId == null) return

    const controller = new AbortController()
    let pending = false
    let inFlight = false
    let mutationVersion = 0

    const isActive = () => !controller.signal.aborted && activeThreadId.current === threadId
    const canApply = (requestedGeneration: number) => isActive() && latest.current.ready
      && requestedGeneration === detailRequest.current && requestedGeneration === latest.current.generation

    async function refresh() {
      const requestedGeneration = detailRequest.current
      if (!pending || inFlight || !canApply(requestedGeneration)) return
      pending = false
      inFlight = true
      const startedVersion = mutationVersion

      try {
        const snapshot = await latest.current.fetcher(`/api/${role}/messages/${threadId}/reactions`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!isActive()) return
        if (!canApply(requestedGeneration) || startedVersion !== mutationVersion) {
          pending = true
          return
        }
        if (!isReactionSnapshot(snapshot)) return

        latest.current.setMessages((messages) => {
          if (!canApply(requestedGeneration) || startedVersion !== mutationVersion) return messages
          return updateReactions(messages, ({ id }) => snapshot[String(id)] ?? NO_REACTIONS)
        })
      } catch {
        // Keep the displayed reactions if the connection dropped or authorization changed.
      } finally {
        inFlight = false
        if (pending) void refresh()
      }
    }

    const session: ReactionSyncSession = {
      threadId,
      invalidate() {
        if (!isActive()) return
        pending = true
        void refresh()
      },
      flush: () => void refresh(),
      applyMutation(messageId, reactions, originatingGeneration) {
        if (!isActive()) return
        mutationVersion += 1
        if (canApply(originatingGeneration)) {
          latest.current.setMessages((messages) => {
            if (!canApply(originatingGeneration)) return messages
            return updateReactions(messages, (message) =>
              Number(message.id) === Number(messageId) ? reactions : message.reactions ?? NO_REACTIONS)
          })
        }
        // Refresh after our own response in case another viewer changed the aggregate in flight.
        pending = true
        void refresh()
      },
    }
    sessionRef.current = session
    return () => {
      controller.abort()
      if (sessionRef.current === session) sessionRef.current = null
    }
  }, [activeThreadId, detailRequest, role, threadId])

  useEffect(() => {
    if (ready) sessionRef.current?.flush()
  }, [generation, ready, threadId])

  const invalidateReactions = useCallback((targetThreadId: number) => {
    const session = sessionRef.current
    if (session?.threadId === targetThreadId) session.invalidate()
  }, [])

  const applyReactionMutation = useCallback((messageId: number, reactions: MessageReactionGroup[]) => {
    const session = sessionRef.current
    if (session && session.threadId === threadId) session.applyMutation(messageId, reactions, generation)
  }, [generation, threadId])

  return { invalidateReactions, applyReactionMutation }
}
