import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  MessageDisplayGroup,
  MessagePinGroup,
  MessagingRole,
  PinFilterMode,
  SuperPinGroup,
} from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface PinGroupsResponse {
  mine: MessagePinGroup[]
  super: SuperPinGroup[]
}

export function useThreadPinGroups(
  threadId: number | null,
  role: MessagingRole,
  fetcher: Fetcher,
) {
  const [pinFilter, setPinFilter] = useState<PinFilterMode>('off')
  const [pinSelection, setPinSelection] = useState<Set<number> | null>(null)
  const [mine, setMine] = useState<MessagePinGroup[]>([])
  const [superGroups, setSuperGroups] = useState<SuperPinGroup[]>([])
  const [saving, setSaving] = useState(false)

  const apiBase = `/api/${role}/messages`

  const refresh = useCallback(async () => {
    if (threadId == null) {
      setMine([])
      setSuperGroups([])
      return
    }
    const data = await fetcher(`${apiBase}/${threadId}/pin-groups`) as PinGroupsResponse
    setMine(Array.isArray(data.mine) ? data.mine : [])
    setSuperGroups(Array.isArray(data.super) ? data.super : [])
  }, [apiBase, fetcher, threadId])

  useEffect(() => {
    setPinFilter('off')
    setPinSelection(null)
    void refresh()
  }, [threadId, refresh])

  const togglePinFilter = useCallback((mode: 'mine' | 'super') => {
    if (pinSelection) return
    setPinFilter((prev) => (prev === mode ? 'off' : mode))
  }, [pinSelection])

  const startPinSelection = useCallback((messageId: number) => {
    setPinFilter('off')
    setPinSelection(new Set([messageId]))
  }, [])

  const togglePinSelectionMessage = useCallback((messageId: number) => {
    setPinSelection((prev) => {
      if (!prev) return prev
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next.size > 0 ? next : null
    })
  }, [])

  const cancelPinSelection = useCallback(() => {
    setPinSelection(null)
  }, [])

  const savePinSelection = useCallback(async () => {
    if (threadId == null || !pinSelection || pinSelection.size === 0) return
    setSaving(true)
    try {
      await fetcher(`${apiBase}/${threadId}/pin-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_ids: [...pinSelection] }),
      })
      setPinSelection(null)
      await refresh()
    } finally {
      setSaving(false)
    }
  }, [apiBase, fetcher, pinSelection, refresh, threadId])

  const unpinGroup = useCallback(async (groupId: number) => {
    if (threadId == null) return
    setSaving(true)
    try {
      await fetcher(`${apiBase}/${threadId}/pin-groups/${groupId}`, { method: 'DELETE' })
      await refresh()
    } finally {
      setSaving(false)
    }
  }, [apiBase, fetcher, refresh, threadId])

  const findOwnedGroupForMessage = useCallback(
    (messageId: number) => mine.find((group) => group.message_ids.includes(messageId)),
    [mine],
  )

  const displayGroups = useMemo((): MessageDisplayGroup[] | undefined => {
    if (pinFilter === 'off') return undefined
    if (pinFilter === 'mine') {
      return mine.map((group) => ({ groupId: group.id, messageIds: group.message_ids }))
    }
    return superGroups.map((group) => ({ messageIds: group.message_ids }))
  }, [mine, pinFilter, superGroups])

  const unpinMessage = useCallback(
    async (messageId: number) => {
      const group = findOwnedGroupForMessage(messageId)
      if (!group) return
      await unpinGroup(group.id)
    },
    [findOwnedGroupForMessage, unpinGroup],
  )

  return {
    pinFilter,
    togglePinFilter,
    pinSelection,
    startPinSelection,
    togglePinSelectionMessage,
    cancelPinSelection,
    savePinSelection,
    unpinMessage,
    findOwnedGroupForMessage,
    displayGroups,
    refresh,
    saving,
    pinSelectionActive: pinSelection != null,
  }
}
