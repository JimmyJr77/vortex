import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  type ClassOfferingOption,
  isActiveOrUpcomingOffering,
  loadClassOfferingOptions,
  offeringDisplayLabel,
  offeringSearchHaystack,
  todayDateString,
} from '../../utils/classOfferingOptions'

interface Props {
  value: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}

const fieldClass =
  'w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-vortex-red focus:outline-none box-border'

const ClassOfferingMultiSelect = ({ value, onChange, disabled = false }: Props) => {
  const [allOptions, setAllOptions] = useState<ClassOfferingOption[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const loadOptions = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setAllOptions(await loadClassOfferingOptions())
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load offerings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const today = todayDateString()
  const selectedSet = useMemo(() => new Set(value), [value])

  const optionById = useMemo(() => new Map(allOptions.map((o) => [o.id, o])), [allOptions])

  const selectedOptions = useMemo(
    () =>
      value.map((id) => {
        const found = optionById.get(id)
        if (found) return found
        return {
          id,
          formId: 0,
          formTitle: 'Saved offering',
          categoryName: '',
          startDate: '',
          endDate: '',
          label: `#${id}`,
        } satisfies ClassOfferingOption
      }),
    [value, optionById],
  )

  const selectableOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allOptions.filter((o) => {
      if (selectedSet.has(o.id)) return false
      if (!isActiveOrUpcomingOffering(o.endDate, today)) return false
      if (!q) return true
      return offeringSearchHaystack(o).includes(q)
    })
  }, [allOptions, query, selectedSet, today])

  const addOffering = (id: number) => {
    if (selectedSet.has(id)) return
    onChange([...value, id])
    setQuery('')
    setOpen(false)
  }

  const removeOffering = (id: number) => {
    onChange(value.filter((v) => v !== id))
  }

  return (
    <div ref={rootRef} className="space-y-2">
      <div className="relative">
        <input
          type="search"
          className={fieldClass}
          placeholder="Search class offerings…"
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
            {selectableOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">
                {query.trim() ? 'No matching active or upcoming offerings.' : 'No offerings to add.'}
              </p>
            ) : (
              selectableOptions.slice(0, 40).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addOffering(o.id)}
                >
                  <span className="font-medium text-gray-900">{o.formTitle}</span>
                  <span className="text-gray-500"> · {o.categoryName}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {o.label} ({o.startDate} – {o.endDate})
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {loading && (
        <p className="text-xs text-gray-500 inline-flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading offerings…
        </p>
      )}
      {loadError && <p className="text-xs text-red-600">{loadError}</p>}

      {selectedOptions.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selectedOptions.map((o) => (
            <li
              key={o.id}
              className="inline-flex items-center gap-1 max-w-full rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-800"
            >
              <span className="truncate" title={offeringDisplayLabel(o)}>
                {offeringDisplayLabel(o)}
              </span>
              <button
                type="button"
                className="text-gray-400 hover:text-red-600 shrink-0"
                aria-label={`Remove ${offeringDisplayLabel(o)}`}
                disabled={disabled}
                onClick={() => removeOffering(o.id)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">No offerings selected — pass can apply to any offering where it is attached.</p>
      )}
    </div>
  )
}

export default ClassOfferingMultiSelect
