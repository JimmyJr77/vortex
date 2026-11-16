import { useMessageRealtime } from '../../hooks/useMessageRealtime'
import { useEffect, useRef, useState } from 'react'
import type { MessagingRole } from './types'

type PanelPreferences = { filesVisible: boolean; eventsVisible: boolean }
export type PanelPreferenceFetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>
const defaults: PanelPreferences = { filesVisible: true, eventsVisible: true }

function parsePreferences(value: unknown): PanelPreferences {
  const data = value as Partial<PanelPreferences> | null
  if (typeof data?.filesVisible !== 'boolean' || typeof data?.eventsVisible !== 'boolean') {
    throw new Error('Invalid panel preferences response')
  }
  return { filesVisible: data.filesVisible, eventsVisible: data.eventsVisible }
}

/** Server-authoritative account settings; no browser-local preferences override them. */
export function useMessagingPanelPreferences(accountKey?: string, role?: MessagingRole, fetcher?: PanelPreferenceFetcher) {
  const [state, setState] = useState({ accountKey, preferences: defaults, busy: true, error: '' })
  const [reload, setReload] = useState(0)
  const generation = useRef(0)
  const saveError = useRef('')
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
      setState((previous) => ({ accountKey, preferences: previous.accountKey === accountKey ? previous.preferences : defaults, busy: true, error: saveError.current }))
      try {
        const preferences = parsePreferences(await fetcher(path, { cache: 'no-store' }))
        if (version === generation.current) setState({ accountKey, preferences, busy: false, error: saveError.current })
      } catch {
        if (version === generation.current) setState((previous) => ({ ...previous, busy: false, error: 'Couldn’t load panel preferences.' }))
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
  const togglePanel = async (panel: keyof PanelPreferences) => {
    if (!accountKey || !fetcher || !role || current.busy || pendingSave.current) return
    const version = generation.current
    const previous = current.preferences
    const value = !previous[panel]
    pendingSave.current = true
    saveError.current = ''
    setState({ accountKey, preferences: { ...previous, [panel]: value }, busy: true, error: '' })
    try {
      const preferences = parsePreferences(await fetcher(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [panel]: value }),
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

  return { ...current.preferences, busy: current.busy, error: current.error, retry: () => setReload((value) => value + 1), togglePanel }
}
