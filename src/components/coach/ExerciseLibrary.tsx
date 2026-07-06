import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search, Clock } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useTaxonomy } from './useTaxonomy'
import type { Exercise } from '../../coach/types'
import { participantStructureLabel } from '../../coach/types'
import type { TaxonomyItem } from '../../coach/taxonomy'
import {
  capacitySubroleSequence,
  orderSlotsForSubrole,
  outputSubroleSequence,
  prepareAccessSubroleSequence,
  SESSION_PHASE_ORDER,
  skillMovementSubroleSequence,
} from '../../coach/taxonomy'
import { PREPARE_SESSION_NEED_OPTIONS } from '../../coach/prepareAccessFilters'
import { exerciseDosageLabel, exerciseFacetLabels, exerciseFitnessGoal, exerciseIdentityLine, exerciseRequirementChips, exerciseSessionPhaseHint, exerciseTenetLabels, phaseSubroleLabel, primaryPhaseProfile, whyPreview } from '../../coach/exerciseCard'
import { exportExercises, type LibraryExportFormat } from '../../coach/libraryExport'
import ExerciseDetailModal from './ExerciseDetailModal'
import ExerciseEditor from './ExerciseEditor'
import LibraryCardMenu from './LibraryCardMenu'
import LibraryCard from './LibraryCard'
import LibraryExportControls from './LibraryExportControls'
import LibraryResultCount from './LibraryResultCount'

interface FilterState {
  q: string
  sport: number | ''
  tenet: number | ''
  methodology: number | ''
  physiology: number | ''
  phase: number | ''
  subrole: string
  orderSlot: string
  bodyRegion: number | ''
  sessionNeed: string
  maxFatigueCost: number | ''
  freshness: boolean
  canBeDaily: boolean
  paired: boolean
  minImpact: number | ''
}

const emptyFilters: FilterState = { q: '', sport: '', tenet: '', methodology: '', physiology: '', phase: '', subrole: '', orderSlot: '', bodyRegion: '', sessionNeed: '', maxFatigueCost: '', freshness: false, canBeDaily: false, paired: false, minImpact: '' }

