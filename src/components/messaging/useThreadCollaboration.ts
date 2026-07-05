import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  closeThreadPoll,
  closeThreadSignupSheet,
  createThreadPoll,
  createThreadSignupSheet,
  fetchThreadPolls,
  fetchThreadSignupSheets,
} from './messagingApi'
import type { MessageChecklist, MessagePoll, MessageRow, MessagingRole, SignupSheetType } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

export type ThreadCollaborationPanelMode =
  | null
  | 'create-poll'
  | 'pick-poll'
  | 'view-poll'
  | 'create-signup'
  | 'pick-signup'
  | 'view-signup'

interface CreateSignupPayload {
  title: string
  sheet_type: SignupSheetType
  items?: { text: string }[]
  config?: Record<string, unknown>
  closes_at?: string | null
}

interface UseThreadCollaborationOptions {
  role: MessagingRole
  threadId: number | null
  fetcher: Fetcher
  onMessageCreated?: (message: MessageRow) => void
  onChanged?: () => void
}

export function useThreadCollaboration({
  role,
  threadId,
  fetcher,
  onMessageCreated,
  onChanged,
}: UseThreadCollaborationOptions) {
  const [panelMode, setPanelMode] = useState<ThreadCollaborationPanelMode>(null)
  const [polls, setPolls] = useState<MessagePoll[]>([])
  const [signups, setSignups] = useState<MessageChecklist[]>([])
  const [activePollId, setActivePollId] = useState<number | null>(null)
  const [activeSignupId, setActiveSignupId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!threadId) {
      setPolls([])
      setSignups([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [nextPolls, nextSignups] = await Promise.all([
        fetchThreadPolls(role, threadId, fetcher),
        fetchThreadSignupSheets(role, threadId, fetcher),
      ])
      setPolls(nextPolls)
      setSignups(nextSignups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load polls and signup lists')
    } finally {
      setLoading(false)
    }
  }, [fetcher, role, threadId])

  useEffect(() => {
    setPanelMode(null)
    setActivePollId(null)
    setActiveSignupId(null)
    void refresh()
  }, [refresh])

  const activePoll = useMemo(
    () => polls.find((poll) => poll.id != null && Number(poll.id) === activePollId) ?? null,
    [activePollId, polls],
  )
  const activeSignup = useMemo(
    () => signups.find((sheet) => sheet.id != null && Number(sheet.id) === activeSignupId) ?? null,
    [activeSignupId, signups],
  )

  const openPoll = useCallback((poll: MessagePoll) => {
    setActivePollId(poll.id != null ? Number(poll.id) : null)
    setPanelMode('view-poll')
  }, [])

  const openSignup = useCallback((signup: MessageChecklist) => {
    setActiveSignupId(signup.id != null ? Number(signup.id) : null)
    setPanelMode('view-signup')
  }, [])

  const createPoll = useCallback(async (payload: { question: string; options: string[]; closes_at?: string | null }) => {
    if (!threadId) return null
    const result = await createThreadPoll(role, threadId, fetcher, payload)
    if (result.message) onMessageCreated?.(result.message)
    await refresh()
    if (result.poll?.id != null) {
      setActivePollId(Number(result.poll.id))
      setPanelMode('view-poll')
    }
    onChanged?.()
    return result
  }, [fetcher, onChanged, onMessageCreated, refresh, role, threadId])

  const createSignup = useCallback(async (payload: CreateSignupPayload) => {
    if (!threadId) return null
    const result = await createThreadSignupSheet(role, threadId, fetcher, payload)
    if (result.message) onMessageCreated?.(result.message)
    await refresh()
    if (result.signup?.id != null) {
      setActiveSignupId(Number(result.signup.id))
      setPanelMode('view-signup')
    }
    onChanged?.()
    return result
  }, [fetcher, onChanged, onMessageCreated, refresh, role, threadId])

  const setPollClosed = useCallback(async (pollId: number, closed: boolean) => {
    if (!threadId) return
    await closeThreadPoll(role, threadId, pollId, fetcher, closed)
    await refresh()
    onChanged?.()
  }, [fetcher, onChanged, refresh, role, threadId])

  const setSignupClosed = useCallback(async (signupId: number, closed: boolean) => {
    if (!threadId) return
    await closeThreadSignupSheet(role, threadId, signupId, fetcher, closed)
    await refresh()
    onChanged?.()
  }, [fetcher, onChanged, refresh, role, threadId])

  return {
    panelMode,
    setPanelMode,
    polls,
    signups,
    openPoll,
    openSignup,
    activePoll,
    activeSignup,
    activePollId,
    activeSignupId,
    loading,
    error,
    refresh,
    createPoll,
    createSignup,
    setPollClosed,
    setSignupClosed,
  }
}
