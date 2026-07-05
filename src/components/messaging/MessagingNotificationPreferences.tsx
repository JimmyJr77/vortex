import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { MessagingRole } from './types'

type Fetcher = (endpoint: string, options?: RequestInit) => Promise<unknown>

interface NotificationPrefs {
  allow_critical_email: boolean
  allow_critical_sms: boolean
  phone_e164?: string | null
}

interface MessagingNotificationPreferencesProps {
  role: MessagingRole
  fetcher: Fetcher
  className?: string
}

const PREFS_PATH: Record<MessagingRole, string> = {
  coach: '/api/coach/messages/notification-preferences',
  member: '/api/member/messages/notification-preferences',
  admin: '/api/admin/messages/notification-preferences',
}

export default function MessagingNotificationPreferences({
  role,
  fetcher,
  className = '',
}: MessagingNotificationPreferencesProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    allow_critical_email: false,
    allow_critical_sms: false,
    phone_e164: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetcher(PREFS_PATH[role]) as NotificationPrefs
      setPrefs({
        allow_critical_email: Boolean(data.allow_critical_email),
        allow_critical_sms: Boolean(data.allow_critical_sms),
        phone_e164: data.phone_e164 ?? '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences')
    } finally {
      setLoading(false)
    }
  }, [fetcher, role])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const data = await fetcher(PREFS_PATH[role], {
        method: 'PATCH',
        body: JSON.stringify({
          allow_critical_email: prefs.allow_critical_email,
          allow_critical_sms: prefs.allow_critical_sms,
          phone_e164: prefs.phone_e164?.trim() || null,
        }),
      }) as NotificationPrefs
      setPrefs({
        allow_critical_email: Boolean(data.allow_critical_email),
        allow_critical_sms: Boolean(data.allow_critical_sms),
        phone_e164: data.phone_e164 ?? '',
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-xs text-gray-500 ${className}`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading alert settings…
      </div>
    )
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2 ${className}`}>
      <div className="text-xs font-semibold text-gray-800">Critical alerts (opt-in)</div>
      <p className="text-[11px] text-gray-600 leading-snug">
        Email and SMS are sent only for urgent critical messages — never digests or routine chat.
      </p>
      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={prefs.allow_critical_email}
          onChange={(e) => setPrefs((p) => ({ ...p, allow_critical_email: e.target.checked }))}
          className="rounded border-gray-300 text-vortex-red focus:ring-vortex-red"
        />
        Email for critical messages
      </label>
      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={prefs.allow_critical_sms}
          onChange={(e) => setPrefs((p) => ({ ...p, allow_critical_sms: e.target.checked }))}
          className="rounded border-gray-300 text-vortex-red focus:ring-vortex-red"
        />
        SMS for critical messages
      </label>
      {prefs.allow_critical_sms && (
        <input
          type="tel"
          value={prefs.phone_e164 ?? ''}
          onChange={(e) => setPrefs((p) => ({ ...p, phone_e164: e.target.value }))}
          placeholder="+15551234567"
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs"
        />
      )}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="text-xs font-semibold bg-vortex-red text-white px-3 py-1.5 rounded-md disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-[11px] text-green-700">Saved</span>}
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </div>
    </div>
  )
}