export default function ExerciseLibrary() {
  const { taxonomy } = useTaxonomy()
  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [viewing, setViewing] = useState<Exercise | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.q) params.set('q', filters.q)
      if (filters.sport) params.set('sport', String(filters.sport))
      if (filters.tenet) params.set('tenet', String(filters.tenet))
      if (filters.methodology) params.set('method', String(filters.methodology))
      if (filters.physiology) params.set('physio', String(filters.physiology))
      if (filters.phase) params.set('phase', String(filters.phase))
      if (filters.subrole) params.set('subrole', filters.subrole)
      if (filters.orderSlot) params.set('order_slot', filters.orderSlot)
      if (filters.bodyRegion) params.set('body_region', String(filters.bodyRegion))
      if (filters.sessionNeed) params.set('session_need', filters.sessionNeed)
      if (filters.maxFatigueCost !== '') params.set('max_fatigue_cost', String(filters.maxFatigueCost))
      if (filters.freshness) params.set('freshness', 'true')
      if (filters.canBeDaily) params.set('can_be_daily', 'true')
      if (filters.paired) params.set('paired', 'true')
      if (filters.minImpact !== '') params.set('min_impact', String(filters.minImpact))
      const data = await coachFetch<Exercise[]>(`/api/coach/exercises?${params.toString()}`)
      setExercises(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void load()
  }, [load])

  const facetName = useMemo(() => {
    const map = new Map<number | string, string>()
    for (const [facetType, items] of [
      ['tenet', taxonomy?.tenets],
      ['methodology', taxonomy?.methodologies],
      ['physiology', taxonomy?.physiology],
      ['pattern', taxonomy?.patterns],
      ['equipment', taxonomy?.equipment],
      ['body_region', taxonomy?.bodyRegions],
    ] as const) {
      for (const item of items ?? []) {
        if (item.id != null) {
          map.set(Number(item.id), item.name)
          map.set(`${facetType}:${item.id}`, item.name)
        }
      }
    }
    return map
  }, [taxonomy])

  const tenetName = facetName

  const handleExport = (format: LibraryExportFormat) => {
    if (exercises.length === 0) return
    exportExercises(exercises, format, facetName, 'exercise-library')
  }

  const handleDelete = async (ex: Exercise) => {
    if (!window.confirm(`Delete "${ex.name}"? This cannot be undone.`)) return
    try {
      await coachFetch(`/api/coach/exercises/${ex.id}`, { method: 'DELETE' })
      if (viewing?.id === ex.id) setViewing(null)
      if (editing?.id === ex.id) setEditing(null)
      void load()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete exercise')
    }
  }

  const selectedPhaseKey = filters.phase
    ? taxonomy?.sessionPhases?.find((p) => p.id === filters.phase)?.key ?? null
    : null
  const isPrepareFiltered = selectedPhaseKey === 'prepare_and_access'
  const subroleOptions = selectedPhaseKey === 'output'
    ? outputSubroleSequence(taxonomy)
    : selectedPhaseKey === 'prepare_and_access'
      ? prepareAccessSubroleSequence(taxonomy)
      : selectedPhaseKey === 'movement_intelligence'
        ? skillMovementSubroleSequence(taxonomy)
        : selectedPhaseKey === 'capacity'
          ? capacitySubroleSequence(taxonomy)
          : []
  const slotOptions = useMemo(() => {
    const all = taxonomy?.phaseOrderSlots ?? []
    if (filters.subrole && selectedPhaseKey) {
      return orderSlotsForSubrole(taxonomy, selectedPhaseKey, filters.subrole)
    }
    if (selectedPhaseKey) {
      return all.filter((s) => s.phase_key === selectedPhaseKey).sort((a, b) => a.order_index - b.order_index)
    }
    return [...all].sort((a, b) => {
      const phaseOrder = (key: string) => {
        const idx = SESSION_PHASE_ORDER.indexOf(key as (typeof SESSION_PHASE_ORDER)[number])
        return idx === -1 ? 999 : idx
      }
      const pa = phaseOrder(a.phase_key ?? '')
      const pb = phaseOrder(b.phase_key ?? '')
      if (pa !== pb) return pa - pb
      return a.order_index - b.order_index
    })
  }, [taxonomy, filters.subrole, selectedPhaseKey])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Exercises</h2>
          <p className="text-sm text-gray-500">Movements programmed toward fitness outcomes — tenets, physiology, and session phase — for the Needs Engine and workout builder.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <LibraryExportControls
            disabled={loading || exercises.length === 0}
            filenameStem="exercise-library"
            onExport={(format) => handleExport(format as LibraryExportFormat)}
          />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center justify-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700"
          >
            <Plus className="w-4 h-4" /> New Exercise
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        <div className="md:col-span-2 lg:col-span-1">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search exercises..."
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
            />
          </div>
        </div>
        <FacetSelect label="Sport" items={taxonomy?.sports} value={filters.sport} onChange={(v) => setFilters((f) => ({ ...f, sport: v }))} />
        <FacetSelect label="Tenet" items={taxonomy?.tenets as TaxonomyItem[] | undefined} value={filters.tenet} onChange={(v) => setFilters((f) => ({ ...f, tenet: v }))} />
        <FacetSelect label="Methodology" items={taxonomy?.methodologies as TaxonomyItem[] | undefined} value={filters.methodology} onChange={(v) => setFilters((f) => ({ ...f, methodology: v }))} />
        <FacetSelect label="Physiology" items={taxonomy?.physiology as TaxonomyItem[] | undefined} value={filters.physiology} onChange={(v) => setFilters((f) => ({ ...f, physiology: v }))} />
        <FacetSelect label="Session Phase" items={taxonomy?.sessionPhases as TaxonomyItem[] | undefined} value={filters.phase} onChange={(v) => setFilters((f) => ({ ...f, phase: v, subrole: '', orderSlot: '' }))} />
        {selectedPhaseKey && subroleOptions.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Phase subrole</label>
            <select value={filters.subrole} onChange={(e) => setFilters((f) => ({ ...f, subrole: e.target.value, orderSlot: '' }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">All subroles</option>
              {subroleOptions.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </div>
        )}
        {isPrepareFiltered && (
          <FacetSelect label="Body region" items={taxonomy?.bodyRegions as TaxonomyItem[] | undefined} value={filters.bodyRegion} onChange={(v) => setFilters((f) => ({ ...f, bodyRegion: v }))} />
        )}
        {isPrepareFiltered && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Session need</label>
            <select value={filters.sessionNeed} onChange={(e) => setFilters((f) => ({ ...f, sessionNeed: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Any</option>
              {PREPARE_SESSION_NEED_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
        )}
        {isPrepareFiltered && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Max fatigue cost</label>
            <select value={filters.maxFatigueCost} onChange={(e) => setFilters((f) => ({ ...f, maxFatigueCost: e.target.value ? Number(e.target.value) : '' }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} or lower</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Order slot</label>
          <select value={filters.orderSlot} onChange={(e) => setFilters((f) => ({ ...f, orderSlot: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All</option>
            {!selectedPhaseKey ? (
              SESSION_PHASE_ORDER.map((phaseKey) => {
                const phase = taxonomy?.sessionPhases?.find((p) => p.key === phaseKey)
                const slots = slotOptions.filter((s) => s.phase_key === phaseKey)
                if (slots.length === 0) return null
                return (
                  <optgroup key={phaseKey} label={phase?.name ?? phaseKey}>
                    {slots.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                  </optgroup>
                )
              })
            ) : filters.subrole || subroleOptions.length === 0 ? (
              slotOptions.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)
            ) : (
              subroleOptions.map((sr) => {
                const slots = orderSlotsForSubrole(taxonomy, selectedPhaseKey, sr.key)
                if (slots.length === 0) return null
                return (
                  <optgroup key={sr.key} label={sr.name}>
                    {slots.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                  </optgroup>
                )
              })
            )}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Impact (min)</label>
          <select value={filters.minImpact} onChange={(e) => setFilters((f) => ({ ...f, minImpact: e.target.value ? Number(e.target.value) : '' }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm self-end pb-2">
          <input type="checkbox" checked={filters.freshness} onChange={(e) => setFilters((f) => ({ ...f, freshness: e.target.checked }))} />
          Freshness required
        </label>
        <label className="flex items-center gap-2 text-sm self-end pb-2">
          <input type="checkbox" checked={filters.canBeDaily} onChange={(e) => setFilters((f) => ({ ...f, canBeDaily: e.target.checked }))} />
          Can be daily
        </label>
        <label className="flex items-center gap-2 text-sm self-end pb-2">
          <input type="checkbox" checked={filters.paired} onChange={(e) => setFilters((f) => ({ ...f, paired: e.target.checked }))} />
          Paired exercises
        </label>
        <button type="button" onClick={() => setFilters(emptyFilters)} className="self-end text-sm text-gray-500 hover:text-gray-800 underline">
          Clear filters
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <LibraryResultCount count={exercises.length} loading={loading} />

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading library...</div>
      ) : (
        <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
          {exercises.map((ex) => {
            const tenets = exerciseTenetLabels(ex, tenetName)
            const methodologies = exerciseFacetLabels(ex, 'methodology', facetName, 2)
            const physiology = exerciseFacetLabels(ex, 'physiology', facetName, 1)
            const phaseHint = exerciseSessionPhaseHint(ex)
            const identityLine = exerciseIdentityLine(ex, taxonomy ?? undefined)
            const reqChips = exerciseRequirementChips(ex)
            const subrole = phaseSubroleLabel(ex.phase_subrole)
            const programmingNote = whyPreview(ex.why)
            return (
            <LibraryCard
              key={ex.id}
              onClick={() => setViewing(ex)}
              menu={
                <LibraryCardMenu
                  itemLabel={ex.name}
                  onEdit={() => setEditing(ex)}
                  onDelete={() => { void handleDelete(ex) }}
                />
              }
            >
              <h3 className="pr-8 font-bold leading-snug text-gray-900">{ex.name}</h3>
              {ex.sport_name && <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">{ex.sport_name}</span>}
              {identityLine && <p className="text-[11px] text-gray-500 mt-1">{identityLine}</p>}
              {subrole && <span className="inline-block mt-1 mr-1 text-[11px] bg-violet-50 text-violet-800 rounded px-2 py-0.5">{subrole}</span>}
              <p className="text-sm text-gray-800 mt-2 line-clamp-3 font-medium leading-snug">{exerciseFitnessGoal(ex, tenetName)}</p>
              {tenets.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tenets.map((label) => (
                    <span key={label} className="text-[11px] bg-red-50 text-vortex-red rounded px-2 py-0.5">{label}</span>
                  ))}
                </div>
              )}
              {phaseHint && (
                <span className="inline-block mt-2 text-[11px] bg-blue-50 text-blue-800 rounded px-2 py-0.5">{phaseHint}</span>
              )}
              {reqChips.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {reqChips.map((chip) => (
                    <span key={chip} className="text-[11px] bg-slate-50 text-slate-700 rounded px-2 py-0.5">{chip}</span>
                  ))}
                </div>
              )}
              {primaryPhaseProfile(ex)?.freshnessRequired && (
                <span className="inline-block mt-2 ml-1 text-[11px] bg-amber-50 text-amber-800 rounded px-2 py-0.5">Freshness</span>
              )}
              {(primaryPhaseProfile(ex)?.fatigueCost ?? 0) >= 4 && (
                <span className="inline-block mt-2 ml-1 text-[11px] bg-orange-50 text-orange-800 rounded px-2 py-0.5">High fatigue</span>
              )}
              {(primaryPhaseProfile(ex)?.impactLevel ?? 0) >= 3 && (
                <span className="inline-block mt-2 ml-1 text-[11px] bg-purple-50 text-purple-800 rounded px-2 py-0.5">High impact</span>
              )}
              {ex.regimen_rule?.can_be_daily && (
                <span className="inline-block mt-2 ml-1 text-[11px] bg-green-50 text-green-800 rounded px-2 py-0.5">Daily OK</span>
              )}
              {ex.participant_structure && ex.participant_structure !== 'individual' && (
                <span className="inline-block mt-2 ml-1 text-[11px] bg-sky-50 text-sky-800 rounded px-2 py-0.5">{participantStructureLabel(ex.participant_structure)}</span>
              )}
              {programmingNote && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{programmingNote}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-3">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {exerciseDosageLabel(ex)}</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {methodologies.map((label) => (
                  <span key={`m-${label}`} className="text-[11px] bg-gray-100 text-gray-700 rounded px-2 py-0.5">{label}</span>
                ))}
                {physiology.map((label) => (
                  <span key={`p-${label}`} className="text-[11px] bg-indigo-50 text-indigo-800 rounded px-2 py-0.5">{label}</span>
                ))}
              </div>
            </LibraryCard>
            )
          })}
          {exercises.length === 0 && <div className="text-sm text-gray-500">No exercises match these filters.</div>}
        </div>
      )}

      {viewing && (
        <ExerciseDetailModal
          exerciseId={viewing.id}
          preview={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing)
            setViewing(null)
          }}
        />
      )}

      {(creating || editing) && (
        <ExerciseEditor
          exercise={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

function FacetSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items?: TaxonomyItem[]
  value: number | ''
  onChange: (value: number | '') => void
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      >
        <option value="">All</option>
        {(items ?? []).map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  )
}

