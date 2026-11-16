import { useMemo, useState } from 'react'
import { ChevronDown, Loader2, X } from 'lucide-react'
import SearchCombobox, { type SearchComboboxOption } from '../coach/SearchCombobox'
import type { EnrollmentGroup, RecipientOption } from './types'
import { enrollmentGroupLabel } from './types'

interface RecipientPickerProps {
  options: RecipientOption[]
  selected: RecipientOption[]
  onChange: (selected: RecipientOption[]) => void
  loading?: boolean
  placeholder?: string
  label?: string
  enrollmentGroups?: EnrollmentGroup[]
  onAddEnrollmentGroup?: (group: EnrollmentGroup) => Promise<void>
  groupsLoading?: boolean
  groupActionLabel?: string
}

export default function RecipientPicker({
  options,
  selected,
  onChange,
  loading = false,
  placeholder = 'Search people to message…',
  label = 'Recipients',
  enrollmentGroups = [],
  onAddEnrollmentGroup,
  groupsLoading = false,
  groupActionLabel = 'Add everyone in',
}: RecipientPickerProps) {
  const [search, setSearch] = useState('')
  const [groupError, setGroupError] = useState<string | null>(null)
  const [addingGroupKey, setAddingGroupKey] = useState<string | null>(null)
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

  const handleAddGroup = async (group: EnrollmentGroup) => {
    if (!onAddEnrollmentGroup) return
    setGroupError(null)
    setAddingGroupKey(group.key)
    try {
      await onAddEnrollmentGroup(group)
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : 'Couldn’t add this group. Try again.')
    } finally {
      setAddingGroupKey(null)
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-800">{label}</span>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((r) => (
            <span
              key={r.key}
              className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full px-2.5 py-1 text-xs font-semibold"
            >
              {r.name}
              <button
                type="button"
                aria-label={`Remove ${r.name}`}
                onClick={() => removeRecipient(r.key)}
                className="hover:text-blue-800"
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
        ariaLabel={label}
        inputClassName="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        emptyMessage="No matches. Try another name."
        loadingMessage="Loading people…"
      />
      {onAddEnrollmentGroup && (
        <details className="group space-y-2 rounded-lg border border-slate-200 px-3 py-1.5">
          <summary className="flex min-h-7 cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">{groupActionLabel} <ChevronDown className="size-4 text-slate-500 transition-transform group-open:rotate-180" aria-hidden /></summary>
          {groupsLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading groups…
            </div>
          ) : enrollmentGroups.length === 0 ? (
            <p className="text-xs text-gray-400">No enrollment groups available.</p>
          ) : (
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pb-1">
              {enrollmentGroups.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  disabled={addingGroupKey != null}
                  onClick={() => void handleAddGroup(group)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-60"
                >
                  {addingGroupKey === group.key && <Loader2 className="w-3 h-3 animate-spin" />}
                  {enrollmentGroupLabel(group)}
                  {group.memberCount != null && (
                    <span className="text-gray-400 font-normal">({group.memberCount})</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {groupError && <p role="alert" className="text-xs text-red-700">{groupError}</p>}
        </details>
      )}
    </div>
  )
}
