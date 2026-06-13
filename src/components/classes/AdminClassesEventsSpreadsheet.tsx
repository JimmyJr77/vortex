import { Fragment, useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import {
  loadAllSpreadsheetRows,
  type ClassSpreadsheetRow,
} from '../../utils/classSchedulingSummary'
import ClassSchedulingExpandPanel from './ClassSchedulingExpandPanel'

type SpreadsheetSortField =
  | 'program'
  | 'class'
  | 'categories'
  | 'offerings'
  | 'slots'
  | 'costs'

interface ProgramClass {
  id: number
  displayName: string
  categoryId?: number | null
  description?: string | null
  skillRequirements?: string | null
}

interface Props {
  classes: ProgramClass[]
  programNameFor: (categoryId: number) => string
  skillLevelFor?: (classId: number) => string
  storedActiveFor?: (classId: number) => string
  effectiveActiveFor?: (classId: number) => string
}

function SortableHeader({
  label,
  field,
  sortConfig,
  onSort,
}: {
  label: string
  field: SpreadsheetSortField
  sortConfig: { field: SpreadsheetSortField; direction: 'asc' | 'desc' }
  onSort: (field: SpreadsheetSortField) => void
}) {
  const icon =
    sortConfig.field !== field ? (
      <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />
    ) : sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    )

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center hover:text-vortex-red transition-colors"
    >
      {label} {icon}
    </button>
  )
}

const thClass = 'px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider'
const tdClass = 'px-4 py-3 align-middle text-sm text-gray-900'

const AdminClassesEventsSpreadsheet = ({
  classes,
  programNameFor,
  skillLevelFor,
  storedActiveFor,
  effectiveActiveFor,
}: Props) => {
  const [rows, setRows] = useState<ClassSpreadsheetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedClassId, setExpandedClassId] = useState<number | null>(null)
  const [sortConfig, setSortConfig] = useState<{
    field: SpreadsheetSortField
    direction: 'asc' | 'desc'
  }>({ field: 'program', direction: 'asc' })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    loadAllSpreadsheetRows(classes, programNameFor)
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load classes and events')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [classes, programNameFor])

  const handleSort = (field: SpreadsheetSortField) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const sortedRows = useMemo(() => {
    const dir = sortConfig.direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      let cmp = 0
      switch (sortConfig.field) {
        case 'program':
          cmp = a.programName.localeCompare(b.programName)
          break
        case 'class':
          cmp = a.className.localeCompare(b.className)
          break
        case 'categories':
          cmp = a.categoriesSummary.localeCompare(b.categoriesSummary)
          break
        case 'offerings':
          cmp = a.offeringCount - b.offeringCount
          break
        case 'slots':
          cmp = a.slotCount - b.slotCount
          break
        case 'costs':
          cmp = a.costsSummary.localeCompare(b.costsSummary)
          break
      }
      if (cmp !== 0) return cmp * dir
      const progCmp = a.programName.localeCompare(b.programName)
      if (progCmp !== 0) return progCmp
      return a.className.localeCompare(b.className)
    })
  }, [rows, sortConfig])

  const classMetaById = useMemo(() => {
    const map = new Map<number, ProgramClass>()
    for (const cls of classes) map.set(cls.id, cls)
    return map
  }, [classes])

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 inline-flex items-center gap-2 justify-center w-full">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading classes and events with offerings…
      </div>
    )
  }

  if (error) {
    return <div className="py-8 text-center text-red-600">{error}</div>
  }

  if (sortedRows.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 border border-dashed rounded-xl">
        No classes or events with offerings yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className={thClass}>
              <SortableHeader label="Program" field="program" sortConfig={sortConfig} onSort={handleSort} />
            </th>
            <th className={thClass}>
              <SortableHeader
                label="Classes & Events"
                field="class"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            </th>
            <th className={thClass}>
              <SortableHeader
                label="Categories"
                field="categories"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            </th>
            <th className={thClass}>
              <SortableHeader
                label="Offerings"
                field="offerings"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            </th>
            <th className={thClass}>
              <SortableHeader label="Slots" field="slots" sortConfig={sortConfig} onSort={handleSort} />
            </th>
            <th className={thClass}>
              <SortableHeader label="Costs" field="costs" sortConfig={sortConfig} onSort={handleSort} />
            </th>
            <th className={`${thClass} w-12 text-center`}>Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sortedRows.map((row) => {
            const meta = classMetaById.get(row.classId)
            const isExpanded = expandedClassId === row.classId
            return (
              <Fragment key={row.classId}>
                <tr
                  className={`hover:bg-gray-50/80 cursor-pointer ${isExpanded ? 'bg-gray-50/50' : ''}`}
                  onClick={() => setExpandedClassId((prev) => (prev === row.classId ? null : row.classId))}
                >
                  <td className={tdClass}>{row.programName}</td>
                  <td className={`${tdClass} font-medium`}>{row.className}</td>
                  <td className={tdClass}>{row.categoriesSummary}</td>
                  <td className={tdClass}>{row.offeringsSummary}</td>
                  <td className={tdClass}>{row.slotsSummary}</td>
                  <td className={tdClass}>{row.costsSummary}</td>
                  <td className={`${tdClass} text-center`} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                      onClick={() =>
                        setExpandedClassId((prev) => (prev === row.classId ? null : row.classId))
                      }
                      aria-label="Toggle details"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
                {isExpanded && meta && (
                  <tr>
                    <td colSpan={7} className="px-0 py-0">
                      <ClassSchedulingExpandPanel
                        classId={row.classId}
                        className={row.className}
                        description={meta.description}
                        skillRequirements={meta.skillRequirements}
                        skillLevelLabel={skillLevelFor?.(row.classId)}
                        storedActiveLabel={storedActiveFor?.(row.classId)}
                        effectiveActiveLabel={effectiveActiveFor?.(row.classId)}
                        schedulingFormId={row.formId}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default AdminClassesEventsSpreadsheet
