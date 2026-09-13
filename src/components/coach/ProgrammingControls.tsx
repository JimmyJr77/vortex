import type { ReactNode } from 'react'
import type { TaxonomyV2Catalog } from '../../coach/taxonomy'
import { CANONICAL_EQUIPMENT_OPTIONS } from '../../coach/canonicalEquipmentOptions'
import { PRIORITY_FACETS, type CoachWorkoutRequest, type ProgrammingComponentControls, type ProgrammingPriority, type WorkoutProgrammingChoices } from '../../coach/workoutProgramming'

export const controlClass = 'mt-1 min-w-0 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100'
export const actionClass = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:border-vortex-red disabled:opacity-50'
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block min-w-0 text-sm font-medium text-gray-700">{label}{children}{hint && <span className="mt-1 block text-xs font-normal text-gray-500">{hint}</span>}</label>
}
export function NumberField({ label, value, onChange, min = 0, max, optional = false }: {
  label: string; value: number | null | undefined; onChange: (value: number | null) => void; min?: number; max?: number; optional?: boolean
}) {
  return <Field label={label}><input aria-label={label} className={controlClass} type="number" min={min} max={max} step={1}
    required={!optional} value={value ?? ''} placeholder={optional ? 'Unknown / auto' : undefined}
    onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} /></Field>
}
export function BooleanField({ label, value, onChange }: { label: string; value: boolean | null | undefined; onChange: (value: boolean | null) => void }) {
  return <Field label={label}><select className={controlClass} value={value == null ? '' : String(value)} onChange={(event) => onChange(event.target.value === '' ? null : event.target.value === 'true')}>
    <option value="">Not confirmed</option><option value="true">Yes</option><option value="false">No</option>
  </select></Field>
}
export function MultiChoice({ label, options, selected, onChange }: { label: string;
  options: readonly { id: string; name: string; disabled?: boolean }[]; selected: readonly string[]; onChange: (selected: string[]) => void }) {
  const missing = selected.filter((id) => !options.some((option) => option.id === id))
  return <div><Field label={label} hint="Use ⌘ / Ctrl to select more than one."><select multiple size={Math.min(4, Math.max(2, options.length))} className={controlClass}
    value={[...selected]} onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}>
    {options.map((option) => <option key={option.id} value={option.id} disabled={option.disabled}>{option.name}</option>)}
  </select></Field>{missing.length > 0 && <p className="mt-1 text-xs text-amber-800">{missing.length} saved choices are outside the current matches.
    <button type="button" className="ml-1 underline" onClick={() => onChange(selected.filter((id) => !missing.includes(id)))}>Clear unavailable choices</button></p>}</div>
}

