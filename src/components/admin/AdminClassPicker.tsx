import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import {
  fetchClassEvents,
  fetchTopPrograms,
  type ClassEvent,
} from '../../utils/programsApi'

export type ClassPickerRow = {
  classEvent: ClassEvent
  programName: string
}

interface Props {
  selectedClassEventId?: number | null
  onSelectClass: (classEvent: ClassEvent) => void
}

const AdminClassPicker = ({
  selectedClassEventId = null,
  onSelectClass,
}: Props) => {
  const [rows, setRows] = useState<ClassPickerRow[]>([])
  const [search, setSearch] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const comboRef = useRef<HTMLDivElement>(null)

  const loadClasses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const programs = (await fetchTopPrograms(false)).filter((p) => !p.archived)
      const allRows: ClassPickerRow[] = []
      for (const program of programs) {
        const events = await fetchClassEvents({ programsId: program.id, archived: false })
        for (const classEvent of events) {
          allRows.push({
            classEvent,
            programName: program.displayName,
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
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadClasses()
  }, [loadClasses])

  useEffect(() => {
    if (!listOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setListOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [listOpen])

  const selectedRow = useMemo(
    () => rows.find((row) => row.classEvent.id === selectedClassEventId) ?? null,
    [rows, selectedClassEventId],
  )

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (row) =>
        row.classEvent.displayName.toLowerCase().includes(q) ||
        row.programName.toLowerCase().includes(q) ||
        (row.classEvent.schedulingCategoryName || '').toLowerCase().includes(q) ||
        (row.classEvent.sportTags || '').toLowerCase().includes(q),
    )
  }, [rows, search])

  const inputValue = listOpen
    ? search
    : selectedRow
      ? `${selectedRow.classEvent.displayName} — ${selectedRow.programName}`
      : search

  const handleFocus = () => {
    setListOpen(true)
    if (selectedRow) {
      setSearch('')
    }
  }

  const handleSelect = (row: ClassPickerRow) => {
    onSelectClass(row.classEvent)
    setSearch('')
    setListOpen(false)
  }

  return (
    <div className="space-y-2">
      <label htmlFor="class-picker-search" className="block text-xs font-semibold text-gray-600">
        Search classes
      </label>
      <div className="relative" ref={comboRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          id="class-picker-search"
          type="search"
          value={inputValue}
          onChange={(e) => {
            setSearch(e.target.value)
            setListOpen(true)
          }}
          onFocus={handleFocus}
          onClick={handleFocus}
          placeholder="Search by class, program, variation, or sport…"
          className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm"
          autoComplete="off"
        />

        {listOpen && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 px-4 py-6">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading classes…
              </div>
            ) : error ? (
              <p className="text-sm text-red-600 px-4 py-3">{error}</p>
            ) : filteredRows.length === 0 ? (
              <p className="text-sm text-gray-600 px-4 py-3">No classes found.</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                {filteredRows.map((row) => {
                  const selected = row.classEvent.id === selectedClassEventId
                  return (
                    <li key={row.classEvent.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(row)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          selected ? 'bg-red-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-semibold text-black text-sm">
                          {row.classEvent.displayName}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {row.programName}
                          {row.classEvent.schedulingCategoryName
                            ? ` · ${row.classEvent.schedulingCategoryName}`
                            : ''}
                          {row.classEvent.sportTags ? ` · ${row.classEvent.sportTags}` : ''}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminClassPicker
