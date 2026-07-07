import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'

export interface ComboboxOption {
  id: number | string
  label: string
  meta?: string
}

interface SmartComboboxProps {
  options: ComboboxOption[]
  selected: ComboboxOption[]
  onChange: (selected: ComboboxOption[]) => void
  placeholder?: string
  allowCustom?: boolean
  onCustomAdd?: (text: string) => ComboboxOption | null
  className?: string
}

export default function SmartCombobox({
  options,
  selected,
  onChange,
  placeholder = 'Type to search…',
  allowCustom = true,
  onCustomAdd,
  className = '',
}: SmartComboboxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const selectedIds = useMemo(() => new Set(selected.map((s) => String(s.id))), [selected])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options
      .filter((o) => !selectedIds.has(String(o.id)))
      .filter((o) => !q || o.label.toLowerCase().includes(q) || String(o.meta ?? '').toLowerCase().includes(q))
      .slice(0, 12)
  }, [options, query, selectedIds])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const add = (opt: ComboboxOption) => {
    onChange([...selected, opt])
    setQuery('')
    setOpen(false)
  }

  const remove = (id: number | string) => {
    onChange(selected.filter((s) => String(s.id) !== String(id)))
  }

  const tryCustom = () => {
    const text = query.trim()
    if (!text || !allowCustom) return
    const custom = onCustomAdd?.(text) ?? { id: `custom:${text}`, label: text }
    add(custom)
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="flex flex-wrap gap-1.5 min-h-[38px] border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus-within:ring-2 focus-within:ring-vortex-red/30">
        {selected.map((s) => (
          <span key={String(s.id)} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-800">
            {s.label}
            <button type="button" onClick={() => remove(s.id)} className="text-gray-400 hover:text-red-600"><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered[0]) add(filtered[0])
              else tryCustom()
            }
          }}
          placeholder={selected.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] border-0 outline-none text-sm py-0.5"
        />
      </div>
      {open && (filtered.length > 0 || (allowCustom && query.trim())) && (
        <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg text-sm">
          {filtered.map((o) => (
            <li key={String(o.id)}>
              <button type="button" className="w-full text-left px-3 py-2 hover:bg-red-50" onClick={() => add(o)}>
                {o.label}
                {o.meta && <span className="text-gray-400 ml-1 text-xs">{o.meta}</span>}
              </button>
            </li>
          ))}
          {allowCustom && query.trim() && !filtered.some((f) => f.label.toLowerCase() === query.trim().toLowerCase()) && (
            <li>
              <button type="button" className="w-full text-left px-3 py-2 text-vortex-red hover:bg-red-50" onClick={tryCustom}>
                Add &quot;{query.trim()}&quot;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
