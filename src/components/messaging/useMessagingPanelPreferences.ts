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
  const pendingSave = useRef(false)
  const path = `/api/${role}/messages/panel-preferences`

  useEffect(() => {
    const version = ++generation.current
    pendingSave.current = false
    let request = 0
    const load = async () => {
      if (!accountKey || !fetcher || !role || pendingSave.current) return
      const currentRequest = ++request
      setState((previous) => ({ accountKey, preferences: previous.accountKey === accountKey ? previous.preferences : defaults, busy: true, error: '' }))
      try {
        const preferences = parsePreferences(await fetcher(path, { cache: 'no-store' }))
        if (version === generation.current && currentRequest === request) setState({ accountKey, preferences, busy: false, error: '' })
      } catch {
        if (version === generation.current && currentRequest === request) setState((previous) => ({ ...previous, busy: false, error: 'Couldn’t load panel preferences.' }))
      }
    }
    void load()
    window.addEventListener('focus', load)
    return () => {
      generation.current = version + 1
      window.removeEventListener('focus', load)
    }
  }, [accountKey, role, fetcher, path, reload])

  const current = state.accountKey === accountKey ? state : { accountKey, preferences: defaults, busy: true, error: '' }
  const togglePanel = async (panel: keyof PanelPreferences) => {
    if (!accountKey || !fetcher || !role || current.busy || pendingSave.current) return
    const version = generation.current
    const previous = current.preferences
    const value = !previous[panel]
    pendingSave.current = true
    setState({ accountKey, preferences: { ...previous, [panel]: value }, busy: true, error: '' })
    try {
      const preferences = parsePreferences(await fetcher(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [panel]: value }),
      }))
      if (version === generation.current) setState({ accountKey, preferences, busy: false, error: '' })
    } catch {
      if (version === generation.current) setState({ accountKey, preferences: previous, busy: false, error: 'Couldn’t save panel preferences. Your change was undone; try again.' })
    } finally {
      if (version === generation.current) pendingSave.current = false
    }
  }

  return { ...current.preferences, busy: current.busy, error: current.error, retry: () => setReload((value) => value + 1), togglePanel }
}
