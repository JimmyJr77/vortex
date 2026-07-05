import { useCallback, useEffect, useState } from 'react'
import { Layers, Loader2, Save, AlertTriangle } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import { allValidationIssues, validationStatusLabel } from '../../coach/validationMessages'
import type { RegimenTemplate, ValidationResult } from '../../coach/types'

export default function RegimenBuilder() {
  const { taxonomy } = useTaxonomy()
  const [templates, setTemplates] = useState<RegimenTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [draft, setDraft] = useState<RegimenTemplate>({
    name: '',
    description: '',
    duration_type: '60',
    weeks: 4,
    sessions_per_week: 3,
    regimen_rationale_json: { philosophy: 'Evergreen athleticism development with phase-balanced weekly exposure.' },
    phase_distributions: [],
  })
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setTemplates(await coachFetch<RegimenTemplate[]>('/api/coach/regimen-templates'))
    } catch {
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const validate = async () => {
    setValidating(true)
    try {
      setValidation(await coachFetch<ValidationResult>('/api/coach/regimen-templates/validate', { method: 'POST', body: JSON.stringify(draft) }))
    } catch {
      setValidation(null)
    } finally {
      setValidating(false)
    }
  }

  const save = async () => {
    if (!draft.name.trim()) return
    setSaving(true)
    setMessage(null)
    try {
      await validate()
      await coachFetch('/api/coach/regimen-templates', { method: 'POST', body: JSON.stringify(draft) })
      setMessage('Regimen saved.')
      setDraft({ name: '', description: '', duration_type: '60', weeks: 4, sessions_per_week: 3, regimen_rationale_json: {}, phase_distributions: [] })
      setValidation(null)
      void load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Layers className="w-6 h-6 text-vortex-red" /> Regimen Builder</h2>
        <p className="text-sm text-gray-500">Evergreen templates with phase distribution and weekly philosophy.</p>
      </div>
      {message && <div className="rounded-lg bg-gray-100 text-gray-800 px-4 py-2 text-sm">{message}</div>}
      {validation && validation.status !== 'valid' && (
        <div className={`rounded-lg px-4 py-3 text-sm ${validation.errors.length ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
          <div className="flex items-center gap-2 font-semibold mb-2"><AlertTriangle className="w-4 h-4" /> {validationStatusLabel(validation)}</div>
          <ul className="space-y-1 text-xs">{allValidationIssues(validation).slice(0, 5).map((issue, i) => <li key={i}>{issue.message}</li>)}</ul>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Regimen name" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          <div className="grid grid-cols-3 gap-2">
            <select value={draft.duration_type} onChange={(e) => setDraft({ ...draft, duration_type: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-2 text-sm">
              <option value="60">60 min</option>
              <option value="90">90 min</option>
              <option value="120">120 min</option>
            </select>
            <input type="number" value={draft.weeks} onChange={(e) => setDraft({ ...draft, weeks: Number(e.target.value) })} className="border border-gray-300 rounded-lg px-2 py-2 text-sm" placeholder="Weeks" />
            <input type="number" value={draft.sessions_per_week} onChange={(e) => setDraft({ ...draft, sessions_per_week: Number(e.target.value) })} className="border border-gray-300 rounded-lg px-2 py-2 text-sm" placeholder="Sessions/wk" />
          </div>
          <textarea
            value={String((draft.regimen_rationale_json as { philosophy?: string })?.philosophy ?? '')}
            onChange={(e) => setDraft({ ...draft, regimen_rationale_json: { ...draft.regimen_rationale_json, philosophy: e.target.value } })}
            placeholder="Regimen rationale / weekly philosophy"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">Phase distribution (minutes per session)</div>
            {(taxonomy?.sessionPhases ?? []).map((phase) => {
              const existing = draft.phase_distributions?.find((d) => d.phase_id === phase.id)
              return (
                <div key={phase.id} className="flex items-center gap-2 text-sm mb-1">
                  <span className="w-40 truncate">{phase.name}</span>
                  <input
                    type="number"
                    placeholder="min"
                    value={existing?.default_minutes ?? ''}
                    onChange={(e) => {
                      const minutes = e.target.value ? Number(e.target.value) : undefined
                      const rest = (draft.phase_distributions ?? []).filter((d) => d.phase_id !== phase.id)
                      setDraft({ ...draft, phase_distributions: minutes != null ? [...rest, { phase_id: phase.id, phase_key: phase.key, default_minutes: minutes }] : rest })
                    }}
                    className="border border-gray-300 rounded px-2 py-1 w-24"
                  />
                </div>
              )
            })}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void validate()} disabled={validating} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-semibold">
              {validating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Validate'}
            </button>
            <button type="button" onClick={() => void save()} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-vortex-red text-white py-2 rounded-lg font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Saved regimens</h3>
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : templates.length === 0 ? <p className="text-sm text-gray-500">No regimens yet.</p> : (
            <ul className="space-y-2">
              {templates.map((t) => (
                <li key={t.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="font-semibold text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.duration_type} min · {t.weeks} wks · {t.sessions_per_week}/wk</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
