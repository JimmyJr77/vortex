import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BookOpen, ChevronDown, Loader2, Search, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import PhilosophyAssistant from './PhilosophyAssistant'
import type { EducationContent } from '../../coach/types'
import { SESSION_PHASE_ORDER } from '../../coach/taxonomy'
import { prepareAccessSubroleSequence } from '../../coach/taxonomy'
import {
  CANONICAL_PHASE_ORDER,
  phaseDisplayName,
  phaseEducationLookupKeys,
  type CanonicalPhaseKey,
} from '../../coach/sessionPhaseKeys'
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

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'session-phases', label: 'Session phases' },
  { id: 'prepare-access', label: 'Prepare & access' },
  { id: 'tenets', label: 'Tenets' },
  { id: 'methodologies', label: 'Methodologies' },
  { id: 'physiology', label: 'Physiology' },
  { id: 'order-slots', label: 'Order slots' },
  { id: 'session-models', label: 'Session models' },
  { id: 'validation-rules', label: 'Validation' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

const EDUCATION_FIELDS: Array<{ key: keyof EducationContent; label: string }> = [
  { key: 'short_summary', label: 'Summary' },
  { key: 'what_it_is', label: 'What it is' },
  { key: 'why_it_matters', label: 'Why it matters' },
  { key: 'why_it_goes_here', label: 'Why here' },
  { key: 'why_this_order', label: 'Why this order' },
  { key: 'fatigue_logic', label: 'Fatigue logic' },
  { key: 'programming_guidance', label: 'Programming' },
  { key: 'common_misuse', label: 'Common misuse' },
  { key: 'scaling_guidance', label: 'Scaling' },
]

function matchesQuery(text: string | null | undefined, query: string) {
  if (!text || !query) return false
  return text.toLowerCase().includes(query)
}

function EducationDetail({ row }: { row: EducationContent }) {
  const fields = EDUCATION_FIELDS.filter((f) => row[f.key])
  if (fields.length === 0) return null
  return (
    <dl className="divide-y divide-gray-100 text-sm">
      {fields.map(({ key, label }) => (
        <div key={key} className="px-5 py-3 grid gap-1 sm:grid-cols-[9rem_1fr]">
          <dt className="text-gray-500">{label}</dt>
          <dd className="text-gray-700">{String(row[key])}</dd>
        </div>
      ))}
    </dl>
  )
}

function SessionModelMinutes({ row }: { row: EducationContent }) {
  const plan = Array.isArray(row.examples_json) ? row.examples_json : []
  if (plan.length === 0) return null
  return (
    <div className="px-5 pb-4 text-sm border-t border-gray-100">
      <p className="text-gray-500 mb-2 pt-3">Phase allocation</p>
      <ul className="space-y-1 text-gray-700">
        {plan.map((block: { phase?: string; minutes?: number; contains_tumbling?: boolean; add_on_focus?: string }, i: number) => (
          <li key={`${block.phase}-${i}`}>
            {phaseDisplayName(block.phase) || block.phase?.replace(/_/g, ' ')} — {block.minutes} min
            {block.contains_tumbling ? ' (tumbling block)' : ''}
            {block.add_on_focus ? ` (${block.add_on_focus.replace(/_/g, ' ')})` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProseBlock({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="text-sm text-gray-700 space-y-3">
      {title && <p className="text-gray-900 font-medium">{title}</p>}
      {children}
    </div>
  )
}

function TextList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-gray-600">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function Collapsible({
  id,
  title,
  subtitle,
  open,
  onToggle,
  children,
  variant = 'item',
}: {
  id: string
  title: string
  subtitle?: string
  open: boolean
  onToggle: (id: string) => void
  children: ReactNode
  variant?: 'hub' | 'item'
}) {
  return (
    <div
      className={
        variant === 'hub'
          ? 'border-b border-gray-100 last:border-b-0'
          : 'border border-gray-200 rounded-lg overflow-hidden bg-white'
      }
    >
      <button
        type="button"
        id={`${id}-trigger`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => onToggle(id)}
        className={`w-full flex items-center gap-3 text-left transition-colors ${
          variant === 'hub'
            ? 'px-5 py-4 hover:bg-gray-50/80'
            : 'px-4 py-3 hover:bg-gray-50'
        }`}
      >
        <span className="flex-1 min-w-0">
          <span className={`block truncate ${variant === 'hub' ? 'font-medium text-gray-900' : 'text-gray-800'}`}>
            {title}
          </span>
          {subtitle && <span className="block text-xs text-gray-500 mt-0.5 truncate">{subtitle}</span>}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-trigger`}>
          {children}
        </div>
      )}
    </div>
  )
}

function SectionCard({
  id,
  title,
  description,
  children,
  sectionRef,
}: {
  id: SectionId
  title: string
  description?: string
  children: ReactNode
  sectionRef: (el: HTMLElement | null) => void
}) {
  return (
    <section
      id={id}
      ref={sectionRef}
      className="bg-white border border-gray-200 rounded-xl overflow-hidden scroll-mt-24"
    >
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export default function FrameworkPanel() {
  const { taxonomy } = useTaxonomy()
  const [education, setEducation] = useState<EducationContent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSection, setActiveSection] = useState<SectionId>('overview')
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set(['hub:overview']))
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const query = searchQuery.trim().toLowerCase()

  useEffect(() => {
    coachFetch<EducationContent[]>('/api/coach/education')
      .then(setEducation)
      .catch(() => setEducation([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) {
          setActiveSection(visible[0].target.id as SectionId)
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5] },
    )
    for (const section of SECTIONS) {
      const el = sectionRefs.current[section.id]
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [loading])

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

  const eduForSessionPhase = (canonicalKey: CanonicalPhaseKey): EducationContent | undefined => {
    for (const key of phaseEducationLookupKeys(canonicalKey)) {
      const row = eduFor('session_phase', key)
      if (row) return { ...row, title: phaseDisplayName(canonicalKey) }
    }
    return undefined
  }

  const dedupeEducation = (rows: EducationContent[]) => {
    const map = new Map<string, EducationContent>()
    for (const row of rows) {
      const k = `${row.entity_type}:${row.entity_key}:${row.entity_id ?? 'null'}`
      const existing = map.get(k)
      if (!existing || Number(row.id) < Number(existing.id)) map.set(k, row)
    }
    return [...map.values()]
  }

  const rowSearchText = (row: EducationContent) =>
    [
      row.title,
      row.entity_key,
      row.short_summary,
      row.what_it_is,
      row.why_it_matters,
      row.why_it_goes_here,
      row.why_this_order,
      row.fatigue_logic,
      row.programming_guidance,
      row.common_misuse,
      row.scaling_guidance,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

  const rowMatches = (row: EducationContent) => !query || matchesQuery(rowSearchText(row), query)

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const scrollToSection = (id: SectionId) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(id)
  }

  const prepareSubroles = prepareAccessSubroleSequence(taxonomy)

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

  const overviewMatches =
    !query ||
    matchesQuery(TRAINING_PHILOSOPHY_TAXONOMY.intro, query) ||
    matchesQuery(TRAINING_PHILOSOPHY_TAXONOMY.transcends, query) ||
    TRAINING_PHILOSOPHY_TAXONOMY.layers.some(
      (l) => matchesQuery(l.name, query) || matchesQuery(l.role, query) || matchesQuery(l.connects, query),
    ) ||
    TRAINING_PHILOSOPHY_TAXONOMY.flow.some((f) => matchesQuery(f.label, query)) ||
    TRAINING_PHILOSOPHY_TAXONOMY.shortfalls.some((s) => matchesQuery(s, query))

  const rampMatches =
    !query ||
    matchesQuery(RAMP_PHILOSOPHY_INTRO, query) ||
    matchesQuery(RAMP_VARIANTS_NOTE, query) ||
    matchesQuery(VORTEX_ORDER_RATIONALE, query) ||
    ORIGINAL_RAMP_PHASES.some((p) => matchesQuery(p.name, query) || matchesQuery(p.goal, query)) ||
    VORTEX_SESSION_PROGRESSION.some((s) => matchesQuery(s.stage, query) || matchesQuery(s.goal, query)) ||
    prepareSubroles.some(
      (sr) =>
        matchesQuery(sr.name, query) ||
        matchesQuery(sr.description, query) ||
        matchesQuery(sr.why_it_exists, query),
    )

  const hubMatches = (texts: string[]) => !query || texts.some((t) => matchesQuery(t, query))

  const renderItemList = (
    rows: EducationContent[],
    prefix: string,
    itemExtra?: (row: EducationContent) => ReactNode,
  ) => {
    const visible = rows.filter(rowMatches)
    if (visible.length === 0) return query ? null : undefined
    return (
      <div className="px-5 pb-4 space-y-2">
        {visible.map((row) => {
          const key = `${prefix}:${row.entity_key}:${row.entity_id ?? 'null'}`
          const open = openKeys.has(key) || !!query
          return (
            <Collapsible
              key={key}
              id={key}
              title={row.title ?? row.entity_key}
              subtitle={row.short_summary ?? undefined}
              open={open}
              onToggle={toggle}
              variant="item"
            >
              <EducationDetail row={row} />
              {itemExtra?.(row)}
            </Collapsible>
          )
        })}
      </div>
    )
  }

  const sessionPhaseRows = [...CANONICAL_PHASE_ORDER]
    .map((k) => eduForSessionPhase(k as CanonicalPhaseKey))
    .filter(Boolean) as EducationContent[]

  const tenetRows = dedupeEducation(byType.get('tenet') ?? [])
  const methodologyRows = dedupeEducation(byType.get('methodology') ?? [])
  const physiologyRows = dedupeEducation(byType.get('physiology') ?? [])
  const orderSlotRows = dedupeEducation(byType.get('phase_order_slot') ?? [])
  const templateRows = sessionModelKeys
    .map((k) => eduFor('template', k))
    .filter(Boolean) as EducationContent[]
  const validationRows = dedupeEducation(byType.get('validation_rule') ?? [])

  const searchResultCount = useMemo(() => {
    if (!query) return null
    let count = 0
    if (overviewMatches) count += 1
    count += sessionPhaseRows.filter(rowMatches).length
    if (rampMatches) count += 1
    count += prepareSubroles.filter((sr) =>
      matchesQuery([sr.name, sr.description, sr.why_it_exists, sr.what_belongs_here].join(' '), query),
    ).length
    count += tenetRows.filter(rowMatches).length
    count += methodologyRows.filter(rowMatches).length
    count += physiologyRows.filter(rowMatches).length
    count += orderSlotRows.filter(rowMatches).length
    count += templateRows.filter(rowMatches).length
    count += validationRows.filter(rowMatches).length
    return count
  }, [
    query,
    overviewMatches,
    rampMatches,
    sessionPhaseRows,
    tenetRows,
    methodologyRows,
    physiologyRows,
    orderSlotRows,
    templateRows,
    validationRows,
    prepareSubroles,
  ])

  const sectionVisible = (hasContent: boolean) => !query || hasContent

  const groupedOrderSlots = SESSION_PHASE_ORDER.map((phaseKey) => ({
    phaseKey,
    label: orderedPhases.find((p) => p.key === phaseKey)?.name ?? phaseKey.replace(/_/g, ' '),
    rows: orderSlotRows.filter((r) => {
      const slot = taxonomy?.phaseOrderSlots?.find((s) => s.key === r.entity_key)
      return slot?.phase_key === phaseKey
    }),
  })).filter((g) => g.rows.some(rowMatches))

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-vortex-red" />
          Training Philosophy
        </h2>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          How phases, tenets, methodologies, physiology, order slots, session models, and validation rules work together in the Athleticism Accelerator.
        </p>
      </header>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search philosophy, phases, tenets, rules…"
          className="w-full border border-gray-300 rounded-xl pl-9 pr-10 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-vortex-red/20 focus:border-vortex-red"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {query && (
        <p className="text-sm text-gray-500">
          {searchResultCount === 0 ? 'No matches.' : `${searchResultCount} match${searchResultCount === 1 ? '' : 'es'}`}
        </p>
      )}

      <PhilosophyAssistant />

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading framework…
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[12rem_1fr] lg:gap-6 xl:grid-cols-[14rem_1fr]">
          <nav className="hidden lg:block sticky top-4 self-start">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 px-1">Sections</p>
            <ul className="space-y-0.5">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-vortex-red text-white font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {section.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-4 lg:space-y-5">
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={`shrink-0 text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    activeSection === section.id
                      ? 'bg-vortex-red text-white border-vortex-red'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>

            {sectionVisible(overviewMatches) && (
              <SectionCard
                id="overview"
                title={TRAINING_PHILOSOPHY_TAXONOMY.title}
                description="How the taxonomy layers connect and the canonical session flow."
                sectionRef={(el) => { sectionRefs.current.overview = el }}
              >
                <Collapsible
                  id="hub:overview"
                  title="Taxonomy overview"
                  open={openKeys.has('hub:overview') || !!query}
                  onToggle={toggle}
                  variant="hub"
                >
                  <div className="px-5 pb-5 space-y-5 text-sm text-gray-700 border-t border-gray-100">
                    <p>{TRAINING_PHILOSOPHY_TAXONOMY.intro}</p>

                    <ProseBlock title="How the layers connect">
                      <ul className="space-y-3">
                        {TRAINING_PHILOSOPHY_TAXONOMY.layers.map((layer) => (
                          <li key={layer.name}>
                            <p className="text-gray-900">{layer.name}</p>
                            <p className="text-gray-600">{layer.role}</p>
                            <p className="text-gray-500 mt-0.5">{layer.connects}</p>
                          </li>
                        ))}
                      </ul>
                    </ProseBlock>

                    <ProseBlock title="Canonical session flow">
                      <ol className="space-y-1.5">
                        {TRAINING_PHILOSOPHY_TAXONOMY.flow.map((step) => (
                          <li key={step.phaseKey} className="text-gray-700">
                            {step.step}. {step.label}
                          </li>
                        ))}
                      </ol>
                    </ProseBlock>

                    <ProseBlock title="Common shortfalls in traditional workouts">
                      <TextList items={TRAINING_PHILOSOPHY_TAXONOMY.shortfalls} />
                    </ProseBlock>

                    <p className="text-gray-900">{TRAINING_PHILOSOPHY_TAXONOMY.transcends}</p>
                  </div>
                </Collapsible>
              </SectionCard>
            )}

            {sectionVisible(
              hubMatches([SESSION_PHASES_HUB.intro, SESSION_PHASES_HUB.misuse, ...SESSION_PHASES_HUB.principles]) ||
                sessionPhaseRows.some(rowMatches),
            ) && (
              <SectionCard
                id="session-phases"
                title="Session phases"
                description="Macro structure of a training session from prepare through cooldown."
                sectionRef={(el) => { sectionRefs.current['session-phases'] = el }}
              >
                <Collapsible
                  id="hub:session_phases"
                  title={SESSION_PHASES_HUB.title}
                  open={openKeys.has('hub:session_phases') || !!query}
                  onToggle={toggle}
                  variant="hub"
                >
                  <div className="px-5 pb-5 space-y-4 text-sm text-gray-700 border-t border-gray-100">
                    <p>{SESSION_PHASES_HUB.intro}</p>
                    <ProseBlock title="Phase principles">
                      <TextList items={SESSION_PHASES_HUB.principles} />
                    </ProseBlock>
                    <p className="text-gray-600">{SESSION_PHASES_HUB.misuse}</p>
                  </div>
                </Collapsible>
                {renderItemList(sessionPhaseRows, 'session_phase')}
              </SectionCard>
            )}

            {sectionVisible(rampMatches) && (
              <SectionCard
                id="prepare-access"
                title="Prepare & access"
                description="RAMP framework and the Vortex subrole sequence before performance work."
                sectionRef={(el) => { sectionRefs.current['prepare-access'] = el }}
              >
                <Collapsible
                  id="hub:ramp"
                  title="RAMP framework & Vortex progression"
                  open={openKeys.has('hub:ramp') || !!query}
                  onToggle={toggle}
                  variant="hub"
                >
                  <div className="px-5 pb-5 space-y-5 text-sm text-gray-700 border-t border-gray-100">
                    <p>{RAMP_PHILOSOPHY_INTRO}</p>

                    <ProseBlock title="Original RAMP sequence (Jeffreys)">
                      <ul className="space-y-2">
                        {ORIGINAL_RAMP_PHASES.map((phase) => (
                          <li key={phase.name}>
                            <p className="text-gray-900">{phase.name}</p>
                            <p className="text-gray-600">{phase.goal}</p>
                            <p className="text-gray-500 text-xs mt-0.5">Examples: {phase.examples}</p>
                          </li>
                        ))}
                      </ul>
                    </ProseBlock>

                    <p>{RAMP_VARIANTS_NOTE}</p>
                    <p>{VORTEX_ORDER_RATIONALE}</p>
                    <p className="text-gray-500">{POTENTIATE_BRIDGE_AUDIENCE}</p>

                    <ProseBlock title="Vortex session progression">
                      <p className="text-gray-600 mb-2">
                        Prepare & access uses five subroles, then main session phases express performance intent.
                      </p>
                      <ol className="space-y-3">
                        {VORTEX_SESSION_PROGRESSION.map((step, i) => (
                          <li key={step.stage}>
                            <p className="text-gray-900">{i + 1}. {step.stage}</p>
                            <p className="text-gray-600">{step.goal}</p>
                            <p className="text-gray-500 text-xs mt-0.5">Examples: {step.examples}</p>
                          </li>
                        ))}
                      </ol>
                    </ProseBlock>
                  </div>
                </Collapsible>

                <div className="px-5 py-3 text-sm text-gray-500 border-t border-gray-100">
                  Subroles: Raise → Mobilize → Activate → Integrate → Potentiate Bridge → Performance Work (Skill, Output, Capacity, and beyond).
                </div>

                {prepareSubroles.length > 0 && (
                  <div className="px-5 pb-4 space-y-2 border-t border-gray-100 pt-3">
                    {prepareSubroles
                      .filter(
                        (sr) =>
                          !query ||
                          matchesQuery(
                            [sr.name, sr.description, sr.why_it_exists, sr.what_belongs_here, sr.what_to_avoid, sr.coach_guidance].join(' '),
                            query,
                          ),
                      )
                      .map((sr) => {
                        const key = `phase_subrole:${sr.key}`
                        const open = openKeys.has(key) || !!query
                        return (
                          <Collapsible
                            key={key}
                            id={key}
                            title={sr.name}
                            subtitle={sr.description ?? undefined}
                            open={open}
                            onToggle={toggle}
                            variant="item"
                          >
                            <dl className="divide-y divide-gray-100 text-sm">
                              {sr.why_it_exists && (
                                <div className="px-4 py-3 grid gap-1 sm:grid-cols-[9rem_1fr]">
                                  <dt className="text-gray-500">Why</dt>
                                  <dd className="text-gray-700">{sr.why_it_exists}</dd>
                                </div>
                              )}
                              {sr.what_belongs_here && (
                                <div className="px-4 py-3 grid gap-1 sm:grid-cols-[9rem_1fr]">
                                  <dt className="text-gray-500">Examples</dt>
                                  <dd className="text-gray-700">{sr.what_belongs_here}</dd>
                                </div>
                              )}
                              {sr.what_to_avoid && (
                                <div className="px-4 py-3 grid gap-1 sm:grid-cols-[9rem_1fr]">
                                  <dt className="text-gray-500">Avoid</dt>
                                  <dd className="text-gray-700">{sr.what_to_avoid}</dd>
                                </div>
                              )}
                              {sr.coach_guidance && (
                                <div className="px-4 py-3 grid gap-1 sm:grid-cols-[9rem_1fr]">
                                  <dt className="text-gray-500">Coaching</dt>
                                  <dd className="text-gray-700">{sr.coach_guidance}</dd>
                                </div>
                              )}
                            </dl>
                          </Collapsible>
                        )
                      })}
                  </div>
                )}
              </SectionCard>
            )}

            {sectionVisible(
              hubMatches([TENETS_HUB.intro, TENETS_HUB.misuse, ...TENETS_HUB.principles]) ||
                tenetRows.some(rowMatches),
            ) && (
              <SectionCard
                id="tenets"
                title="Athleticism Accelerator tenets"
                description="The performance qualities every session is designed to develop."
                sectionRef={(el) => { sectionRefs.current.tenets = el }}
              >
                <Collapsible
                  id="hub:tenets"
                  title={TENETS_HUB.title}
                  open={openKeys.has('hub:tenets') || !!query}
                  onToggle={toggle}
                  variant="hub"
                >
                  <div className="px-5 pb-5 space-y-4 text-sm text-gray-700 border-t border-gray-100">
                    <p>{TENETS_HUB.intro}</p>
                    <ProseBlock title="Tenet programming principles">
                      <TextList items={TENETS_HUB.principles} />
                    </ProseBlock>
                    <p className="text-gray-600">{TENETS_HUB.misuse}</p>
                  </div>
                </Collapsible>
                {renderItemList(tenetRows, 'tenet')}
              </SectionCard>
            )}

            {sectionVisible(
              hubMatches([METHODOLOGIES_HUB.intro, METHODOLOGIES_HUB.misuse]) ||
                methodologyRows.some(rowMatches),
            ) && (
              <SectionCard
                id="methodologies"
                title="Methodologies"
                description="Training methods and their primary phase homes."
                sectionRef={(el) => { sectionRefs.current.methodologies = el }}
              >
                <Collapsible
                  id="hub:methodologies"
                  title={METHODOLOGIES_HUB.title}
                  open={openKeys.has('hub:methodologies') || !!query}
                  onToggle={toggle}
                  variant="hub"
                >
                  <div className="px-5 pb-5 space-y-4 text-sm text-gray-700 border-t border-gray-100">
                    <p>{METHODOLOGIES_HUB.intro}</p>
                    <ProseBlock title="Primary phase homes">
                      <ul className="space-y-2">
                        {METHODOLOGIES_HUB.primaryHomes.map((row) => (
                          <li key={row.methodology}>
                            <p className="text-gray-900">{row.methodology}</p>
                            <p className="text-gray-600">
                              Primary: {row.primary}
                              {row.secondary ? ` · Secondary: ${row.secondary}` : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </ProseBlock>
                    <p className="text-gray-600">{METHODOLOGIES_HUB.misuse}</p>
                  </div>
                </Collapsible>
                {renderItemList(methodologyRows, 'methodology')}
              </SectionCard>
            )}

            {sectionVisible(
              hubMatches([PHYSIOLOGY_HUB.intro, PHYSIOLOGY_HUB.misuse]) ||
                physiologyRows.some(rowMatches),
            ) && (
              <SectionCard
                id="physiology"
                title="Physiological emphasis"
                description="Energy systems and physiological targets by emphasis."
                sectionRef={(el) => { sectionRefs.current.physiology = el }}
              >
                <Collapsible
                  id="hub:physiology"
                  title={PHYSIOLOGY_HUB.title}
                  open={openKeys.has('hub:physiology') || !!query}
                  onToggle={toggle}
                  variant="hub"
                >
                  <div className="px-5 pb-5 space-y-4 text-sm text-gray-700 border-t border-gray-100">
                    <p>{PHYSIOLOGY_HUB.intro}</p>
                    <ul className="space-y-2">
                      {PHYSIOLOGY_HUB.systems.map((sys) => (
                        <li key={sys.key}>
                          <p className="text-gray-900 capitalize">{sys.key.replace(/_/g, ' ')}</p>
                          <p className="text-gray-600">{sys.summary}</p>
                        </li>
                      ))}
                    </ul>
                    <p className="text-gray-600">{PHYSIOLOGY_HUB.misuse}</p>
                  </div>
                </Collapsible>
                {renderItemList(physiologyRows, 'physiology')}
              </SectionCard>
            )}

            {sectionVisible(
              hubMatches([ORDER_SLOTS_HUB.intro, ORDER_SLOTS_HUB.misuse, ...ORDER_SLOTS_HUB.concepts]) ||
                groupedOrderSlots.length > 0,
            ) && (
              <SectionCard
                id="order-slots"
                title="Order slots"
                description="Fine-grained placement within each session phase."
                sectionRef={(el) => { sectionRefs.current['order-slots'] = el }}
              >
                <Collapsible
                  id="hub:order_slots"
                  title={ORDER_SLOTS_HUB.title}
                  open={openKeys.has('hub:order_slots') || !!query}
                  onToggle={toggle}
                  variant="hub"
                >
                  <div className="px-5 pb-5 space-y-4 text-sm text-gray-700 border-t border-gray-100">
                    <p>{ORDER_SLOTS_HUB.intro}</p>
                    <TextList items={ORDER_SLOTS_HUB.concepts} />
                    <ProseBlock title="Phase groupings">
                      <ul className="space-y-3">
                        {ORDER_SLOTS_HUB.phaseGroups.map((group) => (
                          <li key={group.phase}>
                            <p className="text-gray-900">{group.phase}</p>
                            <p className="text-gray-600">Subroles: {group.subroles}</p>
                            <p className="text-gray-500 text-xs mt-0.5">Examples: {group.examples}</p>
                          </li>
                        ))}
                      </ul>
                    </ProseBlock>
                    <p className="text-gray-600">{ORDER_SLOTS_HUB.misuse}</p>
                  </div>
                </Collapsible>
                {groupedOrderSlots.length > 0 && (
                  <div className="px-5 pb-4 space-y-4 border-t border-gray-100 pt-3">
                    {groupedOrderSlots.map((group) => (
                      <div key={group.phaseKey}>
                        <p className="text-xs font-medium text-gray-400 mb-2">{group.label}</p>
                        <div className="space-y-2">
                          {group.rows.filter(rowMatches).map((row) => {
                            const key = `phase_order_slot:${row.entity_key}:${row.entity_id ?? 'null'}`
                            const open = openKeys.has(key) || !!query
                            return (
                              <Collapsible
                                key={key}
                                id={key}
                                title={row.title ?? row.entity_key}
                                subtitle={row.short_summary ?? undefined}
                                open={open}
                                onToggle={toggle}
                                variant="item"
                              >
                                <EducationDetail row={row} />
                              </Collapsible>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            )}

            {sectionVisible(
              hubMatches([SESSION_MODELS_HUB.intro, SESSION_MODELS_HUB.misuse]) ||
                templateRows.some(rowMatches),
            ) && (
              <SectionCard
                id="session-models"
                title="Session models (60 / 90 / 120)"
                description="Standard session lengths and add-on placement rules."
                sectionRef={(el) => { sectionRefs.current['session-models'] = el }}
              >
                <Collapsible
                  id="hub:session_models"
                  title={SESSION_MODELS_HUB.title}
                  open={openKeys.has('hub:session_models') || !!query}
                  onToggle={toggle}
                  variant="hub"
                >
                  <div className="px-5 pb-5 space-y-4 text-sm text-gray-700 border-t border-gray-100">
                    <p>{SESSION_MODELS_HUB.intro}</p>
                    <ul className="space-y-2">
                      {SESSION_MODELS_HUB.models.map((model) => (
                        <li key={model.key}>
                          <p className="text-gray-900">{model.name}</p>
                          <p className="text-gray-600">{model.summary}</p>
                        </li>
                      ))}
                    </ul>
                    <ProseBlock title="Add-on placement rules">
                      <TextList items={SESSION_MODELS_HUB.placementRules} />
                    </ProseBlock>
                    <p className="text-gray-600">{SESSION_MODELS_HUB.misuse}</p>
                  </div>
                </Collapsible>
                {renderItemList(templateRows, 'template', (row) => <SessionModelMinutes row={row} />)}
              </SectionCard>
            )}

            {sectionVisible(
              hubMatches([VALIDATION_RULES_HUB.intro, VALIDATION_RULES_HUB.misuse, ...VALIDATION_RULES_HUB.principles]) ||
                validationRows.some(rowMatches),
            ) && (
              <SectionCard
                id="validation-rules"
                title="Validation rules"
                description="Automated checks that keep sessions aligned with philosophy."
                sectionRef={(el) => { sectionRefs.current['validation-rules'] = el }}
              >
                <Collapsible
                  id="hub:validation_rules"
                  title={VALIDATION_RULES_HUB.title}
                  open={openKeys.has('hub:validation_rules') || !!query}
                  onToggle={toggle}
                  variant="hub"
                >
                  <div className="px-5 pb-5 space-y-4 text-sm text-gray-700 border-t border-gray-100">
                    <p>{VALIDATION_RULES_HUB.intro}</p>
                    <ProseBlock title="Rule categories">
                      <ul className="space-y-2">
                        {VALIDATION_RULES_HUB.categories.map((cat) => (
                          <li key={cat.name}>
                            <p className="text-gray-900">{cat.name}</p>
                            <p className="text-gray-500 text-xs mt-0.5">{cat.examples}</p>
                          </li>
                        ))}
                      </ul>
                    </ProseBlock>
                    <TextList items={VALIDATION_RULES_HUB.principles} />
                    <p className="text-gray-600">{VALIDATION_RULES_HUB.misuse}</p>
                  </div>
                </Collapsible>
                {renderItemList(validationRows, 'validation_rule')}
              </SectionCard>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
