import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import { coachFetch, type CoachLibraryPage } from '../../coach/api'
import { exerciseToClientView } from '../../coach/clientExerciseCard'
import { useTaxonomy } from './useTaxonomy'
import type { Exercise } from '../../coach/types'
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
import { exportExercises, type LibraryExportFormat } from '../../coach/libraryExport'
import ExerciseDetailModal from './ExerciseDetailModal'
import ClientExerciseDetailModal from './ClientExerciseDetailModal'
import ExerciseEditor from './ExerciseEditor'
import LibraryCardMenu from './LibraryCardMenu'
import ExerciseLibraryCard from './ExerciseLibraryCard'
import ClientExerciseLibraryCard from './ClientExerciseLibraryCard'
import LibraryCard from './LibraryCard'
import LibraryExportControls from './LibraryExportControls'
import LibraryResultCount from './LibraryResultCount'
import LibraryPagination from './LibraryPagination'

const PAGE_SIZE = 48

interface FilterState {
  q: string
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
  maxImpact: number | ''
  minOverall: number | ''
  maxOverall: number | ''
  minTechnical: number | ''
  minLoad: number | ''
  programmingKind: '' | 'exercise' | 'skill_drill'
  sort: '' | 'impact_desc' | 'impact_asc' | 'name_desc' | 'difficulty_desc' | 'difficulty_asc'
}

const IMPACT_LEVEL_OPTIONS = [0, 1, 2, 3, 4, 5] as const
const DIFFICULTY_PRESETS = [
  { key: 'youth', label: 'Youth-safe (≤5)', minOverall: '' as const, maxOverall: 5 as const },
  { key: 'moderate', label: 'Moderate (4–6)', minOverall: 4 as const, maxOverall: 6 as const },
  { key: 'challenging', label: 'Challenging (≥7)', minOverall: 7 as const, maxOverall: '' as const },
  { key: 'elite', label: 'Elite (≥9)', minOverall: 9 as const, maxOverall: '' as const },
] as const

const emptyFilters: FilterState = { q: '', tenet: '', methodology: '', physiology: '', phase: '', subrole: '', orderSlot: '', bodyRegion: '', sessionNeed: '', maxFatigueCost: '', freshness: false, canBeDaily: false, paired: false, minImpact: '', maxImpact: '', minOverall: '', maxOverall: '', minTechnical: '', minLoad: '', programmingKind: '', sort: '' }

function buildExerciseQueryParams(filters: FilterState, pagination?: { limit: number; offset: number }) {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
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
  if (filters.maxImpact !== '') params.set('max_impact', String(filters.maxImpact))
  if (filters.minOverall !== '') params.set('min_overall', String(filters.minOverall))
  if (filters.maxOverall !== '') params.set('max_overall', String(filters.maxOverall))
  if (filters.minTechnical !== '') params.set('min_technical', String(filters.minTechnical))
  if (filters.minLoad !== '') params.set('min_load', String(filters.minLoad))
  if (filters.programmingKind) params.set('programming_kind', filters.programmingKind)
  if (filters.sort) params.set('sort', filters.sort)
  if (pagination) {
    params.set('limit', String(pagination.limit))
    params.set('offset', String(pagination.offset))
  }
  return params
}

type ExerciseLibraryViewMode = 'coach' | 'client'
const VIEW_MODE_STORAGE_KEY = 'vortex-exercise-library-view-mode'

function readStoredViewMode(): ExerciseLibraryViewMode {
  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY)
    return stored === 'client' ? 'client' : 'coach'
  } catch {
    return 'coach'
  }
}

