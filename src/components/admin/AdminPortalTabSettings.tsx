import { useCallback, useEffect, useMemo, useState } from 'react'
import { GripVertical, Loader2, Save } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'
import {
  COACH_PORTAL_TAB_OPTIONS,
  MEMBER_PORTAL_TAB_OPTIONS,
  type PortalTabConfig,
} from '../../utils/portalTabConfig'

type PortalKind = 'member' | 'coach'
type PortalOption = { key: string; label: string; locked?: boolean }

interface AdminPortalTabSettingsProps {
  portal: PortalKind
}

export default function AdminPortalTabSettings({ portal }: AdminPortalTabSettingsProps) {
  const options: PortalOption[] = portal === 'member' ? MEMBER_PORTAL_TAB_OPTIONS : COACH_PORTAL_TAB_OPTIONS
  const portalLabel = portal === 'member' ? 'Member Portal' : 'Coach Portal'

  const [hiddenTabs, setHiddenTabs] = useState<string[]>([])
  const [tabOrder, setTabOrder] = useState<string[]>(options.map((option) => option.key))
  const [draggingTab, setDraggingTab] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const mergeTabOrder = useCallback(
    (nextOrder?: string[]) => {
      const validKeys = options.map((option) => option.key) as string[]
      const selected = [...new Set(nextOrder ?? [])].filter((tab) => validKeys.includes(tab))
      return [...selected, ...validKeys.filter((tab) => !selected.includes(tab))]
    },
    [options],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApiRequest('/api/admin/portal-settings')
      if (!res.ok) throw new Error(`Backend returned ${res.status}`)
      const json = await res.json()
      const config = json.data as PortalTabConfig
      const portalConfig = portal === 'member' ? config.member : config.coach
      setHiddenTabs(portalConfig.hiddenTabs)
      setTabOrder(mergeTabOrder(portalConfig.tabOrder))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portal settings')
    } finally {
      setLoading(false)
    }
  }, [mergeTabOrder, portal])

  const orderedOptions = useMemo(() => {
    const rank = new Map(tabOrder.map((tab, index) => [tab, index]))
    return [...options].sort((a, b) => {
      const aRank = rank.get(a.key) ?? Number.MAX_SAFE_INTEGER
      const bRank = rank.get(b.key) ?? Number.MAX_SAFE_INTEGER
      if (aRank !== bRank) return aRank - bRank
      return options.indexOf(a) - options.indexOf(b)
    })
  }, [options, tabOrder])

  useEffect(() => {
    void load()
  }, [load])

  const toggleVisible = (tabKey: string, visible: boolean) => {
    setHiddenTabs((prev) => {
      if (visible) return prev.filter((tab) => tab !== tabKey)
      return prev.includes(tabKey) ? prev : [...prev, tabKey]
    })
    setSavedMessage(null)
  }

  const moveTab = (dragTab: string, targetTab: string) => {
    if (dragTab === targetTab) return
    setTabOrder((prev) => {
      const merged = mergeTabOrder(prev)
      const from = merged.indexOf(dragTab)
      const to = merged.indexOf(targetTab)
      if (from === -1 || to === -1) return merged
      const next = [...merged]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setSavedMessage(null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setSavedMessage(null)
    try {
      const res = await adminApiRequest('/api/admin/portal-settings', {
        method: 'PUT',
        body: JSON.stringify(
          portal === 'member' ? { member: { hiddenTabs, tabOrder } } : { coach: { hiddenTabs, tabOrder } },
        ),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.success !== true) {
        throw new Error(json.message || `Save failed (${res.status})`)
      }
      const config = json.data as PortalTabConfig
      const portalConfig = portal === 'member' ? config.member : config.coach
      setHiddenTabs(portalConfig.hiddenTabs)
      setTabOrder(mergeTabOrder(portalConfig.tabOrder))
      setSavedMessage('Saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save portal settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-600 py-8">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading {portalLabel.toLowerCase()} settings…
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-gray-600">
        Choose which sidebar sections appear in the {portalLabel.toLowerCase()}. Hidden sections are removed from
        navigation and home shortcuts. Drag rows to change the menu order. Home always stays visible.
      </p>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
      {savedMessage && <div className="rounded-lg bg-green-50 text-green-700 px-4 py-2 text-sm">{savedMessage}</div>}

      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white">
        {orderedOptions.map((option) => {
          const visible = !hiddenTabs.includes(option.key)
          return (
            <label
              key={option.key}
              draggable
              onDragStart={() => setDraggingTab(option.key)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                if (draggingTab) moveTab(draggingTab, option.key)
                setDraggingTab(null)
              }}
              onDragEnd={() => setDraggingTab(null)}
              className={`flex items-center justify-between gap-4 px-4 py-3 ${
                option.locked ? 'bg-gray-50' : ''
              } ${draggingTab === option.key ? 'opacity-60' : ''}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-gray-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{option.label}</p>
                  {option.locked ? (
                    <p className="text-xs text-gray-500">Always visible</p>
                  ) : (
                    <p className="text-xs text-gray-500">Sidebar section</p>
                  )}
                </div>
              </div>
              <input
                type="checkbox"
                checked={visible}
                disabled={option.locked}
                onChange={(e) => toggleVisible(option.key, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-vortex-red focus:ring-vortex-red disabled:opacity-60"
              />
            </label>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save {portalLabel} settings
      </button>
    </div>
  )
}
