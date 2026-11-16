import { useMessageRealtime } from '../../hooks/useMessageRealtime'
import { useEffect, useRef, useState } from 'react'
import type { MessagingRole } from './types'

type PanelPreferences = { filesVisible: boolean; eventsVisible: boolean; listWidth: number; sidebarWidth: number }
export type PanelPreferenceFetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>
const defaults: PanelPreferences = { filesVisible: true, eventsVisible: true, listWidth: 320, sidebarWidth: 304 }

function parsePreferences(value: unknown): PanelPreferences {
  const data = value as Partial<PanelPreferences> | null
  if (typeof data?.filesVisible !== 'boolean' || typeof data?.eventsVisible !== 'boolean') {
    throw new Error('Invalid panel preferences response')
  }
  return { filesVisible: data.filesVisible, eventsVisible: data.eventsVisible,
    listWidth: Number.isInteger(data.listWidth) && data.listWidth! >= 240 && data.listWidth! <= 480 ? data.listWidth! : 320,
    sidebarWidth: Number.isInteger(data.sidebarWidth) && data.sidebarWidth! >= 240 && data.sidebarWidth! <= 480 ? data.sidebarWidth! : 304,
  }
}

/** Server-authoritative account settings; no browser-local preferences override them. */
export function useMessagingPanelPreferences(accountKey?: string, role?: MessagingRole, fetcher?: PanelPreferenceFetcher) {
  const [state, setState] = useState({ accountKey, preferences: defaults, busy: true, error: '' })
  const [reload, setReload] = useState(0)
  const generation = useRef(0)
  const saveError = useRef('')
  const mutationVersion = useRef(0)
  const pendingSave = useRef(false)
  const refreshRef = useRef<(() => void) | null>(null)
  const path = `/api/${role}/messages/panel-preferences`

  useEffect(() => {
    const version = ++generation.current
    pendingSave.current = false
    saveError.current = ''
    let inFlight = false
    let dirty = false
    const load = async () => {
      dirty = true
      if (!accountKey || !fetcher || !role || pendingSave.current || inFlight || version !== generation.current) return
      dirty = false
      inFlight = true
      const beforeMutation = mutationVersion.current
      setState((previous) => ({ accountKey, preferences: previous.accountKey === accountKey ? previous.preferences : defaults, busy: true, error: saveError.current }))
      try {
        const preferences = parsePreferences(await fetcher(path, { cache: 'no-store' }))
        if (beforeMutation === mutationVersion.current && !pendingSave.current && version === generation.current) setState({ accountKey, preferences, busy: false, error: saveError.current })
      } catch {
        if (beforeMutation === mutationVersion.current && !pendingSave.current && version === generation.current) setState((previous) => ({ ...previous, busy: false, error: 'Couldn’t load panel preferences.' }))
      } finally {
        inFlight = false
        if (dirty && version === generation.current) void load()
      }
    }
    refreshRef.current = () => { void load() }
    void load()
    window.addEventListener('focus', load)
    return () => {
      refreshRef.current = null
      generation.current = version + 1
      window.removeEventListener('focus', load)
    }
  }, [accountKey, role, fetcher, path, reload])

  useMessageRealtime({
    role: role ?? 'member',
    connectionKey: accountKey,
    enabled: Boolean(accountKey && role && fetcher),
    onPanelPreferencesInvalidated: () => refreshRef.current?.(),
  })

  const current = state.accountKey === accountKey ? state : { accountKey, preferences: defaults, busy: true, error: '' }
  const savePreferences = async (patch: Partial<PanelPreferences>) => {
    if (!accountKey || !fetcher || !role || pendingSave.current) return
    const version = generation.current
    const previous = current.preferences
    pendingSave.current = true
    mutationVersion.current += 1
    saveError.current = ''
    setState({ accountKey, preferences: { ...previous, ...patch }, busy: true, error: '' })
    try {
      const preferences = parsePreferences(await fetcher(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }))
      if (version === generation.current) setState({ accountKey, preferences, busy: false, error: saveError.current })
    } catch {
      if (version === generation.current) {
        saveError.current = 'Couldn’t save panel preferences. Your change was undone; try again.'
        setState({ accountKey, preferences: previous, busy: false, error: saveError.current })
      }
    } finally {
      if (version === generation.current) {
        pendingSave.current = false
        refreshRef.current?.()
      }
    }
  }

  const togglePanel = (panel: 'filesVisible' | 'eventsVisible') => savePreferences({ [panel]: !current.preferences[panel] })
  const setPanelWidth = (panel: 'listWidth' | 'sidebarWidth', width: number) => savePreferences({ [panel]: Math.min(480, Math.max(240, Math.round(width))) })

  return { ...current.preferences, busy: current.busy, error: current.error, retry: () => setReload((value) => value + 1), togglePanel, setPanelWidth }
}
