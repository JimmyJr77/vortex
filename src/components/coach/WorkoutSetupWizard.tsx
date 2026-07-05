import { useEffect, useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import type { SessionPhaseTemplate, Workout, WorkoutAudience, WorkoutCoachRationale, WorkoutSessionFormat } from '../../coach/types'
import { useTaxonomy } from './useTaxonomy'

interface Props {
  workout: Workout
  onApply: (patch: Partial<Workout>) => void
  onComplete: () => void
  onClose: () => void
}

export default function WorkoutSetupWizard({ workout, onApply, onComplete, onClose }: Props) {
  const { taxonomy } = useTaxonomy()
  const [step, setStep] = useState(0)
  const [templates, setTemplates] = useState<SessionPhaseTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [duration, setDuration] = useState<number>(workout.duration_minutes ?? workout.target_minutes ?? 60)
  const [sessionObjective, setSessionObjective] = useState(workout.session_objective ?? '')
  const [format, setFormat] = useState<WorkoutSessionFormat>(workout.format_json ?? {})
  const [audience, setAudience] = useState<WorkoutAudience>(workout.audience_json ?? {})
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')

  useEffect(() => {
    coachFetch<SessionPhaseTemplate[]>('/api/coach/session-templates')
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false))
  }, [])

  const applyTemplate = (key: string) => {
    const tpl = templates.find((t) => t.key === key)
    if (!tpl?.phase_plan) return
    setSelectedTemplate(key)
    onApply({
      duration_minutes: duration,
      target_minutes: duration,
      session_objective: sessionObjective,
      format_json: format,
      audience_json: audience,
      phase_plan_json: tpl.phase_plan,
      coach_rationale_json: {
        session_why: tpl.summary ?? undefined,
        order_why: 'Phases follow the Athleticism Accelerator master order.',
      } satisfies WorkoutCoachRationale,
    })
  }

  const finish = () => {
    if (selectedTemplate) applyTemplate(selectedTemplate)
    else {
      onApply({
        duration_minutes: duration,
        target_minutes: duration,
        session_objective: sessionObjective,
        format_json: format,
        audience_json: audience,
      })
    }
    onComplete()
  }

  const steps = ['Session Format', 'Athlete Profile', 'Session Objective', 'Phase Allocation']

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h3 className="font-bold text-lg">Session Setup</h3>
            <p className="text-xs text-gray-500">{steps[step]}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {step === 0 && (
            <>
              <label className="block text-sm">
                <span className="font-semibold text-gray-700">Duration (minutes)</span>
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  {[60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-gray-700">Tumbling block (minutes)</span>
                <input type="number" value={format.tumbling_minutes ?? ''} onChange={(e) => setFormat({ ...format, tumbling_minutes: e.target.value ? Number(e.target.value) : undefined })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-gray-700">Add-on focus</span>
                <select value={format.add_on_focus ?? ''} onChange={(e) => setFormat({ ...format, add_on_focus: e.target.value || undefined })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">None</option>
                  <option value="speed">Speed (early)</option>
                  <option value="fitness">Fitness (late)</option>
                  <option value="strength">Strength (after output)</option>
                </select>
              </label>
            </>
          )}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="font-semibold text-gray-700">Skill level</span>
                <select value={audience.skill_level ?? ''} onChange={(e) => setAudience({ ...audience, skill_level: e.target.value || undefined })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">Any</option>
                  <option value="EARLY_STAGE">Early Stage</option>
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="font-semibold text-gray-700">Sport</span>
                <select value={audience.sport_id ?? ''} onChange={(e) => setAudience({ ...audience, sport_id: e.target.value ? Number(e.target.value) : undefined })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">Universal</option>
                  {taxonomy?.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>
          )}
          {step === 2 && (
            <label className="block text-sm">
              <span className="font-semibold text-gray-700">Session objective</span>
              <textarea value={sessionObjective} onChange={(e) => setSessionObjective(e.target.value)} rows={4} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="What should this session accomplish?" />
            </label>
          )}
          {step === 3 && (
            <div className="space-y-2">
              {loadingTemplates ? (
                <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading templates…</div>
              ) : (
                templates
                  .filter((t) => t.key.includes(String(duration)))
                  .map((tpl) => (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => applyTemplate(tpl.key)}
                      className={`w-full text-left border rounded-lg p-3 ${selectedTemplate === tpl.key ? 'border-vortex-red bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="font-semibold text-gray-900">{tpl.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{tpl.summary}</div>
                    </button>
                  ))
              )}
              {!loadingTemplates && templates.filter((t) => t.key.includes(String(duration))).length === 0 && (
                <p className="text-sm text-gray-500">No seeded template for {duration} min — you can still build manually.</p>
              )}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-between">
          <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="text-sm text-gray-600 disabled:opacity-40">Back</button>
          {step < steps.length - 1 ? (
            <button type="button" onClick={() => setStep((s) => s + 1)} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold">Next</button>
          ) : (
            <button type="button" onClick={finish} className="flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold">
              <Sparkles className="w-4 h-4" /> Apply to builder
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
