import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  closeThreadPoll,
  closeThreadSignupSheet,
  createThreadPoll,
  createThreadSignupSheet,
  fetchThreadPolls,
  fetchThreadSignupSheets,
  ignoreThreadPoll,
  ignoreThreadSignupSheet,
} from './messagingApi'
import type { MessageChecklist, MessagePoll, MessagingRole, SignupSheetType } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

export type ThreadCollaborationPanelMode =
  | null
  | 'list-poll'
  | 'create-poll'
  | 'pick-poll'
  | 'view-poll'
  | 'list-signup'
  | 'create-signup'
  | 'pick-signup'
  | 'view-signup'

interface CreateSignupPayload {
  title: string
  sheet_type: SignupSheetType
  event_date: string
  items?: { text: string }[]
  config?: Record<string, unknown>
  closes_at?: string | null
}

interface OpenPollPanelOptions {
  mode?: Exclude<ThreadCollaborationPanelMode, null | 'list-signup' | 'create-signup' | 'pick-signup' | 'view-signup'>
  scrollToLatest?: boolean
}

interface OpenSignupPanelOptions {
  mode?: Exclude<ThreadCollaborationPanelMode, null | 'list-poll' | 'create-poll' | 'pick-poll' | 'view-poll'>
  scrollToLatest?: boolean
}

interface UseThreadCollaborationOptions {
  role: MessagingRole
  threadId: number | null
  fetcher: Fetcher
  onChanged?: () => void
}

export function useThreadCollaboration({
  role,
  threadId,
  fetcher,
  onChanged,
}: UseThreadCollaborationOptions) {
  const [pollPanelOpen, setPollPanelOpen] = useState(false)
  const [signupPanelOpen, setSignupPanelOpen] = useState(false)
  const [panelMode, setPanelMode] = useState<ThreadCollaborationPanelMode>(null)
  const [polls, setPolls] = useState<MessagePoll[]>([])
  const [signups, setSignups] = useState<MessageChecklist[]>([])
  const [activePollId, setActivePollId] = useState<number | null>(null)
  const [activeSignupId, setActiveSignupId] = useState<number | null>(null)
  const [scrollPollToLatest, setScrollPollToLatest] = useState(false)
  const [scrollSignupToLatest, setScrollSignupToLatest] = useState(false)
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
    setPollPanelOpen(false)
    setSignupPanelOpen(false)
    setPanelMode(null)
    setActivePollId(null)
    setActiveSignupId(null)
    setScrollPollToLatest(false)
    setScrollSignupToLatest(false)
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

  const hasActionablePoll = useMemo(
    () => polls.some((poll) => poll.actionable),
    [polls],
  )
  const hasActionableSignup = useMemo(
    () => signups.some((signup) => signup.actionable),
    [signups],
  )

  const closePollPanel = useCallback(() => {
    setPollPanelOpen(false)
    setPanelMode((mode) => (
      mode === 'list-poll' || mode === 'create-poll' || mode === 'pick-poll' || mode === 'view-poll'
        ? null
        : mode
    ))
    setScrollPollToLatest(false)
  }, [])

  const closeSignupPanel = useCallback(() => {
    setSignupPanelOpen(false)
    setPanelMode((mode) => (
      mode === 'list-signup' || mode === 'create-signup' || mode === 'pick-signup' || mode === 'view-signup'
        ? null
        : mode
    ))
    setScrollSignupToLatest(false)
  }, [])

  const openPollPanel = useCallback((opts: OpenPollPanelOptions = {}) => {
    setSignupPanelOpen(false)
    setPollPanelOpen(true)
    setPanelMode(opts.mode ?? 'list-poll')
    setScrollPollToLatest(Boolean(opts.scrollToLatest))
  }, [])

  const openSignupPanel = useCallback((opts: OpenSignupPanelOptions = {}) => {
    setPollPanelOpen(false)
    setSignupPanelOpen(true)
    setPanelMode(opts.mode ?? 'list-signup')
    setScrollSignupToLatest(Boolean(opts.scrollToLatest))
  }, [])

  const openPoll = useCallback((poll: MessagePoll) => {
    setActivePollId(poll.id != null ? Number(poll.id) : null)
    setPollPanelOpen(true)
    setSignupPanelOpen(false)
    setPanelMode('view-poll')
    setScrollPollToLatest(false)
  }, [])

  const openSignup = useCallback((signup: MessageChecklist) => {
    setActiveSignupId(signup.id != null ? Number(signup.id) : null)
    setSignupPanelOpen(true)
    setPollPanelOpen(false)
    setPanelMode('view-signup')
    setScrollSignupToLatest(false)
  }, [])

  const createPoll = useCallback(async (payload: { question: string; options: string[]; closes_at?: string | null }) => {
    if (!threadId) return null
    const result = await createThreadPoll(role, threadId, fetcher, payload)
    await refresh()
    if (result.poll?.id != null) {
      setActivePollId(Number(result.poll.id))
      setPollPanelOpen(true)
      setSignupPanelOpen(false)
      setPanelMode('view-poll')
    }
    onChanged?.()
    return result
  }, [fetcher, onChanged, refresh, role, threadId])

  const createSignup = useCallback(async (payload: CreateSignupPayload) => {
    if (!threadId) return null
    const result = await createThreadSignupSheet(role, threadId, fetcher, payload)
    await refresh()
    if (result.signup?.id != null) {
      setActiveSignupId(Number(result.signup.id))
      setSignupPanelOpen(true)
      setPollPanelOpen(false)
      setPanelMode('view-signup')
    }
    onChanged?.()
    return result
  }, [fetcher, onChanged, refresh, role, threadId])

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

  const ignorePoll = useCallback(async (pollId: number) => {
    if (!threadId) return
    await ignoreThreadPoll(role, threadId, pollId, fetcher)
    await refresh()
    onChanged?.()
  }, [fetcher, onChanged, refresh, role, threadId])

  const ignoreSignup = useCallback(async (signupId: number) => {
    if (!threadId) return
    await ignoreThreadSignupSheet(role, threadId, signupId, fetcher)
    await refresh()
    onChanged?.()
  }, [fetcher, onChanged, refresh, role, threadId])

  const clearScrollPollToLatest = useCallback(() => setScrollPollToLatest(false), [])
  const clearScrollSignupToLatest = useCallback(() => setScrollSignupToLatest(false), [])

  return {
    pollPanelOpen,
    signupPanelOpen,
    panelMode,
    setPanelMode,
    polls,
    signups,
    openPoll,
    openSignup,
    openPollPanel,
    openSignupPanel,
    closePollPanel,
    closeSignupPanel,
    activePoll,
    activeSignup,
    activePollId,
    activeSignupId,
    hasActionablePoll,
    hasActionableSignup,
    scrollPollToLatest,
    scrollSignupToLatest,
    clearScrollPollToLatest,
    clearScrollSignupToLatest,
    loading,
    error,
    refresh,
    createPoll,
    createSignup,
    setPollClosed,
    setSignupClosed,
    ignorePoll,
    ignoreSignup,
  }
}
