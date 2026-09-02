import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Globe2,
  Loader2,
  PackageCheck,
  Plus,
  Search,
  Settings2,
  UserRound,
  X,
} from 'lucide-react'
import { adminApiRequest } from '../../utils/api'

type ChannelStatus = 'not_started' | 'planned' | 'in_progress' | 'active' | 'needs_attention' | 'paused'
type ChannelPriority = 'critical' | 'high' | 'medium' | 'low'

interface MarketingChannel {
  id: number
  key: string
  name: string
  category: string
  description: string | null
  websiteUrl: string | null
  accountUrl: string | null
  username: string | null
  ownerName: string | null
  status: ChannelStatus
  priority: ChannelPriority
  settings: Record<string, unknown>
  inputs: Record<string, unknown>
  secretRefs: string[]
  notes: string | null
  lastVerifiedAt: string | null
  nextReviewAt: string | null
  updatedAt: string
  readiness: { ready: boolean; blockers: string[]; completedInputs: number; totalInputs: number }
}

interface Revision {
  id: number
  version: number
  status: string
  channel_count: number
  notes: string | null
  created_at: string
}

const STATUS_LABELS: Record<ChannelStatus, string> = {
  not_started: 'Not started',
  planned: 'Planned',
  in_progress: 'In progress',
  active: 'Active',
  needs_attention: 'Needs attention',
  paused: 'Paused',
}

const STATUS_STYLES: Record<ChannelStatus, string> = {
  not_started: 'bg-gray-100 text-gray-700',
  planned: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-800',
  active: 'bg-emerald-50 text-emerald-700',
  needs_attention: 'bg-red-50 text-red-700',
  paused: 'bg-purple-50 text-purple-700',
}

const PRIORITY_STYLES: Record<ChannelPriority, string> = {
  critical: 'border-red-200 text-red-700',
  high: 'border-orange-200 text-orange-700',
  medium: 'border-blue-200 text-blue-700',
  low: 'border-gray-200 text-gray-600',
}

const prettyKey = (key: string) =>
  key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const countCompletedInputs = (inputs: Record<string, unknown>) =>
  Object.values(inputs).filter((value) =>
    Array.isArray(value) ? value.length > 0 : value !== '' && value !== null && value !== undefined,
  ).length

const request = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await adminApiRequest(url, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success === false) throw new Error(body.message || 'Request failed')
  return body.data as T
}

