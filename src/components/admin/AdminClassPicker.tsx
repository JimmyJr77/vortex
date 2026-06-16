import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import {
  fetchClassEvents,
  fetchTopPrograms,
  type ClassEvent,
  type TopProgram,
} from '../../utils/programsApi'

export type ClassPickerRow = {
  classEvent: ClassEvent
  programName: string
  programId: number
}

interface Props {
  selectedClassEventId?: number | null
  onSelectClass: (classEvent: ClassEvent) => void
}

const AdminClassPicker = ({
  selectedClassEventId = null,
  onSelectClass,
}: Props) => {
  const [programs, setPrograms] = useState<TopProgram[]>([])
  const [programFilterId, setProgramFilterId] = useState<number | 'all'>('all')
  const [rows, setRows] = useState<ClassPickerRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const programList = (await fetchTopPrograms(false)).filter((p) => !p.archived)
      setPrograms(programList)

      const allRows: ClassPickerRow[] = []
      for (const program of programList) {
        const events = await fetchClassEvents({ programsId: program.id, archived: false })
        for (const classEvent of events) {
          allRows.push({
            classEvent,
            programName: program.displayName,
            programId: program.id,
          })
        }
      }
      allRows.sort((a, b) => {
        const prog = a.programName.localeCompare(b.programName)
        if (prog !== 0) return prog
        return a.classEvent.displayName.localeCompare(b.classEvent.displayName)
      })
      setRows(allRows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load classes')
      setPrograms([])
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredRows = useMemo(() => {
    let next = rows
    if (programFilterId !== 'all') {
      next = next.filter((row) => row.programId === programFilterId)
    }
    const q = search.trim().toLowerCase()
    if (!q) return next
    return next.filter(
      (row) =>
        row.classEvent.displayName.toLowerCase().includes(q) ||
        row.programName.toLowerCase().includes(q) ||
        (row.classEvent.schedulingCategoryName || '').toLowerCase().includes(q) ||
        (row.classEvent.sportTags || '').toLowerCase().includes(q),
    )
  }, [rows, programFilterId, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="sm:w-56 shrink-0">
          <label htmlFor="class-picker-program" className="block text-xs font-semibold text-gray-600 mb-1">
            Program
          </label>
          <select
            id="class-picker-program"
            value={programFilterId === 'all' ? 'all' : String(programFilterId)}
            onChange={(e) => {
              const v = e.target.value
              setProgramFilterId(v === 'all' ? 'all' : Number(v))
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="class-picker-search" className="block text-xs font-semibold text-gray-600 mb-1">
            Search classes
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              id="class-picker-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by class, program, variation, or sport…"
              className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm"
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading classes…
        </div>
      ) : filteredRows.length === 0 ? (
        <p className="text-sm text-gray-600 py-4">No classes found.</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="max-h-[28rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                  <th className="px-4 py-2 font-semibold">Class / Event</th>
                  <th className="px-4 py-2 font-semibold">Program</th>
                  <th className="px-4 py-2 font-semibold">Variation</th>
                  <th className="px-4 py-2 font-semibold">Sport tags</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const selected = row.classEvent.id === selectedClassEventId
                  return (
                    <tr
                      key={row.classEvent.id}
                      onClick={() => onSelectClass(row.classEvent)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${
                        selected ? 'bg-red-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-black">{row.classEvent.displayName}</td>
                      <td className="px-4 py-3 text-gray-700">{row.programName}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.classEvent.schedulingCategoryName || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {row.classEvent.sportTags || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            row.classEvent.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {row.classEvent.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminClassPicker
