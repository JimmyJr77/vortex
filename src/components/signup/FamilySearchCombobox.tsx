import { useEffect, useId, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { adminApiRequest } from '../../utils/api'

export interface FamilySearchOption {
  id: number
  familyName: string
  familyUsername?: string
  memberCount?: number
}

interface FamilySearchComboboxProps {
  id?: string
  value: string
  selectedFamilyId: number | null
  onQueryChange: (query: string) => void
  onSelect: (family: FamilySearchOption | null) => void
  placeholder?: string
}

export default function FamilySearchCombobox({
  id = 'family-search',
  value,
  selectedFamilyId,
  onQueryChange,
  onSelect,
  placeholder = 'Type a family name to search…',
}: FamilySearchComboboxProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [options, setOptions] = useState<FamilySearchOption[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const trimmed = value.trim()

  useEffect(() => {
    if (trimmed.length < 1) {
      setOptions([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(() => {
      adminApiRequest(`/api/admin/families/search?search=${encodeURIComponent(trimmed)}`)
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok || !data.success) {
            setOptions([])
            return
          }
          setOptions(data.data ?? [])
          setOpen(true)
          setActiveIndex(-1)
        })
        .catch(() => setOptions([]))
        .finally(() => setLoading(false))
    }, 250)

    return () => clearTimeout(timer)
  }, [trimmed])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const pickFamily = (family: FamilySearchOption) => {
    onSelect(family)
    onQueryChange(family.familyName || family.familyUsername || '')
    setOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || options.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => (prev + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => (prev <= 0 ? options.length - 1 : prev - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      pickFamily(options[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={id} className="block text-xs font-semibold text-gray-600 mb-1">
        Existing family
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="w-full h-10 rounded-lg border border-gray-300 px-3 pr-9 text-sm"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onQueryChange(e.target.value)
            if (selectedFamilyId != null) {
              onSelect(null)
            }
            setOpen(true)
          }}
          onFocus={() => {
            if (trimmed.length >= 1 && options.length > 0) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>
      {selectedFamilyId != null && (
        <p className="mt-1 text-xs text-green-700">Family selected — continue to add members.</p>
      )}
      {open && trimmed.length >= 1 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {loading && options.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>
          )}
          {!loading && options.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">No families match &ldquo;{trimmed}&rdquo;</li>
          )}
          {options.map((family, index) => {
            const label = family.familyName || 'Unnamed family'
            const sub = [
              family.familyUsername ? `@${family.familyUsername}` : null,
              family.memberCount != null ? `${family.memberCount} member(s)` : null,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={family.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index || selectedFamilyId === family.id}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                    activeIndex === index || selectedFamilyId === family.id ? 'bg-red-50' : ''
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickFamily(family)}
                >
                  <div className="font-medium text-gray-900">{label}</div>
                  {sub && <div className="text-xs text-gray-500">{sub}</div>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
