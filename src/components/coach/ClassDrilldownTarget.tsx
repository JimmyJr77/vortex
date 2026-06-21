import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import SearchCombobox, { type SearchComboboxOption } from './SearchCombobox'

export interface AssignGroupTarget {
  target_type: string
  target_id: number
  label: string
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
  primary_sport: 'Sport',
  program: 'Program',
  scheduling_class: 'Class',
  category: 'Category',
  offering: 'Offering',
}

function drillQueryFromPath(path: DrillSegment[]) {
  const params = new URLSearchParams()
  for (const seg of path) {
    if (seg.level === 'primary_sport') params.set('sportId', String(seg.id))
    if (seg.level === 'program') params.set('programId', String(seg.id))
    if (seg.level === 'scheduling_class') params.set('formId', String(seg.id))
    if (seg.level === 'category') params.set('categoryId', String(seg.id))
  }
  const q = params.toString()
  return q ? `?${q}` : ''
}

export default function ClassDrilldownTarget({
  onTargetChange,
}: {
  onTargetChange: (target: AssignGroupTarget | null) => void
}) {
  const [path, setPath] = useState<DrillSegment[]>([])
  const [levelLabel, setLevelLabel] = useState('Sport')
  const [options, setOptions] = useState<DrillOption[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<AssignGroupTarget | null>(null)

  const loadDrilldown = useCallback(async (nextPath: DrillSegment[]) => {
    setLoading(true)
    setError(null)
    try {
      const data = await coachFetch<DrilldownResponse>(
        `/api/coach/assign/drilldown${drillQueryFromPath(nextPath)}`,
      )
      setPath(data.path ?? nextPath)
      setLevelLabel(data.levelLabel || 'Sport')
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
  }, [loadDrilldown])

  const applyTarget = (seg: DrillSegment) => {
    const target: AssignGroupTarget = {
      target_type: seg.level,
      target_id: seg.id,
      label: `${LEVEL_LABELS[seg.level] || seg.level}: ${seg.label}`,
    }
    setSelectedTarget(target)
    onTargetChange(target)
  }

  const drillInto = async (opt: DrillOption) => {
    const seg: DrillSegment = { level: opt.level, id: opt.id, label: opt.label }
    const nextPath = [...path, seg]
    setSearch('')
    applyTarget(seg)
    if (opt.hasChildren) {
      await loadDrilldown(nextPath)
    }
  }

  const goToPathIndex = async (index: number) => {
    const nextPath = path.slice(0, index + 1)
    const seg = nextPath[nextPath.length - 1]
    setSearch('')
    if (seg) applyTarget(seg)
    else {
      setSelectedTarget(null)
      onTargetChange(null)
    }
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
    <div className="space-y-2">
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
          Assigning to: <span className="font-semibold">{selectedTarget.label}</span>
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
        <button
          type="button"
          onClick={() => applyTarget(path[path.length - 1])}
          className="text-xs font-semibold text-vortex-red hover:underline"
        >
          Use &ldquo;{path[path.length - 1].label}&rdquo; ({LEVEL_LABELS[path[path.length - 1].level]}) as target
        </button>
      )}
    </div>
  )
}
