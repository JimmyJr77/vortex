import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import SearchCombobox, { type SearchComboboxOption } from '../coach/SearchCombobox'
import type { RecipientOption } from './types'

interface RecipientPickerProps {
  options: RecipientOption[]
  selected: RecipientOption[]
  onChange: (selected: RecipientOption[]) => void
  loading?: boolean
  placeholder?: string
  label?: string
}

export default function RecipientPicker({
  options,
  selected,
  onChange,
  loading = false,
  placeholder = 'Search people to message…',
  label = 'Recipients',
}: RecipientPickerProps) {
  const [search, setSearch] = useState('')
  const selectedKeys = useMemo(() => new Set(selected.map((s) => s.key)), [selected])

  const comboboxOptions = useMemo<SearchComboboxOption[]>(() => {
    const q = search.trim().toLowerCase()
    return options
      .filter((o) => !selectedKeys.has(o.key))
      .filter((o) => !q || o.name.toLowerCase().includes(q))
      .map((o) => ({
        key: o.key,
        label: o.name,
        suffix: o.kind === 'admin' ? 'Admin' : o.kind === 'coach' ? 'Coach' : 'Member',
      }))
  }, [options, search, selectedKeys])

  const addRecipient = (opt: SearchComboboxOption) => {
    const match = options.find((o) => o.key === opt.key)
    if (match && !selectedKeys.has(match.key)) {
      onChange([...selected, match])
    }
    setSearch('')
  }

  const removeRecipient = (key: string) => {
    onChange(selected.filter((s) => s.key !== key))
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold text-gray-500">{label}</span>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((r) => (
            <span
              key={r.key}
              className="inline-flex items-center gap-1 bg-red-50 text-vortex-red border border-red-100 rounded-full px-2.5 py-1 text-xs font-semibold"
            >
              {r.name}
              <button
                type="button"
                aria-label={`Remove ${r.name}`}
                onClick={() => removeRecipient(r.key)}
                className="hover:text-red-800"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <SearchCombobox
        value={search}
        onChange={setSearch}
        onSelect={addRecipient}
        options={comboboxOptions}
        loading={loading}
        placeholder={placeholder}
        emptyMessage="No matches. Try another name."
        loadingMessage="Loading people…"
      />
    </div>
  )
}

export function recipientsToPayload(selected: RecipientOption[]) {
  const recipient_user_ids: number[] = []
  const recipient_member_ids: number[] = []
  for (const r of selected) {
    if (r.kind === 'member') recipient_member_ids.push(r.id)
    else recipient_user_ids.push(r.id)
  }
  return { recipient_user_ids, recipient_member_ids }
}