function ChannelEditor({
  channel,
  canManage,
  onClose,
  onSaved,
}: {
  channel: MarketingChannel
  canManage: boolean
  onClose: () => void
  onSaved: (channel: MarketingChannel) => void
}) {
  const [draft, setDraft] = useState(channel)
  const [inputsJson, setInputsJson] = useState(JSON.stringify(channel.inputs, null, 2))
  const [settingsJson, setSettingsJson] = useState(JSON.stringify(channel.settings, null, 2))
  const [secretRefs, setSecretRefs] = useState(channel.secretRefs.join('\n'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const inputs = JSON.parse(inputsJson)
      const settings = JSON.parse(settingsJson)
      if (!inputs || Array.isArray(inputs) || typeof inputs !== 'object') throw new Error('Inputs must be a JSON object.')
      if (!settings || Array.isArray(settings) || typeof settings !== 'object') throw new Error('Settings must be a JSON object.')
      const saved = await request<MarketingChannel>(`/api/admin/marketing/channels/${channel.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: draft.name,
          category: draft.category,
          description: draft.description,
          websiteUrl: draft.websiteUrl,
          accountUrl: draft.accountUrl,
          username: draft.username,
          ownerName: draft.ownerName,
          status: draft.status,
          priority: draft.priority,
          inputs,
          settings,
          secretRefs: secretRefs.split('\n').map((item) => item.trim()).filter(Boolean),
          notes: draft.notes,
          lastVerifiedAt: draft.lastVerifiedAt,
          nextReviewAt: draft.nextReviewAt || null,
        }),
      })
      onSaved(saved)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-vortex-red focus:outline-none focus:ring-1 focus:ring-vortex-red'

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-gray-50 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-vortex-red">Channel settings</p>
            <h3 className="mt-1 text-xl font-bold text-gray-900">{channel.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h4 className="font-bold text-gray-900">Account & ownership</h4>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">Username / handle
                <input className={`${inputClass} mt-1`} value={draft.username || ''} onChange={(event) => setDraft({ ...draft, username: event.target.value })} placeholder="@vortex or account email" />
              </label>
              <label className="text-sm font-medium text-gray-700">Internal owner
                <input className={`${inputClass} mt-1`} value={draft.ownerName || ''} onChange={(event) => setDraft({ ...draft, ownerName: event.target.value })} placeholder="Person responsible" />
              </label>
              <label className="text-sm font-medium text-gray-700">Account/profile URL
                <input className={`${inputClass} mt-1`} value={draft.accountUrl || ''} onChange={(event) => setDraft({ ...draft, accountUrl: event.target.value })} placeholder="https://…" />
              </label>
              <label className="text-sm font-medium text-gray-700">Service URL
                <input className={`${inputClass} mt-1`} value={draft.websiteUrl || ''} onChange={(event) => setDraft({ ...draft, websiteUrl: event.target.value })} placeholder="https://…" />
              </label>
              <label className="text-sm font-medium text-gray-700">Status
                <select className={`${inputClass} mt-1`} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ChannelStatus })}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">Priority
                <select className={`${inputClass} mt-1`} value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as ChannelPriority })}>
                  {(['critical', 'high', 'medium', 'low'] as const).map((value) => <option key={value} value={value}>{prettyKey(value)}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">Next review
                <input type="date" className={`${inputClass} mt-1`} value={draft.nextReviewAt?.slice(0, 10) || ''} onChange={(event) => setDraft({ ...draft, nextReviewAt: event.target.value })} />
              </label>
              <label className="text-sm font-medium text-gray-700">Category
                <input className={`${inputClass} mt-1`} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h4 className="font-bold text-gray-900">Inputs sent to this service</h4>
            <p className="mt-1 text-xs text-gray-500">The complete source of truth. Arrays, IDs, URLs, business details, templates, and tracking values are supported.</p>
            <textarea className={`${inputClass} mt-4 min-h-64 font-mono`} value={inputsJson} onChange={(event) => setInputsJson(event.target.value)} spellCheck={false} />
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h4 className="font-bold text-gray-900">Service settings</h4>
            <textarea className={`${inputClass} mt-4 min-h-40 font-mono`} value={settingsJson} onChange={(event) => setSettingsJson(event.target.value)} spellCheck={false} />
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h4 className="font-bold text-gray-900">Secret references</h4>
            <p className="mt-1 text-xs text-gray-500">One environment-variable or vault key per line. Passwords and tokens do not belong here.</p>
            <textarea className={`${inputClass} mt-4 min-h-24 font-mono`} value={secretRefs} onChange={(event) => setSecretRefs(event.target.value)} placeholder={'GOOGLE_BUSINESS_REFRESH_TOKEN\nMETA_ACCESS_TOKEN'} />
          </section>

          <label className="block text-sm font-medium text-gray-700">Internal notes
            <textarea className={`${inputClass} mt-1 min-h-28`} value={draft.notes || ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          </label>

          <div className="flex justify-end gap-3 pb-6">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button>
            <button type="button" onClick={save} disabled={saving || !canManage} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save channel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminMarketingVisibility({ canManage }: { canManage: boolean }) {
  const [channels, setChannels] = useState<MarketingChannel[]>([])
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [selected, setSelected] = useState<MarketingChannel | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | ChannelStatus>('all')
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await request<{ channels: MarketingChannel[]; revisions: Revision[] }>('/api/admin/marketing/channels')
      setChannels(data.channels)
      setRevisions(data.revisions)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load marketing hub')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => channels.filter((channel) => {
    const matchesStatus = status === 'all' || channel.status === status
    const haystack = `${channel.name} ${channel.category} ${channel.username || ''} ${channel.description || ''}`.toLowerCase()
    return matchesStatus && haystack.includes(query.trim().toLowerCase())
  }), [channels, query, status])

  const groups = useMemo(() => {
    const result = new Map<string, MarketingChannel[]>()
    for (const channel of filtered) result.set(channel.category, [...(result.get(channel.category) || []), channel])
    return [...result.entries()]
  }, [filtered])

  const publish = async () => {
    setPublishing(true)
    setNotice('')
    setError('')
    try {
      const data = await request<{ revision: Revision; manifest: unknown }>('/api/admin/marketing/publish', {
        method: 'POST',
        body: JSON.stringify({ notes: 'Implementation package created from admin Marketing & Visibility hub.' }),
      })
      const blob = new Blob([JSON.stringify(data.manifest, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `marketing-visibility-v${data.revision.version}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setRevisions((current) => [data.revision, ...current])
      setNotice(`Version ${data.revision.version} was created as ${data.revision.status} and its implementation manifest was downloaded.`)
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Unable to publish')
    } finally {
      setPublishing(false)
    }
  }

  const addChannel = async () => {
    setCreating(true)
    setError('')
    try {
      const created = await request<MarketingChannel>('/api/admin/marketing/channels', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New marketing channel',
          category: 'Other opportunities',
          description: 'Describe how this channel supports visibility or growth.',
          status: 'not_started',
          priority: 'medium',
          inputs: {},
          settings: {},
        }),
      })
      setChannels((current) => [...current, created])
      setSelected(created)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to add channel')
    } finally {
      setCreating(false)
    }
  }

  const activeCount = channels.filter((channel) => channel.status === 'active').length
  const attentionCount = channels.filter((channel) => channel.status === 'needs_attention' || channel.status === 'not_started').length
  const ownedCount = channels.filter((channel) => channel.username || channel.ownerName).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <div className="flex items-center gap-2">
            <Globe2 className="h-7 w-7 text-vortex-red" />
            <h2 className="text-2xl font-bold text-gray-900">Marketing & Visibility</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">One source of truth for discovery, outreach, reputation, social accounts, service inputs, and implementation settings.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={addChannel} disabled={creating || loading || !canManage} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-60">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add channel
          </button>
          <button type="button" onClick={publish} disabled={publishing || loading || !canManage} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-60">
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
            Create implementation package
          </button>
        </div>
      </div>

      {notice && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5" />{notice}</div>}
      {!canManage && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">You have read-only access. A marketing manager or the Owner can update channels and create packages.</div>}
      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="h-5 w-5" />{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total channels', value: channels.length, Icon: Globe2 },
          { label: 'Active', value: activeCount, Icon: CheckCircle2 },
          { label: 'Needs setup', value: attentionCount, Icon: AlertCircle },
          { label: 'Ownership recorded', value: ownedCount, Icon: UserRound },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">{label}</span>
              <Icon className="h-5 w-5 text-gray-400" />
            </div>
            <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-vortex-red focus:outline-none" placeholder="Search channels, usernames, or categories…" />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-vortex-red" /></div>
      ) : (
        <div className="space-y-8">
          {groups.map(([category, categoryChannels]) => (
            <section key={category}>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">{category}</h3>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-600">{categoryChannels.length}</span>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {categoryChannels.map((channel) => {
                  const inputCount = Object.keys(channel.inputs).length
                  const completed = countCompletedInputs(channel.inputs)
                  return (
                    <button key={channel.id} type="button" onClick={() => setSelected(channel)} className="group rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-gray-300 hover:shadow-md">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-gray-900">{channel.name}</h4>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${STATUS_STYLES[channel.status]}`}>{STATUS_LABELS[channel.status]}</span>
                            <span className={`rounded-full border px-2 py-1 text-[11px] font-bold uppercase ${PRIORITY_STYLES[channel.priority]}`}>{channel.priority}</span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-gray-600">{channel.description}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-600" />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-600">
                        <span className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{channel.username || channel.ownerName || 'Ownership not recorded'}</span>
                        <span className="flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" />{completed}/{inputCount} inputs complete</span>
                        {!channel.readiness.ready && <span className="flex items-center gap-1.5 text-amber-700"><AlertCircle className="h-3.5 w-3.5" />{channel.readiness.blockers.length} readiness blocker{channel.readiness.blockers.length === 1 ? '' : 's'}</span>}
                        {channel.accountUrl && <span className="flex items-center gap-1.5"><ExternalLink className="h-3.5 w-3.5" />Profile linked</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {revisions.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2"><Download className="h-5 w-5 text-gray-500" /><h3 className="font-bold text-gray-900">Implementation history</h3></div>
          <div className="mt-3 divide-y divide-gray-100">
            {revisions.slice(0, 5).map((revision) => (
              <div key={revision.id} className="flex items-center justify-between py-3 text-sm">
                <div><span className="font-bold text-gray-900">Version {revision.version}</span><span className="ml-2 text-gray-500">{revision.channel_count} channels · {revision.status}</span></div>
                <time className="text-xs text-gray-500">{new Date(revision.created_at).toLocaleString()}</time>
              </div>
            ))}
          </div>
        </section>
      )}

      {selected && <ChannelEditor channel={selected} canManage={canManage} onClose={() => setSelected(null)} onSaved={(saved) => { setChannels((current) => current.map((item) => item.id === saved.id ? saved : item)); setSelected(null); setNotice(`${saved.name} was updated.`) }} />}
    </div>
  )
}
