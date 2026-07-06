import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { coachFetch } from '../../coach/api'
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

  const identity = card?.identity as Record<string, string> | undefined
  const classification = card?.classification as Record<string, unknown> | undefined
  const education = card?.education as Record<string, unknown> | undefined

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{identity?.name ?? 'Programming Method'}</h3>
            <p className="text-sm text-indigo-700">{identity?.category}</p>
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
              <p className="text-sm text-gray-800">{identity?.coachSummary ?? identity?.definition}</p>
              <Section title="What it is" body={String(education?.whatItIs ?? '')} />
              <Section title="Why it matters" body={String(education?.whyItMatters ?? '')} />
              <Section title="When to use" body={String(education?.whenToUse ?? '')} />
              <Section title="When not to use" body={String(education?.whenNotToUse ?? '')} />
              <ListSection title="Common misuse" items={(education?.commonMisuse as string[]) ?? []} />
            </>
          )}
          {card && tab === 'phase' && (
            <>
              <p className="text-sm">Best phase: <strong>{phaseDisplayName(String(classification?.bestSessionPhase ?? ''))}</strong></p>
              <ListSection title="Compatible phases" items={((classification?.compatibleSessionPhases as string[]) ?? []).map(phaseDisplayName)} />
              <ListSection title="High-risk phases" items={((classification?.incompatibleOrHighRiskPhases as string[]) ?? []).map(phaseDisplayName)} />
            </>
          )}
          {card && tab === 'workrest' && (
            <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto">{JSON.stringify(card.workRestStructure, null, 2)}</pre>
          )}
          {card && tab === 'compatibility' && (
            <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto">{JSON.stringify(card.exerciseCompatibility, null, 2)}</pre>
          )}
          {card && tab === 'quality' && (
            <>
              <ListSection title="Quality standards" items={(card.qualityStandards ?? []).map((q) => q.standard)} />
              <ListSection title="Stop rules" items={(card.stopRules ?? []).map((s) => s.stopRule)} />
              <ListSection title="Validator rules" items={(card.validatorRules ?? []).map((v) => v.message)} />
            </>
          )}
          {card && tab === 'examples' && (
            <div className="space-y-3">
              {(card.exampleImplementations ?? []).map((ex, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3">
                  <div className="font-semibold text-sm">{String((ex as Record<string, unknown>).label ?? `Example ${i + 1}`)}</div>
                  <p className="text-xs text-gray-500 mt-1">{String((ex as Record<string, unknown>).disclaimer ?? '')}</p>
                  <pre className="text-xs mt-2 bg-gray-50 rounded p-2 overflow-x-auto">{JSON.stringify((ex as Record<string, unknown>).exampleJson, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
          {card && tab === 'builder' && (
            <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto">{JSON.stringify(card.workoutBuilderRules, null, 2)}</pre>
          )}
        </div>
      </div>
    </div>
  )
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
