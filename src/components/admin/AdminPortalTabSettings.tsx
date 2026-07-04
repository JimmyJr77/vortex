import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'
import {
  COACH_PORTAL_TAB_OPTIONS,
  MEMBER_PORTAL_TAB_OPTIONS,
  type PortalTabConfig,
} from '../../utils/portalTabConfig'

type PortalKind = 'member' | 'coach'

interface AdminPortalTabSettingsProps {
  portal: PortalKind
}

export default function AdminPortalTabSettings({ portal }: AdminPortalTabSettingsProps) {
  const options = portal === 'member' ? MEMBER_PORTAL_TAB_OPTIONS : COACH_PORTAL_TAB_OPTIONS
  const portalLabel = portal === 'member' ? 'Member Portal' : 'Coach Portal'

  const [hiddenTabs, setHiddenTabs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApiRequest('/api/admin/portal-settings')
      if (!res.ok) throw new Error(`Backend returned ${res.status}`)
      const json = await res.json()
      const config = json.data as PortalTabConfig
      setHiddenTabs(portal === 'member' ? config.member.hiddenTabs : config.coach.hiddenTabs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portal settings')
    } finally {
      setLoading(false)
    }
  }, [portal])

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

  const save = async () => {
    setSaving(true)
    setError(null)
    setSavedMessage(null)
    try {
      const res = await adminApiRequest('/api/admin/portal-settings', {
        method: 'PUT',
        body: JSON.stringify(
          portal === 'member' ? { member: { hiddenTabs } } : { coach: { hiddenTabs } },
        ),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.success !== true) {
        throw new Error(json.message || `Save failed (${res.status})`)
      }
      const config = json.data as PortalTabConfig
      setHiddenTabs(portal === 'member' ? config.member.hiddenTabs : config.coach.hiddenTabs)
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
        navigation and home shortcuts. Home always stays visible.
      </p>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
      {savedMessage && <div className="rounded-lg bg-green-50 text-green-700 px-4 py-2 text-sm">{savedMessage}</div>}

      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white">
        {options.map((option) => {
          const visible = !hiddenTabs.includes(option.key)
          return (
            <label
              key={option.key}
              className={`flex items-center justify-between gap-4 px-4 py-3 ${option.locked ? 'bg-gray-50' : ''}`}
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{option.label}</p>
                {option.locked ? (
                  <p className="text-xs text-gray-500">Always visible</p>
                ) : (
                  <p className="text-xs text-gray-500">Sidebar section</p>
                )}
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