export function PriorityControls({ label, values = [], taxonomy, onChange }: { label: string; values?: readonly ProgrammingPriority[];
  taxonomy: TaxonomyV2Catalog | null; onChange: (values: ProgrammingPriority[]) => void }) {
  const update = (index: number, patch: Partial<ProgrammingPriority>) => onChange(values.map((value, position) => position === index ? { ...value, ...patch } : value))
  return <fieldset className="space-y-2"><legend className="text-sm font-semibold text-gray-800">{label}</legend>
    {values.map((priority, index) => <div key={index} className="grid gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-[1fr_1fr_130px_76px_auto]">
      <Field label="Focus"><select className={controlClass} value={priority.facet} onChange={(event) => {
        const facet = event.target.value as ProgrammingPriority['facet']; update(index, { facet, value: taxonomy?.facets[facet]?.find((term) => term.status === 'active')?.key ?? '' })
      }}>{Object.entries(PRIORITY_FACETS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></Field>
      <Field label="Priority"><select className={controlClass} required value={priority.value} onChange={(event) => update(index, { value: event.target.value })}>
        <option value="">Choose a priority</option>{taxonomy?.facets[priority.facet]?.filter((term) => term.status === 'active').map((term) => <option key={term.key} value={term.key}>{term.name}</option>)}
      </select></Field>
      <Field label="Preference"><select className={controlClass} value={priority.strength} onChange={(event) => update(index, { strength: event.target.value as ProgrammingPriority['strength'] })}>
        <option value="preferred">Prefer</option><option value="required">Require</option><option value="exclude">Exclude</option>
      </select></Field>
      <NumberField label="Weight" min={1} max={100} value={priority.weight ?? 70} onChange={(weight) => update(index, { weight: weight ?? 1 })} />
      <button type="button" className={`${actionClass} self-end`} aria-label={`Remove ${label} priority ${index + 1}`} onClick={() => onChange(values.filter((_, position) => index !== position))}>Remove</button>
    </div>)}
    <button type="button" className={actionClass} disabled={!taxonomy || values.length >= 30} onClick={() => onChange([...values, {
      facet: 'tenet', value: taxonomy?.facets.tenet?.find((term) => term.status === 'active')?.key ?? '', strength: 'preferred', weight: 70,
    }])}>Add {label.toLowerCase()} priority</button>
  </fieldset>
}

export function EquipmentControls({ value, onChange }: { value: CoachWorkoutRequest['equipment']; onChange: (value: CoachWorkoutRequest['equipment']) => void }) {
  const toggle = (key: string, selected: boolean, field: 'available' | 'excluded') => {
    const next = { ...value, [field]: selected ? [...(value[field] ?? []), key] : (value[field] ?? []).filter((item) => item !== key) }
    if (selected) {
      const opposite = field === 'available' ? 'excluded' : 'available'
      next[opposite] = (value[opposite] ?? []).filter((item) => item !== key)
    }
    if (field === 'excluded' && selected || field === 'available' && !selected) {
      next.preferred = (value.preferred ?? []).filter((item) => item !== key)
      next.required = (value.required ?? []).filter((item) => item !== key)
    }
    onChange(next)
  }
  return <fieldset><legend className="font-semibold text-gray-900">Equipment and quantities</legend>
    <p className="mb-3 mt-1 text-sm text-gray-500">Confirm available equipment. Leave quantities blank when they have not been checked.</p>
    <div className="grid gap-2 lg:grid-cols-2">{CANONICAL_EQUIPMENT_OPTIONS.map(([key, name]) => <div key={key} className="grid grid-cols-[minmax(0,1fr)_76px] items-center gap-2 rounded-lg border border-gray-200 p-2 sm:grid-cols-[minmax(0,1fr)_68px_100px_auto]">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.available.includes(key)} onChange={(event) => toggle(key, event.target.checked, 'available')} />{name.replace(' (none)', '')}</label>
      <input type="number" aria-label={`${name} quantity`} className="w-full rounded border border-gray-300 p-1 text-sm" min={0} max={1000} placeholder="Qty"
        disabled={!value.available.includes(key) || key === 'bodyweight'} value={value.quantities?.[key] ?? ''}
        onChange={(event) => onChange({ ...value, quantities: { ...value.quantities, [key]: event.target.value === '' ? null : Number(event.target.value) } })} />
      <select aria-label={`${name} preference`} className="min-w-0 rounded border border-gray-300 p-1 text-sm" disabled={!value.available.includes(key)}
        value={value.required?.includes(key) ? 'required' : value.preferred?.includes(key) ? 'preferred' : ''}
        onChange={(event) => onChange({ ...value, preferred: [...(value.preferred ?? []).filter((item) => item !== key), ...(event.target.value === 'preferred' ? [key] : [])],
          required: [...(value.required ?? []).filter((item) => item !== key), ...(event.target.value === 'required' ? [key] : [])] })}>
        <option value="">Any use</option><option value="preferred">Prefer</option><option value="required">Require</option>
      </select>
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" aria-label={`Avoid ${name.replace(' (none)', '')}`} checked={value.excluded?.includes(key) ?? false} onChange={(event) => toggle(key, event.target.checked, 'excluded')} />Avoid</label>
    </div>)}</div>
  </fieldset>
}

export function LibraryChoiceControls({ choices, value, onChange, allowLocks = true }: { choices: Pick<WorkoutProgrammingChoices['components'][number], 'exercises' | 'methods'> | undefined;
  value: Omit<ProgrammingComponentControls, 'key'>; onChange: (patch: Partial<Pick<ProgrammingComponentControls, 'preferredExercises' | 'lockedExercises' | 'excludedExerciseCardIds' | 'preferredProgrammingMethodIds' | 'lockedProgrammingMethodIds' | 'excludedProgrammingMethodIds'>>) => void; allowLocks?: boolean }) {
  if (!choices) return <p className="text-sm text-gray-500">Load library choices below to prefer, exclude, or lock existing exercises and methods.</p>
  const exercises = choices.exercises.map((entry) => ({ id: entry.ref.deliveryProfileId, name: `${entry.name}${entry.eligibility === 'ELIGIBLE' ? '' : ' · needs evidence / review'}`, disabled: entry.eligibility === 'INELIGIBLE' }))
  const definitions = [...new Map(choices.exercises.map((entry) => [entry.ref.exerciseCardId, { id: entry.ref.exerciseCardId, name: entry.name }])).values()]
  const refs = (ids: string[]) => choices.exercises.filter((entry) => ids.includes(entry.ref.deliveryProfileId)).map((entry) => entry.ref)
  return <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
    <MultiChoice label="Preferred exercises" options={exercises} selected={value.preferredExercises?.map((entry) => entry.deliveryProfileId) ?? []} onChange={(ids) => onChange({ preferredExercises: refs(ids) })} />
    {allowLocks && <MultiChoice label="Locked exercises" options={exercises} selected={value.lockedExercises?.map((entry) => entry.deliveryProfileId) ?? []} onChange={(ids) => onChange({ lockedExercises: refs(ids) })} />}
    <MultiChoice label="Excluded exercises" options={definitions} selected={value.excludedExerciseCardIds ?? []} onChange={(ids) => onChange({ excludedExerciseCardIds: ids })} />
    <MultiChoice label="Preferred methods" options={choices.methods} selected={value.preferredProgrammingMethodIds ?? []} onChange={(ids) => onChange({ preferredProgrammingMethodIds: ids })} />
    {allowLocks && <MultiChoice label="Locked methods" options={choices.methods} selected={value.lockedProgrammingMethodIds ?? []} onChange={(ids) => onChange({ lockedProgrammingMethodIds: ids })} />}
    <MultiChoice label="Excluded methods" options={choices.methods} selected={value.excludedProgrammingMethodIds ?? []} onChange={(ids) => onChange({ excludedProgrammingMethodIds: ids })} />
  </div>
}
