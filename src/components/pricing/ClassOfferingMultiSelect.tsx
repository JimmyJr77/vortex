import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  type ClassOfferingOption,
  type SportScopeOption,
  isActiveOrUpcomingOffering,
  loadClassOfferingOptions,
  loadSportScopeOptions,
  offeringDisplayLabel,
  offeringSearchHaystack,
  sportSearchHaystack,
  todayDateString,
} from '../../utils/classOfferingOptions'

interface Props {
  offeringIds: number[]
  sportIds: number[]
  onOfferingIdsChange: (ids: number[]) => void
  onSportIdsChange: (ids: number[]) => void
  disabled?: boolean
}

const fieldClass =
  'w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-vortex-red focus:outline-none box-border'

const ClassOfferingMultiSelect = ({
  offeringIds,
  sportIds,
  onOfferingIdsChange,
  onSportIdsChange,
  disabled = false,
}: Props) => {
  const [allOfferings, setAllOfferings] = useState<ClassOfferingOption[]>([])
  const [allSports, setAllSports] = useState<SportScopeOption[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const loadOptions = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [offerings, sports] = await Promise.all([
        loadClassOfferingOptions(),
        loadSportScopeOptions(),
      ])
      setAllOfferings(offerings)
      setAllSports(sports)
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
  const selectedOfferingSet = useMemo(() => new Set(offeringIds), [offeringIds])
  const selectedSportSet = useMemo(() => new Set(sportIds), [sportIds])

  const offeringById = useMemo(
    () => new Map(allOfferings.map((o) => [o.id, o])),
    [allOfferings],
  )
  const sportById = useMemo(() => new Map(allSports.map((s) => [s.id, s])), [allSports])

  const selectedOfferings = useMemo(
    () =>
      offeringIds.map((id) => {
        const found = offeringById.get(id)
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
    [offeringIds, offeringById],
  )

  const selectedSports = useMemo(
    () =>
      sportIds.map((id) => {
        const found = sportById.get(id)
        if (found) return found
        return { id, name: `Sport #${id}` } satisfies SportScopeOption
      }),
    [sportIds, sportById],
  )

  const selectableSports = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allSports.filter((s) => {
      if (selectedSportSet.has(s.id)) return false
      if (!q) return true
      return sportSearchHaystack(s).includes(q)
    })
  }, [allSports, query, selectedSportSet])

  const selectableOfferings = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allOfferings.filter((o) => {
      if (selectedOfferingSet.has(o.id)) return false
      if (!isActiveOrUpcomingOffering(o.endDate, today)) return false
      if (!q) return true
      return offeringSearchHaystack(o).includes(q)
    })
  }, [allOfferings, query, selectedOfferingSet, today])

  const hasResults = selectableSports.length > 0 || selectableOfferings.length > 0

  return (
    <div ref={rootRef} className="space-y-2">
      <div className="relative">
        <input
          type="search"
          className={fieldClass}
          placeholder="Search sports or class offerings…"
          value={query}
          disabled={disabled || loading}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
        {open && !disabled && !loading && (
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {!hasResults ? (
              <p className="px-3 py-2 text-sm text-gray-500">
                {query.trim()
                  ? 'No matching sports or active/upcoming offerings.'
                  : 'No sports or offerings to add.'}
              </p>
            ) : (
              <>
                {selectableSports.slice(0, 20).map((s) => (
                  <button
                    key={`sport-${s.id}`}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSportIdsChange([...sportIds, s.id])
                      setQuery('')
                      setOpen(false)
                    }}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-vortex-red">
                      Sport
                    </span>
                    <span className="block font-medium text-gray-900">{s.name}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      All classes with this primary sport
                    </span>
                  </button>
                ))}
                {selectableOfferings.slice(0, 40).map((o) => (
                  <button
                    key={`offering-${o.id}`}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onOfferingIdsChange([...offeringIds, o.id])
                      setQuery('')
                      setOpen(false)
                    }}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Offering
                    </span>
                    <span className="block font-medium text-gray-900">{o.formTitle}</span>
                    <span className="text-gray-500"> · {o.categoryName}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      {o.label} ({o.startDate} – {o.endDate})
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {loading && (
        <p className="text-xs text-gray-500 inline-flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading sports and offerings…
        </p>
      )}
      {loadError && <p className="text-xs text-red-600">{loadError}</p>}

      {selectedSports.length > 0 || selectedOfferings.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selectedSports.map((s) => (
            <li
              key={`sport-${s.id}`}
              className="inline-flex items-center gap-1 max-w-full rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-gray-800"
            >
              <span className="truncate" title={`Sport: ${s.name}`}>
                Sport: {s.name}
              </span>
              <button
                type="button"
                className="text-gray-400 hover:text-red-600 shrink-0"
                aria-label={`Remove sport ${s.name}`}
                disabled={disabled}
                onClick={() => onSportIdsChange(sportIds.filter((id) => id !== s.id))}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
          {selectedOfferings.map((o) => (
            <li
              key={`offering-${o.id}`}
              className="inline-flex items-center gap-1 max-w-full rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-800"
            >
              <span className="truncate" title={offeringDisplayLabel(o)}>
                Offering: {offeringDisplayLabel(o)}
              </span>
              <button
                type="button"
                className="text-gray-400 hover:text-red-600 shrink-0"
                aria-label={`Remove ${offeringDisplayLabel(o)}`}
                disabled={disabled}
                onClick={() => onOfferingIdsChange(offeringIds.filter((id) => id !== o.id))}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">
          No sports or offerings selected — pass can apply to any class where it is attached under
          Pricing → Costs.
        </p>
      )}
    </div>
  )
}

export default ClassOfferingMultiSelect
