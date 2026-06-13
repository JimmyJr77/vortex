import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { searchSchools, type SchoolSearchResult } from '../../utils/schoolsApi'

interface Props {
  id: string
  value: string
  required?: boolean
  onChange: (value: string) => void
}

const SchoolAutocompleteInput = ({ id, value, required, onChange }: Props) => {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [suggestions, setSuggestions] = useState<SchoolSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const trimmedValue = value.trim()
  const hasExactMatch = useMemo(
    () => suggestions.some((s) => s.name.toLowerCase() === trimmedValue.toLowerCase()),
    [suggestions, trimmedValue],
  )
  const showWriteInOption = trimmedValue.length > 0 && !hasExactMatch

  useEffect(() => {
    if (trimmedValue.length < 1) {
      setSuggestions([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(() => {
      searchSchools(trimmedValue)
        .then((results) => {
          setSuggestions(results)
          setOpen(true)
          setActiveIndex(-1)
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false))
    }, 250)

    return () => clearTimeout(timer)
  }, [trimmedValue])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectSchool = (schoolName: string) => {
    onChange(schoolName)
    setOpen(false)
    setActiveIndex(-1)
  }

  const listItems = useMemo(() => {
    const items: { key: string; name: string; location: string | null; isWriteIn?: boolean }[] =
      suggestions.map((school) => ({
        key: `school-${school.id}`,
        name: school.name,
        location: school.location,
      }))
    if (showWriteInOption) {
      items.push({
        key: 'write-in',
        name: trimmedValue,
        location: null,
        isWriteIn: true,
      })
    }
    return items
  }, [suggestions, showWriteInOption, trimmedValue])

  const showList = open && trimmedValue.length > 0 && (listItems.length > 0 || loading)

  return (
    <div className="space-y-1">
      <div ref={rootRef} className="relative">
        <input
          id={id}
          type="text"
          required={required}
          value={value}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (trimmedValue && listItems.length > 0) setOpen(true)
          }}
          onKeyDown={(e) => {
            if (!showList || listItems.length === 0) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIndex((i) => (i + 1) % listItems.length)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIndex((i) => (i <= 0 ? listItems.length - 1 : i - 1))
            } else if (e.key === 'Enter' && activeIndex >= 0) {
              e.preventDefault()
              selectSchool(listItems[activeIndex].name)
            } else if (e.key === 'Escape') {
              setOpen(false)
              setActiveIndex(-1)
            }
          }}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-vortex-red focus:ring-2 focus:ring-vortex-red/20 outline-none"
          placeholder="Start typing your school name"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
        )}
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            {listItems.map((item, idx) => (
              <li key={item.key} role="option" aria-selected={idx === activeIndex}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSchool(item.name)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${
                    idx === activeIndex ? 'bg-red-50 text-vortex-red' : 'text-black'
                  }`}
                >
                  {item.isWriteIn ? (
                    <>
                      <span className="font-medium block">Use &ldquo;{item.name}&rdquo;</span>
                      <span className="text-xs text-gray-500">
                        Not in the list — we&apos;ll match it later
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium block">{item.name}</span>
                      {item.location && (
                        <span className="text-xs text-gray-500">{item.location}</span>
                      )}
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-gray-500">
        Pick a school from the list or type a new name if yours isn&apos;t listed yet.
      </p>
    </div>
  )
}

export default SchoolAutocompleteInput
