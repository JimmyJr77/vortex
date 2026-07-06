import { useCallback, useEffect, useMemo, useState } from 'react'
import { GripVertical, Loader2, Minus, Plus, Save } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'
import {
  COACH_PORTAL_TAB_OPTIONS,
  MEMBER_PORTAL_TAB_OPTIONS,
  createPortalSectionBreak,
  normalizeNavLayout,
  tabOrderFromNavLayout,
  type PortalNavLayoutItem,
  type PortalTabConfig,
} from '../../utils/portalTabConfig'

type PortalKind = 'member' | 'coach'
type PortalOption = { key: string; label: string; locked?: boolean }

interface AdminPortalTabSettingsProps {
  portal: PortalKind
}

function layoutItemKey(item: PortalNavLayoutItem, index: number): string {
  return item.type === 'section' ? item.id : `${item.key}-${index}`
}

export default function AdminPortalTabSettings({ portal }: AdminPortalTabSettingsProps) {
  const options: PortalOption[] = portal === 'member' ? MEMBER_PORTAL_TAB_OPTIONS : COACH_PORTAL_TAB_OPTIONS
  const portalLabel = portal === 'member' ? 'Member Portal' : 'Coach Portal'
  const validKeys = useMemo(() => options.map((option) => option.key), [options])
  const optionByKey = useMemo(() => new Map(options.map((option) => [option.key, option])), [options])

  const [hiddenTabs, setHiddenTabs] = useState<string[]>([])
  const [navLayout, setNavLayout] = useState<PortalNavLayoutItem[]>(() =>
    validKeys.map((key) => ({ type: 'tab', key })),
  )
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const mergeNavLayout = useCallback(
    (nextLayout?: PortalNavLayoutItem[]) =>
      normalizeNavLayout(nextLayout, validKeys, validKeys),
    [validKeys],
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
      setNavLayout(mergeNavLayout(portalConfig.navLayout ?? portalConfig.tabOrder.map((key) => ({ type: 'tab', key }))))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portal settings')
    } finally {
      setLoading(false)
    }
  }, [mergeNavLayout, portal])

  useEffect(() => {
    void load()
  }, [load])

  const moveLayoutItem = (dragKey: string, targetKey: string) => {
    if (dragKey === targetKey) return
    setNavLayout((prev) => {
      const merged = mergeNavLayout(prev)
      const from = merged.findIndex((item, index) => layoutItemKey(item, index) === dragKey)
      const to = merged.findIndex((item, index) => layoutItemKey(item, index) === targetKey)
      if (from === -1 || to === -1) return merged
      const next = [...merged]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setSavedMessage(null)
  }

  const toggleVisible = (tabKey: string, visible: boolean) => {
    setHiddenTabs((prev) => {
      if (visible) return prev.filter((tab) => tab !== tabKey)
      return prev.includes(tabKey) ? prev : [...prev, tabKey]
    })
    setSavedMessage(null)
  }

  const insertSectionBreak = (afterIndex: number) => {
    setNavLayout((prev) => {
      const next = [...mergeNavLayout(prev)]
      next.splice(afterIndex + 1, 0, createPortalSectionBreak('New section'))
      return next
    })
    setSavedMessage(null)
  }

  const removeSectionBreak = (sectionId: string) => {
    setNavLayout((prev) => mergeNavLayout(prev.filter((item) => !(item.type === 'section' && item.id === sectionId))))
    setSavedMessage(null)
  }

  const updateSectionLabel = (sectionId: string, label: string) => {
    setNavLayout((prev) =>
      prev.map((item) =>
        item.type === 'section' && item.id === sectionId ? { ...item, label: label.slice(0, 60) } : item,
      ),
    )
    setSavedMessage(null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setSavedMessage(null)
    try {
      const normalizedLayout = mergeNavLayout(navLayout)
      const tabOrder = tabOrderFromNavLayout(normalizedLayout)
      const payload =
        portal === 'member'
          ? { member: { hiddenTabs, tabOrder, navLayout: normalizedLayout } }
          : { coach: { hiddenTabs, tabOrder, navLayout: normalizedLayout } }

      const res = await adminApiRequest('/api/admin/portal-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.success !== true) {
        throw new Error(json.message || `Save failed (${res.status})`)
      }
      const config = json.data as PortalTabConfig
      const portalConfig = portal === 'member' ? config.member : config.coach
      setHiddenTabs(portalConfig.hiddenTabs)
      setNavLayout(mergeNavLayout(portalConfig.navLayout))
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

  const layout = mergeNavLayout(navLayout)

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-gray-600">
        Choose which sidebar sections appear in the {portalLabel.toLowerCase()}. Hidden sections are removed from
        navigation and home shortcuts. Drag rows to change menu order. Add section breaks to group items (for example,
        Session Design or Athlete Development). Home always stays visible.
      </p>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
      {savedMessage && <div className="rounded-lg bg-green-50 text-green-700 px-4 py-2 text-sm">{savedMessage}</div>}

      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white">
        {layout.map((item, index) => {
          const rowKey = layoutItemKey(item, index)

          if (item.type === 'section') {
            return (
              <div
                key={rowKey}
                draggable
                onDragStart={() => setDraggingKey(rowKey)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  if (draggingKey) moveLayoutItem(draggingKey, rowKey)
                  setDraggingKey(null)
                }}
                onDragEnd={() => setDraggingKey(null)}
                className={`flex items-center gap-3 px-4 py-3 bg-gray-50 ${draggingKey === rowKey ? 'opacity-60' : ''}`}
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-gray-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Section break</p>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(event) => updateSectionLabel(item.id, event.target.value)}
                    placeholder="Section title"
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-vortex-red focus:outline-none focus:ring-1 focus:ring-vortex-red"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeSectionBreak(item.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white"
                  title="Remove section break"
                >
                  <Minus className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            )
          }

          const option = optionByKey.get(item.key)
          if (!option) return null
          const visible = !hiddenTabs.includes(option.key)

          return (
            <div key={rowKey}>
              <label
                draggable
                onDragStart={() => setDraggingKey(rowKey)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  if (draggingKey) moveLayoutItem(draggingKey, rowKey)
                  setDraggingKey(null)
                }}
                onDragEnd={() => setDraggingKey(null)}
                className={`flex items-center justify-between gap-4 px-4 py-3 ${
                  option.locked ? 'bg-gray-50/70' : ''
                } ${draggingKey === rowKey ? 'opacity-60' : ''}`}
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
              <div className="px-4 pb-2">
                <button
                  type="button"
                  onClick={() => insertSectionBreak(index)}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:border-vortex-red hover:text-vortex-red"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add section break below
                </button>
              </div>
            </div>
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
