import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { adminApiRequest } from '../utils/api'
import SearchCombobox, { type SearchComboboxOption } from './coach/SearchCombobox'

export interface CoachAssignmentTarget {
  targetLevel: string
  label: string
  programsId?: number | null
  classEventId?: number | null
  schedulingFormId?: number | null
  schedulingCategoryId?: number | null
  schedulingOfferingId?: number | null
  schedulingTimeSlotId?: number | null
}

interface DrillSegment {
  level: string
  id: number
  label: string
}

interface DrillOption {
  id: number
  label: string
  level: string
  hasChildren: boolean
}

interface DrilldownResponse {
  currentLevel: string
  levelLabel: string
  path: DrillSegment[]
  options: DrillOption[]
}

const LEVEL_LABELS: Record<string, string> = {
  programs_top: 'Program',
  class_event: 'Class',
  scheduling_class: 'Scheduling class',
  category: 'Category',
  offering: 'Offering',
  time_slot: 'Timeslot',
}

function drillQueryFromPath(path: DrillSegment[]) {
  const params = new URLSearchParams()
  for (const seg of path) {
    if (seg.level === 'programs_top') params.set('programsId', String(seg.id))
    if (seg.level === 'class_event') params.set('classEventId', String(seg.id))
    if (seg.level === 'scheduling_class') params.set('formId', String(seg.id))
    if (seg.level === 'category') params.set('categoryId', String(seg.id))
    if (seg.level === 'offering') params.set('offeringId', String(seg.id))
  }
  const q = params.toString()
  return q ? `?${q}` : ''
}

function targetFromSegment(seg: DrillSegment): CoachAssignmentTarget {
  const base: CoachAssignmentTarget = {
    targetLevel: seg.level,
    label: `${LEVEL_LABELS[seg.level] || seg.level}: ${seg.label}`,
  }
  if (seg.level === 'programs_top') base.programsId = seg.id
  if (seg.level === 'class_event') base.classEventId = seg.id
  if (seg.level === 'scheduling_class') base.schedulingFormId = seg.id
  if (seg.level === 'category') base.schedulingCategoryId = seg.id
  if (seg.level === 'offering') base.schedulingOfferingId = seg.id
  if (seg.level === 'time_slot') base.schedulingTimeSlotId = seg.id
  return base
}

function targetFromPath(path: DrillSegment[]): CoachAssignmentTarget | null {
  if (path.length === 0) return null
  const seg = path[path.length - 1]
  const target = targetFromSegment(seg)
  for (const p of path) {
    if (p.level === 'programs_top') target.programsId = p.id
    if (p.level === 'class_event') target.classEventId = p.id
    if (p.level === 'scheduling_class') target.schedulingFormId = p.id
    if (p.level === 'category') target.schedulingCategoryId = p.id
    if (p.level === 'offering') target.schedulingOfferingId = p.id
  }
  return target
}

export default function AdminCoachAssignmentDrilldown({
  onTargetChange,
}: {
  onTargetChange: (target: CoachAssignmentTarget | null) => void
}) {
  const [path, setPath] = useState<DrillSegment[]>([])
  const [levelLabel, setLevelLabel] = useState('Program')
  const [options, setOptions] = useState<DrillOption[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<CoachAssignmentTarget | null>(null)

  const loadDrilldown = useCallback(async (nextPath: DrillSegment[]) => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApiRequest(`/api/admin/coaches/assign-drilldown${drillQueryFromPath(nextPath)}`)
      if (!res.ok) throw new Error('Failed to load assignment options')
      const json = await res.json()
      const data = json.data as DrilldownResponse
      setPath(data.path ?? nextPath)
      setLevelLabel(data.levelLabel || 'Program')
      setOptions(data.options ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load options')
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDrilldown([])
    setSelectedTarget(null)
    onTargetChange(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset drilldown on remount only
  }, [loadDrilldown])

  const applyTarget = (target: CoachAssignmentTarget | null) => {
    setSelectedTarget(target)
    onTargetChange(target)
  }

  const assignAtPathIndex = (index: number) => {
    const target = targetFromPath(path.slice(0, index + 1))
    applyTarget(target)
  }

  const drillInto = async (opt: DrillOption) => {
    const seg: DrillSegment = { level: opt.level, id: opt.id, label: opt.label }
    const nextPath = [...path, seg]
    setSearch('')
    const target = targetFromPath(nextPath)
    applyTarget(target)
    if (opt.hasChildren) {
      await loadDrilldown(nextPath)
    }
  }

  const goToPathIndex = async (index: number) => {
    const nextPath = path.slice(0, index + 1)
    setSearch('')
    applyTarget(targetFromPath(nextPath))
    await loadDrilldown(nextPath)
  }

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, search])

  const comboboxOptions = useMemo<SearchComboboxOption[]>(
    () =>
      filteredOptions.map((opt) => ({
        key: `${opt.level}-${opt.id}`,
        label: opt.label,
        suffix: opt.hasChildren ? 'Drill down →' : 'Select',
      })),
    [filteredOptions],
  )

  const handleComboboxSelect = (item: SearchComboboxOption) => {
    const opt = filteredOptions.find((o) => `${o.level}-${o.id}` === item.key)
    if (opt) void drillInto(opt)
  }

  return (
    <div className="space-y-3">
      {path.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-gray-600">
          {path.map((seg, index) => (
            <span key={`${seg.level}-${seg.id}`} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void goToPathIndex(index)}
                className="font-semibold text-vortex-red hover:underline"
              >
                {seg.label}
              </button>
              {index < path.length - 1 && <ChevronRight className="w-3 h-3 text-gray-400" />}
            </span>
          ))}
        </div>
      )}

      {selectedTarget && (
        <div className="text-xs bg-green-50 text-green-800 border border-green-100 rounded-lg px-3 py-2">
          Assignment scope: <span className="font-semibold">{selectedTarget.label}</span>
        </div>
      )}

      <label className="text-sm block">
        <span className="block text-xs font-semibold text-gray-500 mb-1">{levelLabel}</span>
        <SearchCombobox
          value={search}
          onChange={setSearch}
          onSelect={handleComboboxSelect}
          options={comboboxOptions}
          loading={loading}
          placeholder={`Search ${levelLabel.toLowerCase()}…`}
          emptyMessage={error ? error : 'No matches.'}
          loadingMessage="Loading…"
        />
      </label>

      {path.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {path.map((seg, index) => (
            <button
              key={`assign-${seg.level}-${seg.id}`}
              type="button"
              onClick={() => assignAtPathIndex(index)}
              className="text-xs rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-gray-700 hover:border-vortex-red hover:text-vortex-red"
            >
              All in {LEVEL_LABELS[seg.level]}: {seg.label}
            </button>
          ))}
        </div>
      )}

      {path.length === 0 && options.length > 0 && (
        <p className="text-xs text-gray-500">
          Pick a program to drill into classes, scheduling offerings, categories, and timeslots — or assign the whole program from the breadcrumb after selecting it.
        </p>
      )}
    </div>
  )
}
