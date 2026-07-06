import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
import {
  METHODOLOGIES_HUB,
  ORDER_SLOTS_HUB,
  PHYSIOLOGY_HUB,
  SESSION_MODELS_HUB,
  SESSION_PHASES_HUB,
  TENETS_HUB,
  TRAINING_PHILOSOPHY_TAXONOMY,
  VALIDATION_RULES_HUB,
} from '../../coach/trainingPhilosophyTaxonomy'

type HubTone = 'violet' | 'red' | 'blue' | 'amber' | 'green' | 'teal' | 'indigo' | 'orange' | 'rose'

const HUB_STYLES: Record<HubTone, { border: string; bg: string; divider: string }> = {
  violet: { border: 'border-violet-200', bg: 'bg-violet-50/40', divider: 'border-violet-100' },
  red: { border: 'border-red-200', bg: 'bg-red-50/40', divider: 'border-red-100' },
  blue: { border: 'border-blue-200', bg: 'bg-blue-50/40', divider: 'border-blue-100' },
  amber: { border: 'border-amber-200', bg: 'bg-amber-50/40', divider: 'border-amber-100' },
  green: { border: 'border-green-200', bg: 'bg-green-50/40', divider: 'border-green-100' },
  teal: { border: 'border-teal-200', bg: 'bg-teal-50/40', divider: 'border-teal-100' },
  indigo: { border: 'border-indigo-200', bg: 'bg-indigo-50/40', divider: 'border-indigo-100' },
  orange: { border: 'border-orange-200', bg: 'bg-orange-50/40', divider: 'border-orange-100' },
  rose: { border: 'border-rose-200', bg: 'bg-rose-50/40', divider: 'border-rose-100' },
}

function EducationDetail({ row }: { row: EducationContent }) {
  return (
    <div className="px-4 py-3 text-sm text-gray-700 space-y-2">
      {row.short_summary && <p className="text-gray-600">{row.short_summary}</p>}
      {row.what_it_is && <p><span className="font-semibold">What it is:</span> {row.what_it_is}</p>}
      {row.why_it_matters && <p><span className="font-semibold">Why it matters:</span> {row.why_it_matters}</p>}
      {row.why_it_goes_here && <p><span className="font-semibold">Why here:</span> {row.why_it_goes_here}</p>}
      {row.why_this_order && <p><span className="font-semibold">Why this order:</span> {row.why_this_order}</p>}
      {row.fatigue_logic && <p><span className="font-semibold">Fatigue logic:</span> {row.fatigue_logic}</p>}
      {row.programming_guidance && <p><span className="font-semibold">Programming:</span> {row.programming_guidance}</p>}
      {row.common_misuse && <p><span className="font-semibold">Common misuse:</span> {row.common_misuse}</p>}
      {row.scaling_guidance && <p><span className="font-semibold">Scaling:</span> {row.scaling_guidance}</p>}
    </div>
  )
}

