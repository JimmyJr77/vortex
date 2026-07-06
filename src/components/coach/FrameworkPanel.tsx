import { useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import type { EducationContent } from '../../coach/types'
import { SESSION_PHASE_ORDER } from '../../coach/taxonomy'
import { prepareAccessSubroleSequence } from '../../coach/taxonomy'
import {
  ORIGINAL_RAMP_PHASES,
  POTENTIATE_BRIDGE_AUDIENCE,
  RAMP_PHILOSOPHY_INTRO,
  RAMP_VARIANTS_NOTE,
  VORTEX_ORDER_RATIONALE,
  VORTEX_SESSION_PROGRESSION,
} from '../../coach/prepareAccessRampPhilosophy'

export default function FrameworkPanel() {
  const { taxonomy } = useTaxonomy()
  const [education, setEducation] = useState<EducationContent[]>([])
  const [loading, setLoading] = useState(true)
  const [openKey, setOpenKey] = useState<string | null>('ramp:philosophy')

  useEffect(() => {
    coachFetch<EducationContent[]>('/api/coach/education')
      .then(setEducation)
      .catch(() => setEducation([]))
      .finally(() => setLoading(false))
  }, [])

  const byType = useMemo(() => {
    const map = new Map<string, EducationContent[]>()
    for (const row of education) {
      const list = map.get(row.entity_type) ?? []
      list.push(row)
      map.set(row.entity_type, list)
    }
    return map
  }, [education])

  const phases = taxonomy?.sessionPhases ?? []
  const orderedPhases = [...phases].sort((a, b) => {
    const ai = SESSION_PHASE_ORDER.indexOf(a.key as typeof SESSION_PHASE_ORDER[number])
    const bi = SESSION_PHASE_ORDER.indexOf(b.key as typeof SESSION_PHASE_ORDER[number])
    return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999)
  })

  const eduFor = (entityType: string, entityKey: string) =>
    (byType.get(entityType) ?? []).find((e) => e.entity_key === entityKey)

  const dedupeEducation = (rows: EducationContent[]) => {
    const map = new Map<string, EducationContent>()
    for (const row of rows) {
      const k = `${row.entity_type}:${row.entity_key}:${row.entity_id ?? 'null'}`
      const existing = map.get(k)
      if (!existing || Number(row.id) < Number(existing.id)) map.set(k, row)
    }
    return [...map.values()]
  }

  const Section = ({ title, entityType, keys }: { title: string; entityType: string; keys?: string[] }) => {
    const rows = keys
      ? keys.map((k) => eduFor(entityType, k)).filter(Boolean) as EducationContent[]
      : dedupeEducation(byType.get(entityType) ?? [])
    if (rows.length === 0) return null
    return (
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {rows.map((row) => {
          const key = `${entityType}:${row.entity_key}`
          const open = openKey === key
          return (
            <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
              <button type="button" onClick={() => setOpenKey(open ? null : key)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left">
                <span className="font-semibold text-gray-800">{row.title ?? row.entity_key}</span>
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {open && (
                <div className="px-4 py-3 text-sm text-gray-700 space-y-2">
                  {row.short_summary && <p className="text-gray-600">{row.short_summary}</p>}
                  {row.what_it_is && <p><span className="font-semibold">What:</span> {row.what_it_is}</p>}
                  {row.why_it_matters && <p><span className="font-semibold">Why it matters:</span> {row.why_it_matters}</p>}
                  {row.why_it_goes_here && <p><span className="font-semibold">Why here:</span> {row.why_it_goes_here}</p>}
                  {row.programming_guidance && <p><span className="font-semibold">Programming:</span> {row.programming_guidance}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const prepareSubroles = prepareAccessSubroleSequence(taxonomy)

  const SubroleSection = () => {
    if (prepareSubroles.length === 0) return null
    const rampOpen = openKey === 'ramp:philosophy'
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900">Prepare / Access sequence</h3>

        <div className="border border-violet-200 rounded-lg overflow-hidden bg-violet-50/40">
          <button
            type="button"
            onClick={() => setOpenKey(rampOpen ? null : 'ramp:philosophy')}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="font-semibold text-gray-900">RAMP framework &amp; Vortex progression</span>
            {rampOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {rampOpen && (
            <div className="px-4 pb-4 text-sm text-gray-700 space-y-4 border-t border-violet-100">
              <p>{RAMP_PHILOSOPHY_INTRO}</p>

              <div>
                <p className="font-semibold text-gray-900 mb-2">Original RAMP sequence (Jeffreys)</p>
                <ol className="list-decimal list-inside space-y-2">
                  {ORIGINAL_RAMP_PHASES.map((phase) => (
                    <li key={phase.name}>
                      <span className="font-medium">{phase.name}</span>
                      {' — '}
                      {phase.goal}
                      <span className="block text-gray-600 ml-5 mt-0.5">Examples: {phase.examples}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <p>{RAMP_VARIANTS_NOTE}</p>
              <p>{VORTEX_ORDER_RATIONALE}</p>
              <p className="text-gray-600 italic">{POTENTIATE_BRIDGE_AUDIENCE}</p>

              <div>
                <p className="font-semibold text-gray-900 mb-2">Vortex session progression</p>
                <p className="text-gray-600 mb-2">
                  Prepare / Access uses five subroles, then the main session phases express performance intent:
                </p>
                <ol className="space-y-3">
                  {VORTEX_SESSION_PROGRESSION.map((step, i) => (
                    <li key={step.stage} className="flex gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-vortex-red text-white text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div>
                        <span className="font-semibold text-gray-900">{step.stage}</span>
                        <span className="text-gray-600"> — {step.goal}</span>
                        <p className="text-gray-600 mt-0.5">Examples: {step.examples}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-500">
          Coach-facing subroles follow{' '}
          <span className="font-medium text-gray-700">Raise → Mobilize → Activate → Integrate → Potentiate Bridge</span>
          {' '}— then{' '}
          <span className="font-medium text-gray-700">Performance Work</span>
          {' '}(Skill, Output, Capacity, and beyond). Fine order slots map to each subrole in the exercise library.
        </p>
        {prepareSubroles.map((sr) => {
          const key = `phase_subrole:${sr.key}`
          const open = openKey === key
          return (
            <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
              <button type="button" onClick={() => setOpenKey(open ? null : key)} className="w-full flex items-center justify-between px-4 py-3 bg-violet-50 text-left">
                <span className="font-semibold text-gray-800">{sr.order_index / 10}. {sr.name}</span>
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {open && (
                <div className="px-4 py-3 text-sm text-gray-700 space-y-2">
                  {sr.description && <p className="text-gray-600">{sr.description}</p>}
                  {sr.why_it_exists && <p><span className="font-semibold">Why:</span> {sr.why_it_exists}</p>}
                  {sr.what_belongs_here && <p><span className="font-semibold">Examples:</span> {sr.what_belongs_here}</p>}
                  {sr.what_to_avoid && <p><span className="font-semibold">Avoid:</span> {sr.what_to_avoid}</p>}
                  {sr.coach_guidance && <p><span className="font-semibold">Coaching:</span> {sr.coach_guidance}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BookOpen className="w-6 h-6 text-vortex-red" /> Training Philosophy</h2>
        <p className="text-sm text-gray-500">Browse phases, tenets, methodologies, and session models with coach-facing rationale.</p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading framework…</div>
      ) : (
        <div className="space-y-8">
          <Section title="Session Phases" entityType="session_phase" keys={orderedPhases.map((p) => p.key)} />
          <SubroleSection />
          <Section title="Tenets" entityType="tenet" />
          <Section title="Methodologies" entityType="methodology" />
          <Section title="Physiological Emphasis" entityType="physiology" />
          <Section title="Order Slots" entityType="phase_order_slot" />
          <Section title="Session Models (60/90/120)" entityType="template" />
          <Section title="Validation Rules" entityType="validation_rule" />
        </div>
      )}
    </div>
  )
}
