import { useId, useState } from 'react'
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react'
import { filterInput } from './DateRange'

export interface EntityOption { id: number; label: string; detail?: string }

export default function EntityPicker({ label, allLabel, placeholder, selected, query, onQuery, options, loading, error, onSelect }: {
  label: string
  allLabel: string
  placeholder: string
  selected: EntityOption | null
  query: string
  onQuery: (query: string) => void
  options: EntityOption[]
  loading: boolean
  error: string | null
  onSelect: (option: EntityOption | null) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const available = loading ? [] : options
  return <div className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false) }}>
    <label htmlFor={id} className="text-xs font-semibold text-slate-600">{label}</label>
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-autocomplete="list"
        aria-activedescendant={open && available[active] ? `${id}-${active}` : undefined}
        autoComplete="off"
        className={`${filterInput} !pr-10`}
        value={open ? query : selected?.label ?? query}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setActive(-1) }}
        onChange={event => { onQuery(event.target.value); setOpen(true); setActive(-1) }}
        onKeyDown={event => {
          if (event.key === 'Escape') { setOpen(false); setActive(-1) }
          if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(index => Math.min(index + 1, available.length - 1)) }
          if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => available.length ? Math.max(index - 1, 0) : -1) }
          if (event.key === 'Enter' && open && available[active]) { event.preventDefault(); onSelect(available[active]); onQuery(''); setOpen(false) }
        }}
      />
      {selected ? <button type="button" aria-label={`Clear ${label.toLowerCase()}`} className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-900" onClick={() => { onSelect(null); onQuery(''); setOpen(false) }}><X className="h-4 w-4" /></button> : <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />}
    </div>
    {open ? <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
      <div id={`${id}-options`} role="listbox" aria-busy={loading} aria-label={`${label} choices`}>
        <button type="button" role="option" aria-selected={!selected} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50" onMouseDown={event => event.preventDefault()} onClick={() => { onSelect(null); onQuery(''); setOpen(false) }}><Search className="h-3.5 w-3.5" />{allLabel}</button>
        {available.map((option, index) => <button key={option.id} type="button" id={`${id}-${index}`} role="option" aria-selected={selected?.id === option.id} onMouseDown={event => event.preventDefault()} onClick={() => { onSelect(option); onQuery(''); setOpen(false) }} className={`flex w-full items-start justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${active === index ? 'bg-slate-100' : ''}`}>
          <span className="min-w-0"><span className="block font-medium text-slate-900">{option.label}</span>{option.detail ? <span className="mt-0.5 block text-xs text-slate-500">{option.detail}</span> : null}</span>
          {selected?.id === option.id ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-900" /> : null}
        </button>)}
      </div>
      {loading ? <p role="status" className="flex items-center gap-2 px-3 py-3 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Searching…</p> : error ? <p role="alert" className="px-3 py-3 text-xs text-red-700">{error}</p> : !options.length ? <p className="px-3 py-3 text-xs text-slate-500">No matches. Try another search.</p> : null}
    </div> : null}
  </div>
}