function SessionModelMinutes({ row }: { row: EducationContent }) {
  const plan = Array.isArray(row.examples_json) ? row.examples_json : []
  if (plan.length === 0) return null
  return (
    <div className="mt-2">
      <p className="font-semibold text-gray-900 mb-1">Phase allocation</p>
      <ul className="list-disc list-inside text-gray-600 space-y-0.5">
        {plan.map((block: { phase?: string; minutes?: number; contains_tumbling?: boolean; add_on_focus?: string }, i: number) => (
          <li key={`${block.phase}-${i}`}>
            {block.phase?.replace(/_/g, ' ')} — {block.minutes} min
            {block.contains_tumbling ? ' (tumbling block)' : ''}
            {block.add_on_focus ? ` (${block.add_on_focus.replace(/_/g, ' ')})` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function FrameworkPanel() {
  const { taxonomy } = useTaxonomy()
  const [education, setEducation] = useState<EducationContent[]>([])
  const [loading, setLoading] = useState(true)
  const [openKey, setOpenKey] = useState<string | null>('taxonomy:overview')

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

  const toggle = (key: string) => setOpenKey((prev) => (prev === key ? null : key))

  const PhilosophyHub = ({
    hubKey,
    title,
    tone,
    children,
  }: {
    hubKey: string
    title: string
    tone: HubTone
    children: ReactNode
  }) => {
    const open = openKey === hubKey
    const styles = HUB_STYLES[tone]
    return (
      <div className={`border rounded-lg overflow-hidden ${styles.border} ${styles.bg}`}>
        <button
          type="button"
          onClick={() => toggle(hubKey)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="font-semibold text-gray-900">{title}</span>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {open && (
          <div className={`px-4 pb-4 text-sm text-gray-700 space-y-4 border-t ${styles.divider}`}>
            {children}
          </div>
        )}
      </div>
    )
  }

  const ItemAccordion = ({
    row,
    prefix,
    extra,
  }: {
    row: EducationContent
    prefix: string
    extra?: ReactNode
  }) => {
    const key = `${prefix}:${row.entity_key}:${row.entity_id ?? 'null'}`
    const open = openKey === key
    return (
      <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => toggle(key)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left"
        >
          <span className="font-semibold text-gray-800">{row.title ?? row.entity_key}</span>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {open && (
          <>
            <EducationDetail row={row} />
            {extra}
          </>
        )}
      </div>
    )
  }

  const Section = ({
    title,
    hubKey,
    hubTitle,
    tone,
    hubContent,
    entityType,
    keys,
    itemExtra,
    groupOrderSlots,
  }: {
    title: string
    hubKey: string
    hubTitle: string
    tone: HubTone
    hubContent: ReactNode
    entityType: string
    keys?: string[]
    itemExtra?: (row: EducationContent) => ReactNode
    groupOrderSlots?: boolean
  }) => {
    const rows = keys
      ? keys.map((k) => eduFor(entityType, k)).filter(Boolean) as EducationContent[]
      : dedupeEducation(byType.get(entityType) ?? [])

    if (rows.length === 0 && !hubContent) return null

    const groupedSlots = groupOrderSlots
      ? SESSION_PHASE_ORDER.map((phaseKey) => ({
          phaseKey,
          label: orderedPhases.find((p) => p.key === phaseKey)?.name ?? phaseKey.replace(/_/g, ' '),
          rows: rows.filter((r) => {
            const slot = taxonomy?.phaseOrderSlots?.find((s) => s.key === r.entity_key)
            return slot?.phase_key === phaseKey
          }),
        })).filter((g) => g.rows.length > 0)
      : null

    return (
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <PhilosophyHub hubKey={hubKey} title={hubTitle} tone={tone}>
          {hubContent}
        </PhilosophyHub>
        {groupedSlots ? (
          groupedSlots.map((group) => (
            <div key={group.phaseKey} className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{group.label}</h4>
              {group.rows.map((row) => (
                <ItemAccordion
                  key={`${entityType}:${row.entity_key}:${row.entity_id}`}
                  row={row}
                  prefix={entityType}
                  extra={itemExtra?.(row)}
                />
              ))}
            </div>
          ))
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <ItemAccordion
                key={`${entityType}:${row.entity_key}:${row.entity_id}`}
                row={row}
                prefix={entityType}
                extra={itemExtra?.(row)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const prepareSubroles = prepareAccessSubroleSequence(taxonomy)

  const SubroleSection = () => {
    if (prepareSubroles.length === 0) return null
    const rampOpen = openKey === 'ramp:philosophy'
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900">Prepare & Access sequence</h3>

        <div className="border border-violet-200 rounded-lg overflow-hidden bg-violet-50/40">
          <button
            type="button"
            onClick={() => toggle('ramp:philosophy')}
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
                  Prepare & Access uses five subroles, then the main session phases express performance intent:
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
              <button type="button" onClick={() => toggle(key)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left">
                <span className="font-semibold text-gray-800">{sr.name}</span>
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

  const TaxonomyOverview = () => {
    const open = openKey === 'taxonomy:overview'
    return (
      <div className="space-y-3">
        <div className={`border rounded-lg overflow-hidden ${HUB_STYLES.red.border} ${HUB_STYLES.red.bg}`}>
          <button
            type="button"
            onClick={() => toggle('taxonomy:overview')}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="font-semibold text-gray-900">{TRAINING_PHILOSOPHY_TAXONOMY.title}</span>
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {open && (
            <div className={`px-4 pb-4 text-sm text-gray-700 space-y-4 border-t ${HUB_STYLES.red.divider}`}>
              <p>{TRAINING_PHILOSOPHY_TAXONOMY.intro}</p>

              <div>
                <p className="font-semibold text-gray-900 mb-2">How the layers connect</p>
                <ul className="space-y-3">
                  {TRAINING_PHILOSOPHY_TAXONOMY.layers.map((layer) => (
                    <li key={layer.name} className="border-l-2 border-vortex-red pl-3">
                      <span className="font-medium text-gray-900">{layer.name}</span>
                      <span className="text-gray-600"> — {layer.role}</span>
                      <p className="text-gray-600 mt-0.5">{layer.connects}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-semibold text-gray-900 mb-2">Canonical session flow</p>
                <ol className="space-y-2">
                  {TRAINING_PHILOSOPHY_TAXONOMY.flow.map((step) => (
                    <li key={step.phaseKey} className="flex gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-vortex-red text-white text-xs font-bold flex items-center justify-center">
                        {step.step}
                      </span>
                      <span className="font-medium text-gray-900">{step.label}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <p className="font-semibold text-gray-900 mb-2">Common shortfalls in traditional workouts</p>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  {TRAINING_PHILOSOPHY_TAXONOMY.shortfalls.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <p className="font-medium text-gray-900">{TRAINING_PHILOSOPHY_TAXONOMY.transcends}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const sessionModelKeys = [
    'master_session_order',
    'session_60_general',
    'session_90_tumbling_first',
    'session_90_tumbling_end',
    'session_120_speed_addon',
    'session_120_fitness_addon',
    'addon_speed_placement',
    'addon_fitness_placement',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-vortex-red" /> Training Philosophy
        </h2>
        <p className="text-sm text-gray-500">
          Explore the Athleticism Accelerator taxonomy — how phases, tenets, methodologies, physiology, order slots, session models, and validation rules work together.
        </p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading framework…</div>
      ) : (
        <div className="space-y-8">
          <TaxonomyOverview />

          <Section
            title="Session Phases"
            hubKey="hub:session_phases"
            hubTitle={SESSION_PHASES_HUB.title}
            tone="blue"
            hubContent={(
              <>
                <p>{SESSION_PHASES_HUB.intro}</p>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Phase principles</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    {SESSION_PHASES_HUB.principles.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <p><span className="font-semibold">Common misuse:</span> {SESSION_PHASES_HUB.misuse}</p>
              </>
            )}
            entityType="session_phase"
            keys={orderedPhases.map((p) => p.key)}
          />

          <SubroleSection />

          <Section
            title="Athleticism Accelerator Tenets"
            hubKey="hub:tenets"
            hubTitle={TENETS_HUB.title}
            tone="amber"
            hubContent={(
              <>
                <p>{TENETS_HUB.intro}</p>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Tenet programming principles</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    {TENETS_HUB.principles.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <p><span className="font-semibold">Common misuse:</span> {TENETS_HUB.misuse}</p>
              </>
            )}
            entityType="tenet"
          />

          <Section
            title="Methodologies"
            hubKey="hub:methodologies"
            hubTitle={METHODOLOGIES_HUB.title}
            tone="green"
            hubContent={(
              <>
                <p>{METHODOLOGIES_HUB.intro}</p>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Primary phase homes</p>
                  <ul className="space-y-2">
                    {METHODOLOGIES_HUB.primaryHomes.map((row) => (
                      <li key={row.methodology} className="text-gray-600">
                        <span className="font-medium text-gray-800">{row.methodology}</span>
                        {' — Primary: '}{row.primary}
                        {row.secondary ? `; Secondary: ${row.secondary}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
                <p><span className="font-semibold">Common misuse:</span> {METHODOLOGIES_HUB.misuse}</p>
              </>
            )}
            entityType="methodology"
          />

          <Section
            title="Physiological Emphasis"
            hubKey="hub:physiology"
            hubTitle={PHYSIOLOGY_HUB.title}
            tone="teal"
            hubContent={(
              <>
                <p>{PHYSIOLOGY_HUB.intro}</p>
                <ul className="space-y-2">
                  {PHYSIOLOGY_HUB.systems.map((sys) => (
                    <li key={sys.key} className="text-gray-600">
                      <span className="font-medium text-gray-800">{sys.key.replace(/_/g, ' ')}</span>
                      {' — '}{sys.summary}
                    </li>
                  ))}
                </ul>
                <p><span className="font-semibold">Common misuse:</span> {PHYSIOLOGY_HUB.misuse}</p>
              </>
            )}
            entityType="physiology"
          />

          <Section
            title="Order Slots"
            hubKey="hub:order_slots"
            hubTitle={ORDER_SLOTS_HUB.title}
            tone="indigo"
            hubContent={(
              <>
                <p>{ORDER_SLOTS_HUB.intro}</p>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  {ORDER_SLOTS_HUB.concepts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Phase groupings</p>
                  <ul className="space-y-3">
                    {ORDER_SLOTS_HUB.phaseGroups.map((group) => (
                      <li key={group.phase} className="border-l-2 border-indigo-300 pl-3">
                        <span className="font-medium text-gray-900">{group.phase}</span>
                        <p className="text-gray-600">Subroles: {group.subroles}</p>
                        <p className="text-gray-600 text-xs mt-0.5">Examples: {group.examples}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <p><span className="font-semibold">Common misuse:</span> {ORDER_SLOTS_HUB.misuse}</p>
              </>
            )}
            entityType="phase_order_slot"
            groupOrderSlots
          />

          <Section
            title="Session Models (60 / 90 / 120)"
            hubKey="hub:session_models"
            hubTitle={SESSION_MODELS_HUB.title}
            tone="orange"
            hubContent={(
              <>
                <p>{SESSION_MODELS_HUB.intro}</p>
                <ul className="space-y-2">
                  {SESSION_MODELS_HUB.models.map((model) => (
                    <li key={model.key} className="text-gray-600">
                      <span className="font-medium text-gray-800">{model.name}</span>
                      {' — '}{model.summary}
                    </li>
                  ))}
                </ul>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Add-on placement rules</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    {SESSION_MODELS_HUB.placementRules.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <p><span className="font-semibold">Common misuse:</span> {SESSION_MODELS_HUB.misuse}</p>
              </>
            )}
            entityType="template"
            keys={sessionModelKeys}
            itemExtra={(row) => (
              <div className="px-4 pb-3">
                <SessionModelMinutes row={row} />
              </div>
            )}
          />

          <Section
            title="Validation Rules"
            hubKey="hub:validation_rules"
            hubTitle={VALIDATION_RULES_HUB.title}
            tone="rose"
            hubContent={(
              <>
                <p>{VALIDATION_RULES_HUB.intro}</p>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Rule categories</p>
                  <ul className="space-y-2">
                    {VALIDATION_RULES_HUB.categories.map((cat) => (
                      <li key={cat.name} className="text-gray-600">
                        <span className="font-medium text-gray-800">{cat.name}</span>
                        <span className="block text-xs mt-0.5">{cat.examples}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  {VALIDATION_RULES_HUB.principles.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p><span className="font-semibold">Common misuse:</span> {VALIDATION_RULES_HUB.misuse}</p>
              </>
            )}
            entityType="validation_rule"
          />
        </div>
      )}
    </div>
  )
}
