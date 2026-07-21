import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Loader2, Mail, Plus } from 'lucide-react'
import { adminApiRequest } from '../utils/api'

interface WaiverTemplate {
  id: number
  name: string
  version: string
  body: string
  active_from: string
  active_to?: string | null
  requires_resign: boolean
  waiver_type?: string | null
  is_required?: boolean
}

const WAIVER_TYPE_OPTIONS = [
  { value: '', label: 'Other / custom' },
  { value: 'ASSUMPTION_OF_RISK', label: 'Assumption of Risk' },
  { value: 'RELEASE_OF_LIABILITY', label: 'Release of Liability' },
  { value: 'MEDICAL_EMERGENCY', label: 'Medical Emergencies' },
  { value: 'PAYMENT_POLICY', label: 'Payment Policies' },
  { value: 'MEDIA_RELEASE', label: 'Media Release' },
]

interface WaiverComplianceRow {
  id: number
  first_name: string
  last_name: string
  email?: string | null
  family_name?: string | null
  required_count: number
  accepted_count: number
  last_accepted_at?: string | null
}

export default function AdminWaivers() {
  const [templates, setTemplates] = useState<WaiverTemplate[]>([])
  const [compliance, setCompliance] = useState<WaiverComplianceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remindingId, setRemindingId] = useState<number | null>(null)
  const [remindingAll, setRemindingAll] = useState(false)
  const [reminderMsg, setReminderMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [form, setForm] = useState({
    name: 'Athlete Waiver',
    version: '1.0',
    body: '',
    requiresResign: false,
    waiverType: '',
    isRequired: true,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, complianceRes] = await Promise.all([
        adminApiRequest('/api/admin/waivers/templates'),
        adminApiRequest('/api/admin/waivers/compliance'),
      ])
      if (!res.ok) throw new Error(`Backend returned ${res.status}`)
      if (!complianceRes.ok) throw new Error(`Compliance returned ${complianceRes.status}`)
      const data = await res.json()
      const complianceData = await complianceRes.json()
      setTemplates(data.data ?? [])
      setCompliance(complianceData.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load waivers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createTemplate = async () => {
    if (!form.name.trim() || !form.version.trim() || !form.body.trim()) {
      setError('Name, version, and waiver body are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await adminApiRequest('/api/admin/waivers/templates', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          waiverType: form.waiverType || null,
          isRequired: form.isRequired,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || `Backend returned ${res.status}`)
      }
      setForm({ name: 'Athlete Waiver', version: '', body: '', requiresResign: false, waiverType: '', isRequired: true })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create waiver')
    } finally {
      setSaving(false)
    }
  }

  const sendReminder = async (row: WaiverComplianceRow) => {
    setRemindingId(row.id)
    setReminderMsg(null)
    try {
      const outstanding = Math.max(0, Number(row.required_count) - Number(row.accepted_count))
      const res = await adminApiRequest(`/api/admin/members/${row.id}/waivers/request`, {
        method: 'POST',
        body: JSON.stringify({ outstandingCount: outstanding }),
      })
      const data = await res.json().catch(() => ({}))
      setReminderMsg({
        ok: res.ok && data.success === true,
        text: data.message || (res.ok ? 'Reminder sent' : `Failed (${res.status})`),
      })
    } catch (err) {
      setReminderMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to send reminder' })
    } finally {
      setRemindingId(null)
    }
  }

  const sendAllReminders = async () => {
    setRemindingAll(true)
    setReminderMsg(null)
    try {
      const res = await adminApiRequest('/api/admin/waivers/request-all', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      setReminderMsg({
        ok: res.ok && data.success === true,
        text: data.message || (res.ok ? 'Reminders sent' : `Failed (${res.status})`),
      })
    } catch (err) {
      setReminderMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to send reminders' })
    } finally {
      setRemindingAll(false)
    }
  }

  const retireTemplate = async (templateId: number) => {
    setSaving(true)
    setError(null)
    try {
      const res = await adminApiRequest(`/api/admin/waivers/templates/${templateId}/retire`, { method: 'PATCH' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to retire waiver')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retire waiver')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Waivers</h2>
        <p className="text-sm text-gray-600">
          Manage versioned athlete waivers. Member acceptances are stored per athlete and preserve signature history.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-bold text-gray-900">Create Waiver Version</h3>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
            <input
              className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Waiver type</label>
            <select
              className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
              value={form.waiverType}
              onChange={(e) => setForm((prev) => ({ ...prev, waiverType: e.target.value }))}
            >
              {WAIVER_TYPE_OPTIONS.map((option) => (
                <option key={option.value || 'other'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Version</label>
            <input
              className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
              value={form.version}
              onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
              placeholder="1.1"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Waiver Text</label>
            <textarea
              className="w-full min-h-48 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.body}
              onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
              placeholder="Paste the athlete waiver terms here."
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isRequired}
              onChange={(e) => setForm((prev) => ({ ...prev, isRequired: e.target.checked }))}
            />
            Required for compliance
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.requiresResign}
              onChange={(e) => setForm((prev) => ({ ...prev, requiresResign: e.target.checked }))}
            />
            Require re-sign for this version
          </label>
          <button
            type="button"
            onClick={() => void createTemplate()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-vortex-red text-white rounded-lg disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Waiver
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold">Active and Historical Versions</div>
          {loading ? (
            <div className="p-4 flex items-center gap-2 text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading waivers...
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {templates.map((template) => {
                const isActive = !template.active_to
                return (
                  <details key={template.id} className="group">
                    <summary className="p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">
                              {template.name} v{template.version}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {isActive ? 'Active' : 'Historical'}
                            </span>
                            <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180 shrink-0" />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Active from {new Date(template.active_from).toLocaleDateString()}
                            {template.active_to
                              ? ` through ${new Date(template.active_to).toLocaleDateString()}`
                              : ' · present'}
                          </div>
                          {template.waiver_type && (
                            <span className="inline-block mt-1 rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs">
                              {template.waiver_type.replace(/_/g, ' ')}
                            </span>
                          )}
                          <p className="text-xs text-vortex-red font-medium mt-2 group-open:hidden">
                            Click to view full waiver text
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                          {template.is_required === false && (
                            <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs">Optional</span>
                          )}
                          {template.requires_resign && (
                            <span className="rounded-full bg-yellow-100 text-yellow-700 px-3 py-1 text-xs">
                              Re-sign required
                            </span>
                          )}
                          {isActive && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                void retireTemplate(template.id)
                              }}
                              disabled={saving}
                              className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-700 disabled:opacity-60"
                            >
                              Retire
                            </button>
                          )}
                        </div>
                      </div>
                    </summary>
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 whitespace-pre-wrap max-h-[min(70vh,32rem)] overflow-y-auto">
                        {template.body?.trim() ? template.body : 'No waiver text stored for this version.'}
                      </div>
                    </div>
                  </details>
                )
              })}
              {templates.length === 0 && <div className="p-4 text-sm text-gray-500">No waiver templates yet.</div>}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <span className="font-semibold">Compliance Report</span>
          <button
            type="button"
            onClick={() => void sendAllReminders()}
            disabled={remindingAll}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {remindingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            Email all non-compliant
          </button>
        </div>
        {reminderMsg && (
          <div className={`px-4 py-2 text-sm ${reminderMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {reminderMsg.text}
          </div>
        )}
        <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
          {compliance.map((row) => {
            const complete = Number(row.required_count) <= Number(row.accepted_count)
            return (
              <div key={row.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">{row.first_name} {row.last_name}</div>
                  <div className="text-xs text-gray-500">
                    {[row.email, row.family_name].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${complete ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {row.accepted_count}/{row.required_count} signed
                  </span>
                  {row.last_accepted_at && <span className="text-xs text-gray-500">Last: {new Date(row.last_accepted_at).toLocaleDateString()}</span>}
                  {!complete && (
                    <button
                      type="button"
                      onClick={() => void sendReminder(row)}
                      disabled={remindingId === row.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {remindingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                      Send reminder
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {compliance.length === 0 && <div className="p-4 text-sm text-gray-500">No active members found.</div>}
        </div>
      </div>
    </div>
  )
}
