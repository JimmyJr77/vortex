import { useId, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

export interface SearchComboboxOption {
  key: string
  label: string
  suffix?: string
}

interface SearchComboboxProps {
  value: string
  onChange: (value: string) => void
  onSelect: (option: SearchComboboxOption) => void
  options: SearchComboboxOption[]
  loading?: boolean
  placeholder?: string
  emptyMessage?: string
  loadingMessage?: string
  onFocus?: () => void
}

export default function SearchCombobox({
  value,
  onChange,
  onSelect,
  options,
  loading = false,
  placeholder = 'Search…',
  emptyMessage = 'No matches.',
  loadingMessage = 'Loading…',
  onFocus,
}: SearchComboboxProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const showList = open

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node)) {
          setOpen(false)
          setActiveIndex(-1)
        }
      }}
    >
      <input
        type="text"
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm pr-8"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => {
          onFocus?.()
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (!showList || options.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((i) => (i + 1) % options.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1))
          } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault()
            onSelect(options[activeIndex])
            setOpen(false)
            setActiveIndex(-1)
          } else if (e.key === 'Escape') {
            setOpen(false)
            setActiveIndex(-1)
          }
        }}
      />
      {loading && (
        <Loader2 className="absolute right-2 top-2 w-4 h-4 animate-spin text-gray-400" />
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1"
        >
          {loading && options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">{loadingMessage}</li>
          ) : options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</li>
          ) : (
            options.map((opt, index) => (
              <li key={opt.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${index === activeIndex ? 'bg-red-50 text-vortex-red' : 'text-gray-800'}`}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => {
                    onSelect(opt)
                    setOpen(false)
                    setActiveIndex(-1)
                  }}
                >
                  <span>{opt.label}</span>
                  {opt.suffix && (
                    <span className={`text-xs shrink-0 ${index === activeIndex ? 'text-vortex-red' : 'text-gray-400'}`}>
                      {opt.suffix}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
