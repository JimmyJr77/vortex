import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { schoolsApi, type School } from '../../utils/adminFeaturesApi'

interface Props {
  value: string[]
  onChange: (names: string[]) => void
  disabled?: boolean
}

const fieldClass =
  'w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-vortex-red focus:outline-none box-border'

function schoolHaystack(s: School): string {
  return [s.name, s.location ?? '', s.level ?? ''].join(' ').toLowerCase()
}

const SchoolMultiSelect = ({ value, onChange, disabled = false }: Props) => {
  const [allSchools, setAllSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const loadSchools = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setAllSchools(await schoolsApi.list({ active: true }))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load schools')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSchools()
  }, [loadSchools])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const selectedSet = useMemo(() => new Set(value.map((n) => n.toLowerCase())), [value])

  const schoolByName = useMemo(() => {
    const map = new Map<string, School>()
    for (const s of allSchools) map.set(s.name.toLowerCase(), s)
    return map
  }, [allSchools])

  const selectableSchools = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allSchools.filter((s) => {
      if (selectedSet.has(s.name.toLowerCase())) return false
      if (!q) return true
      return schoolHaystack(s).includes(q)
    })
  }, [allSchools, query, selectedSet])

  const addSchool = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || selectedSet.has(trimmed.toLowerCase())) return
    onChange([...value, trimmed])
    setQuery('')
    setOpen(false)
  }

  const removeSchool = (name: string) => {
    onChange(value.filter((n) => n.toLowerCase() !== name.toLowerCase()))
  }

  return (
    <div ref={rootRef} className="space-y-2">
      <div className="relative">
        <input
          type="search"
          className={fieldClass}
          placeholder="Search schools…"
          value={query}
          disabled={disabled || loading}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
        {open && !disabled && !loading && (
          <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {selectableSchools.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">
                {query.trim() ? 'No matching active schools.' : 'No schools to add.'}
              </p>
            ) : (
              selectableSchools.slice(0, 40).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addSchool(s.name)}
                >
                  <span className="font-medium text-gray-900">{s.name}</span>
                  {(s.location || s.level) && (
                    <span className="block text-xs text-gray-500 mt-0.5">
                      {[s.level, s.location].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {loading && (
        <p className="text-xs text-gray-500 inline-flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading schools…
        </p>
      )}
      {loadError && <p className="text-xs text-red-600">{loadError}</p>}

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((name) => {
            const school = schoolByName.get(name.toLowerCase())
            return (
              <li
                key={name}
                className="inline-flex items-center gap-1 max-w-full rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-800"
              >
                <span className="truncate" title={name}>
                  {name}
                  {school?.location ? ` · ${school.location}` : null}
                </span>
                <button
                  type="button"
                  className="text-gray-400 hover:text-red-600 shrink-0"
                  aria-label={`Remove ${name}`}
                  disabled={disabled}
                  onClick={() => removeSchool(name)}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">No schools selected — pass can apply to members from any school.</p>
      )}
    </div>
  )
}

export default SchoolMultiSelect
