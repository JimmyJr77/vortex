import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import {
  formatEnergySystems,
  formatExampleImplementation,
  formatExerciseCompatibility,
  formatFatigueProfile,
  formatSeverity,
  formatWorkRestStructure,
  formatWorkoutBuilderRules,
  type DisplaySection,
} from '../../coach/programmingCardDisplay'
import type { ProgrammingCard } from '../../coach/types'
import { phaseDisplayName } from '../../coach/sessionPhaseKeys'

type TabId = 'overview' | 'phase' | 'workrest' | 'compatibility' | 'quality' | 'examples' | 'builder'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'phase', label: 'Phase Fit' },
  { id: 'workrest', label: 'Work / Rest' },
  { id: 'compatibility', label: 'Exercise Compatibility' },
  { id: 'quality', label: 'Quality & Stop Rules' },
  { id: 'examples', label: 'Examples' },
  { id: 'builder', label: 'Workout Builder Rules' },
]

export default function ProgrammingDetailModal({
  methodId,
  onClose,
}: {
  methodId: number
  onClose: () => void
}) {
  const [card, setCard] = useState<ProgrammingCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('overview')

  useEffect(() => {
    setLoading(true)
    coachFetch<ProgrammingCard>(`/api/coach/programming-methods/${methodId}/card`)
      .then(setCard)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [methodId])

  const identity = card?.identity as Record<string, unknown> | undefined
  const classification = card?.classification as Record<string, unknown> | undefined
  const education = card?.education as Record<string, unknown> | undefined

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{String(identity?.name ?? 'Programming Method')}</h3>
            <p className="text-sm text-indigo-700">{String(identity?.category ?? '')}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-wrap gap-1 px-5 pt-3 border-b border-gray-100">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === t.id ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>}
          {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}
          {card && tab === 'overview' && (
            <>
              <p className="text-sm text-gray-800">{String(identity?.coachSummary ?? identity?.definition ?? '')}</p>
              {identity?.athleteSummary && (
                <Section title="Athlete summary" body={String(identity.athleteSummary)} />
              )}
              {identity?.primaryDevelopmentGoal && (
                <Section title="Primary goal" body={String(identity.primaryDevelopmentGoal)} />
              )}
              <ListSection
                title="Secondary goals"
                items={asStringArray(identity?.secondaryDevelopmentGoals)}
              />
              <Section title="What it is" body={String(education?.whatItIs ?? '')} />
              <Section title="Why it matters" body={String(education?.whyItMatters ?? '')} />
              <Section title="When to use" body={String(education?.whenToUse ?? '')} />
              <Section title="When not to use" body={String(education?.whenNotToUse ?? '')} />
              <ListSection title="Common misuse" items={(education?.commonMisuse as string[]) ?? []} />
            </>
          )}
          {card && tab === 'phase' && (
            <>
              <p className="text-sm">
                Best phase:{' '}
                <strong>{phaseDisplayName(String(classification?.bestSessionPhase ?? ''))}</strong>
              </p>
              {classification?.programmingType && (
                <p className="text-sm text-gray-700">
                  Type: <span className="font-medium">{humanizeKey(String(classification.programmingType))}</span>
                </p>
              )}
              <ListSection
                title="Compatible phases"
                items={((classification?.compatibleSessionPhases as string[]) ?? []).map(phaseDisplayName)}
              />
              <ListSection
                title="High-risk phases"
                items={((classification?.incompatibleOrHighRiskPhases as string[]) ?? []).map(phaseDisplayName)}
              />
              <ListSection
                title="Energy system focus"
                items={formatEnergySystems(classification?.energySystemFocus)}
              />
              {classification?.supervisionLevel && (
                <p className="text-sm text-gray-700">
                  Supervision: <span className="font-medium">{String(classification.supervisionLevel)}</span>
                </p>
              )}
              <FieldGrid
                title="Fatigue profile"
                fields={formatFatigueProfile(classification?.fatigueProfile as Record<string, unknown>)}
              />
            </>
          )}
          {card && tab === 'workrest' && (
            <StructuredSections
              sections={formatWorkRestStructure(card.workRestStructure)}
              emptyText="No work / rest structure defined yet."
            />
          )}
          {card && tab === 'compatibility' && (
            <StructuredSections
              sections={formatExerciseCompatibility(card.exerciseCompatibility)}
              emptyText="No exercise compatibility rules defined yet."
            />
          )}
          {card && tab === 'quality' && (
            <>
              <RuleList
                title="Quality standards"
                items={(card.qualityStandards ?? []).map((q) => ({
                  text: q.standard,
                  severity: q.severity,
                }))}
              />
              <RuleList
                title="Stop rules"
                items={(card.stopRules ?? []).map((s) => ({
                  text: s.stopRule,
                  severity: s.severity,
                }))}
              />
              <RuleList
                title="Validator rules"
                items={(card.validatorRules ?? []).map((v) => ({
                  text: v.message,
                  severity: v.severity,
                  detail: v.ruleKey ? humanizeKey(v.ruleKey) : undefined,
                }))}
              />
            </>
          )}
          {card && tab === 'examples' && (
            <div className="space-y-4">
              {(card.exampleImplementations ?? []).length === 0 && (
                <p className="text-sm text-gray-500">No examples added yet.</p>
              )}
              {(card.exampleImplementations ?? []).map((ex, i) => {
                const record = ex as Record<string, unknown>
                const label = String(record.label ?? `Example ${i + 1}`)
                const audience = record.audience ? String(record.audience) : null
                const disclaimer = record.disclaimer ? String(record.disclaimer) : null
                const coachingNotes = record.coachingNotes ? String(record.coachingNotes) : null
                const sections = formatExampleImplementation(record)

                return (
                  <div key={`${label}-${i}`} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{label}</div>
                      {audience && (
                        <div className="text-xs text-indigo-700 mt-0.5 capitalize">Audience: {audience}</div>
                      )}
                      {disclaimer && <p className="text-xs text-amber-700 mt-1">{disclaimer}</p>}
                      {coachingNotes && <p className="text-xs text-gray-500 mt-1">{coachingNotes}</p>}
                    </div>
                    <StructuredSections sections={sections} emptyText="No example details available." />
                  </div>
                )
              })}
            </div>
          )}
          {card && tab === 'builder' && (
            <StructuredSections
              sections={formatWorkoutBuilderRules(card.workoutBuilderRules)}
              emptyText="No workout builder rules defined yet."
            />
          )}
        </div>
      </div>
    </div>
  )
}

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return []
  return val.map((v) => String(v).trim()).filter(Boolean)
}

function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function Section({ title, body }: { title: string; body: string }) {
  if (!body?.trim()) return null
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{title}</div>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{body}</p>
    </div>
  )
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{title}</div>
      <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  )
}

function FieldGrid({ title, fields }: { title: string; fields: Array<{ label: string; value: string }> }) {
  if (!fields.length) return null
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</div>
      <dl className="grid gap-2 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{field.label}</dt>
            <dd className="text-sm text-gray-800 mt-0.5">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function StructuredSections({
  sections,
  emptyText,
}: {
  sections: DisplaySection[]
  emptyText: string
}) {
  if (!sections.length) {
    return <p className="text-sm text-gray-500">{emptyText}</p>
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.title}>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{section.title}</div>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{paragraph}</p>
          ))}
          {section.fields && section.fields.length > 0 && (
            <dl className="grid gap-2 sm:grid-cols-2">
              {section.fields.map((field) => (
                <div key={field.label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{field.label}</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {section.bullets && section.bullets.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1 mt-1">
              {section.bullets.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function RuleList({
  title,
  items,
}: {
  title: string
  items: Array<{ text: string; severity?: string; detail?: string }>
}) {
  if (!items.length) return null
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.text} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-800">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="leading-relaxed">{item.text}</span>
              {item.severity && (
                <span className="shrink-0 rounded bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 border border-gray-200">
                  {formatSeverity(item.severity)}
                </span>
              )}
            </div>
            {item.detail && <div className="text-xs text-gray-500 mt-1">{item.detail}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}
