import { useEffect, useMemo, useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import {
  applyAddOnToPlan,
  normalizePhasePlan,
  phasePlanForObjective,
  SESSION_OBJECTIVE_OPTIONS,
  sortPhasePlan,
  type PhasePlanRow,
  type SessionObjective,
} from '../../coach/phasePlan'
import type { SessionPhaseTemplate, Workout, WorkoutAudience, WorkoutCoachRationale, WorkoutSessionFormat } from '../../coach/types'
import { useTaxonomy } from './useTaxonomy'

interface Props {
  workout: Workout
  onApply: (patch: Partial<Workout>) => void
  onComplete: () => void
  onClose: () => void
}

function scaleTemplatePlan(plan: PhasePlanRow[], targetMinutes: number, baseMinutes: number): PhasePlanRow[] {
  if (targetMinutes === baseMinutes || plan.length === 0) return plan
  const ratio = targetMinutes / baseMinutes
  const scaled = plan.map((p) => ({
    ...p,
    minutes: Math.max(p.minutes > 0 ? 1 : 0, Math.round(p.minutes * ratio)),
  }))
  const total = scaled.reduce((s, p) => s + p.minutes, 0)
  const delta = targetMinutes - total
  if (delta !== 0) {
    const capIdx = scaled.findIndex((p) => p.phaseKey === 'capacity')
    const idx = capIdx >= 0 ? capIdx : Math.max(0, scaled.length - 2)
    scaled[idx] = { ...scaled[idx], minutes: Math.max(0, scaled[idx].minutes + delta) }
  }
  return scaled.filter((p) => p.minutes > 0)
}

function buildPlanFromWizard(
  objective: SessionObjective,
  duration: number,
  format: WorkoutSessionFormat,
  templates: SessionPhaseTemplate[],
): PhasePlanRow[] {
  const tpl = templates.find((t) => t.key === `session_${duration}_standard`)
  let plan: PhasePlanRow[]

  if (tpl?.phase_plan?.length) {
    plan = normalizePhasePlan(tpl.phase_plan)
    if (objective !== 'general_athletic_development') {
      plan = phasePlanForObjective(objective, duration)
    }
  } else {
    plan = phasePlanForObjective(objective, duration)
  }

  if (format.tumbling_minutes && format.tumbling_minutes > 0) {
    plan = plan.map((p) =>
      p.phaseKey === 'movement_intelligence'
        ? { ...p, minutes: format.tumbling_minutes!, contains_tumbling: true, label: 'Skill / Tumbling' }
        : p,
    )
    const skillIdx = plan.findIndex((p) => p.phaseKey === 'movement_intelligence')
    const overflow = plan.reduce((s, p) => s + p.minutes, 0) - duration
    if (overflow > 0 && skillIdx >= 0) {
      const capIdx = plan.findIndex((p) => p.phaseKey === 'capacity')
      if (capIdx >= 0) plan[capIdx] = { ...plan[capIdx], minutes: Math.max(1, plan[capIdx].minutes - overflow) }
    }
  }

  if (format.add_on_focus && format.add_on_minutes && format.add_on_minutes > 0) {
    plan = applyAddOnToPlan(plan, format.add_on_focus, format.add_on_minutes)
  }

  return sortPhasePlan(plan)
}

export default function WorkoutSetupWizard({ workout, onApply, onComplete, onClose }: Props) {
  const { taxonomy } = useTaxonomy()
  const [step, setStep] = useState(0)
  const [templates, setTemplates] = useState<SessionPhaseTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [duration, setDuration] = useState<number>(workout.duration_minutes ?? workout.target_minutes ?? 60)
  const [objective, setObjective] = useState<SessionObjective>(
    (workout.session_objective as SessionObjective) || 'general_athletic_development',
  )
  const [format, setFormat] = useState<WorkoutSessionFormat>(workout.format_json ?? {})
  const [audience, setAudience] = useState<WorkoutAudience>(workout.audience_json ?? {})
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')

  useEffect(() => {
    coachFetch<SessionPhaseTemplate[]>('/api/coach/session-templates')
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false))
  }, [])

  const previewPlan = useMemo(
    () => buildPlanFromWizard(objective, duration, format, templates),
    [objective, duration, format, templates],
  )

  const applyPlan = (plan: PhasePlanRow[], templateKey?: string) => {
    const objectiveLabel = SESSION_OBJECTIVE_OPTIONS.find((o) => o.value === objective)?.label ?? objective
    onApply({
      duration_minutes: duration,
      target_minutes: duration,
      session_objective: objective,
      format_json: format,
      audience_json: audience,
      phase_plan_json: plan,
      coach_rationale_json: {
        session_why: templateKey
          ? (templates.find((t) => t.key === templateKey)?.summary ?? undefined)
          : `${objectiveLabel} session using the Athleticism Accelerator phase model.`,
        order_why: 'Phases follow Prepare → Skill → Output → Capacity → Control → Sustained Capacity → Restore so sensitive work stays fresh.',
      } satisfies WorkoutCoachRationale,
    })
  }

  const applyTemplate = (key: string) => {
    const tpl = templates.find((t) => t.key === key)
    if (!tpl?.phase_plan) return
    setSelectedTemplate(key)
    const baseMinutes = Number(key.match(/session_(\d+)/)?.[1]) || duration
    const plan = scaleTemplatePlan(normalizePhasePlan(tpl.phase_plan), duration, baseMinutes)
    applyPlan(plan, key)
  }

  const finish = () => {
    if (selectedTemplate) {
      applyTemplate(selectedTemplate)
    } else {
      applyPlan(previewPlan)
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
                <input type="number" value={format.tumbling_minutes ?? ''} onChange={(e) => setFormat({ ...format, tumbling_minutes: e.target.value ? Number(e.target.value) : undefined })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Optional — overrides skill phase budget" />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-gray-700">Add-on focus</span>
                <select value={format.add_on_focus ?? ''} onChange={(e) => setFormat({ ...format, add_on_focus: e.target.value || undefined })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">None</option>
                  <option value="speed">Speed (after skill)</option>
                  <option value="explosiveness">Explosiveness / power (after skill)</option>
                  <option value="agility">Agility (after skill)</option>
                  <option value="strength">Strength (after output)</option>
                  <option value="calisthenics">Calisthenics (after output)</option>
                  <option value="fitness">Sustained Capacity / conditioning (late)</option>
                  <option value="mobility">Mobility (prepare + restore)</option>
                </select>
              </label>
              {format.add_on_focus && (
                <label className="block text-sm">
                  <span className="font-semibold text-gray-700">Add-on minutes</span>
                  <input type="number" min={0} value={format.add_on_minutes ?? 10} onChange={(e) => setFormat({ ...format, add_on_minutes: Number(e.target.value) || 0 })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
                </label>
              )}
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
            <div className="space-y-2">
              <span className="block text-sm font-semibold text-gray-700">Session objective</span>
              {SESSION_OBJECTIVE_OPTIONS.map((opt) => (
                <label key={opt.value} className={`flex items-start gap-2 border rounded-lg p-3 cursor-pointer ${objective === opt.value ? 'border-vortex-red bg-red-50' : 'border-gray-200'}`}>
                  <input type="radio" name="objective" checked={objective === opt.value} onChange={() => setObjective(opt.value)} className="mt-1" />
                  <span className="text-sm text-gray-800">{opt.label}</span>
                </label>
              ))}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                Choose a seeded template or use the objective-based plan below ({previewPlan.reduce((s, p) => s + p.minutes, 0)} min).
              </div>
              {loadingTemplates ? (
                <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading templates…</div>
              ) : (
                <>
                  {templates
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
                    ))}
                  <div className="border border-dashed border-gray-300 rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Objective plan preview</div>
                    <div className="space-y-1">
                      {previewPlan.map((p) => (
                        <div key={`${p.phaseKey}-${p.label}`} className="flex justify-between text-sm">
                          <span>{taxonomy?.sessionPhases?.find((sp) => sp.key === p.phaseKey)?.name ?? p.phaseKey}</span>
                          <span className="text-gray-500">{p.minutes} min</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
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