export default function ExerciseLibrary() {
  const { taxonomy } = useTaxonomy()
  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [searchInput, setSearchInput] = useState('')
  const [pageOffset, setPageOffset] = useState(0)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [viewing, setViewing] = useState<Exercise | null>(null)
  const [creating, setCreating] = useState(false)
  const [viewMode, setViewMode] = useState<ExerciseLibraryViewMode>(readStoredViewMode)

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode)
    } catch {
      // ignore storage errors
    }
  }, [viewMode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => (current.q === searchInput ? current : { ...current, q: searchInput }))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    setPageOffset(0)
  }, [filters])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = buildExerciseQueryParams(filters, { limit: PAGE_SIZE, offset: pageOffset })
      const data = await coachFetch<CoachLibraryPage<Exercise>>(`/api/coach/exercises?${params.toString()}`)
      setExercises(data.items)
      setTotalCount(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library')
    } finally {
      setLoading(false)
    }
  }, [filters, pageOffset])

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

  const handleExport = async (format: LibraryExportFormat) => {
    if (totalCount === 0) return
    try {
      const params = buildExerciseQueryParams(filters)
      const data = await coachFetch<CoachLibraryPage<Exercise>>(`/api/coach/exercises?${params.toString()}`)
      if (data.items.length === 0) return
      exportExercises(data.items, format, facetName, 'exercise-library')
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to export exercises')
    }
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

  const activeDifficultyPreset = useMemo(() => {
    const match = DIFFICULTY_PRESETS.find(
      (p) => p.minOverall === filters.minOverall && p.maxOverall === filters.maxOverall,
    )
    return match?.key ?? ''
  }, [filters.minOverall, filters.maxOverall])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Exercises</h2>
          <p className="text-sm text-gray-500">Movements programmed toward fitness outcomes — tenets, physiology, and session phase — for the Needs Engine and workout builder.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div
            className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1"
            role="group"
            aria-label="Exercise library view mode"
          >
            <button
              type="button"
              onClick={() => setViewMode('coach')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'coach' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Coach view
            </button>
            <button
              type="button"
              onClick={() => setViewMode('client')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'client' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Client view
            </button>
          </div>
          <LibraryExportControls
            disabled={loading || totalCount === 0}
            filenameStem="exercise-library"
            onExport={(format) => { void handleExport(format as LibraryExportFormat) }}
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
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search exercises..."
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
            />
          </div>
        </div>
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
        <RangeSelectPair
          label="Impact"
          minLabel="Min"
          maxLabel="Max"
          minValue={filters.minImpact}
          maxValue={filters.maxImpact}
          options={IMPACT_LEVEL_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
          emptyLabel="All"
          onMinChange={(minImpact) => setFilters((f) => ({
            ...f,
            minImpact,
            maxImpact: minImpact !== '' && f.maxImpact !== '' && f.maxImpact < minImpact ? minImpact : f.maxImpact,
          }))}
          onMaxChange={(maxImpact) => setFilters((f) => ({
            ...f,
            maxImpact,
            minImpact: maxImpact !== '' && f.minImpact !== '' && f.minImpact > maxImpact ? maxImpact : f.minImpact,
          }))}
        />
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Difficulty preset</label>
          <select
            value={activeDifficultyPreset}
            onChange={(e) => {
              const preset = DIFFICULTY_PRESETS.find((p) => p.key === e.target.value)
              if (!preset) {
                setFilters((f) => ({ ...f, minOverall: '', maxOverall: '' }))
                return
              }
              setFilters((f) => ({
                ...f,
                minOverall: preset.minOverall,
                maxOverall: preset.maxOverall,
                sort: preset.minOverall === 7 || preset.minOverall === 9 ? 'difficulty_desc' : f.sort,
              }))
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Custom</option>
            {DIFFICULTY_PRESETS.map((preset) => (
              <option key={preset.key} value={preset.key}>{preset.label}</option>
            ))}
          </select>
        </div>
        <RangeSelectPair
          label="Difficulty"
          minLabel="Min diff"
          maxLabel="Max diff"
          minValue={filters.minOverall}
          maxValue={filters.maxOverall}
          options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: n, label: `${n}+` }))}
          maxOptions={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: n, label: `≤ ${n}` }))}
          emptyLabel="Any"
          onMinChange={(minOverall) => setFilters((f) => ({
            ...f,
            minOverall,
            maxOverall: minOverall !== '' && f.maxOverall !== '' && f.maxOverall < minOverall ? minOverall : f.maxOverall,
          }))}
          onMaxChange={(maxOverall) => setFilters((f) => ({
            ...f,
            maxOverall,
            minOverall: maxOverall !== '' && f.minOverall !== '' && f.minOverall > maxOverall ? maxOverall : f.minOverall,
          }))}
        />
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Library type</label>
          <select
            value={filters.programmingKind}
            onChange={(e) => setFilters((f) => ({ ...f, programmingKind: e.target.value as FilterState['programmingKind'] }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="exercise">Workouts (exercises)</option>
            <option value="skill_drill">Skill drills</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Sort</label>
          <select
            value={filters.sort}
            onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as FilterState['sort'] }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="impact_desc">Impact hi-lo</option>
            <option value="impact_asc">Impact lo-hi</option>
            <option value="">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
            <option value="difficulty_desc">Hardest first</option>
            <option value="difficulty_asc">Easiest first</option>
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
        <button type="button" onClick={() => { setFilters(emptyFilters); setSearchInput('') }} className="self-end text-sm text-gray-500 hover:text-gray-800 underline">
          Clear filters
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <LibraryResultCount count={totalCount} loading={loading} />

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading library...</div>
      ) : (
        <>
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exercises.map((ex) => (
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
                {viewMode === 'coach' ? (
                  <ExerciseLibraryCard
                    exercise={ex}
                    taxonomy={taxonomy}
                    facetName={facetName}
                    tenetName={tenetName}
                  />
                ) : (
                  <ClientExerciseLibraryCard view={exerciseToClientView(ex, exercises)} />
                )}
              </LibraryCard>
            ))}
            {exercises.length === 0 && <div className="text-sm text-gray-500">No exercises match these filters.</div>}
          </div>
          <LibraryPagination
            total={totalCount}
            limit={PAGE_SIZE}
            offset={pageOffset}
            loading={loading}
            onPageChange={setPageOffset}
          />
        </>
      )}

      {viewing && viewMode === 'coach' && (
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

      {viewing && viewMode === 'client' && (
        <ClientExerciseDetailModal
          exerciseId={viewing.id}
          preview={viewing}
          exercises={exercises}
          onClose={() => setViewing(null)}
          onOpenSubstitution={(id) => {
            const target = exercises.find((e) => e.id === id)
            if (target) setViewing(target)
          }}
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

function RangeSelectPair({
  label,
  minLabel,
  maxLabel,
  minValue,
  maxValue,
  options,
  maxOptions,
  emptyLabel,
  onMinChange,
  onMaxChange,
}: {
  label: string
  minLabel: string
  maxLabel: string
  minValue: number | ''
  maxValue: number | ''
  options: { value: number; label: string }[]
  maxOptions?: { value: number; label: string }[]
  emptyLabel: string
  onMinChange: (value: number | '') => void
  onMaxChange: (value: number | '') => void
}) {
  const maxOpts = maxOptions ?? options
  return (
    <div>
      <span className="block text-xs font-semibold text-gray-500 mb-1">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-gray-400 mb-0.5">{minLabel}</label>
          <select
            value={minValue}
            onChange={(e) => onMinChange(e.target.value ? Number(e.target.value) : '')}
            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
          >
            <option value="">{emptyLabel}</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-400 mb-0.5">{maxLabel}</label>
          <select
            value={maxValue}
            onChange={(e) => onMaxChange(e.target.value ? Number(e.target.value) : '')}
            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
          >
            <option value="">{emptyLabel}</option>
            {maxOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
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

