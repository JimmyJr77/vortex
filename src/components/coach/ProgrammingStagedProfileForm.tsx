import { useEffect, useState, type FormEvent } from 'react'
import type { Taxonomy } from '../../coach/taxonomy'
import type { StagedCanonicalRevisionChange, StagedCanonicalRevisionView } from '../../coach/workoutExerciseProposals'
import { EXERCISE_DELIVERY_LABELS } from '../../coach/workoutExerciseProposals'
import type { CanonicalDeliveryProfile } from './canonicalCardTypes'
import { CanonicalProfileInstructions } from './CanonicalProfileInstructions'
import { TaxonomyV2ScopeEditor } from './TaxonomyV2ScopeEditor'
import { actionClass, controlClass, Field, MultiChoice, NumberField } from './ProgrammingControls'

const structuredFields = [
  ['objectiveRelevance', 'Objective relevance'], ['logistics', 'Profile logistics'], ['timeModel', 'Time model'],
  ['doseScaling', 'Dose scaling'], ['measurement', 'Measurement'], ['supportPrompts', 'Support prompts'],
] as const

/** This form owns only the new profile. Source identity and existing profiles never enter its write payload. */
export function ProgrammingStagedProfileForm({ view, taxonomy, disabled, needsReload, onChange, onReload, onDirty }: {
  view: StagedCanonicalRevisionView; taxonomy: Taxonomy | null; disabled: boolean; needsReload: boolean;
  onChange: (input: StagedCanonicalRevisionChange) => void; onReload: () => void; onDirty: (dirty: boolean) => void;
}) {
  const { event } = view
  const variant = event.card.variants.find((item) => item.id === event.target.variantId)
  const original = variant?.profiles.find((item) => item.profileKey === event.target.profileKey)
  const [profile, setProfile] = useState(original)
  const [structured, setStructured] = useState(() => Object.fromEntries(structuredFields.map(([key]) => [key, JSON.stringify(original?.[key] ?? {}, null, 2)])))
  const [summary, setSummary] = useState('')
  const [resetKey, setResetKey] = useState(0)
  const parsed: Record<string, Record<string, unknown>> = {}
  const errors: string[] = []
  for (const [key, label] of structuredFields) {
    try {
      const value: unknown = JSON.parse(structured[key])
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Object required')
      parsed[key] = value as Record<string, unknown>
    } catch { errors.push(`${label} must be a valid JSON object.`) }
  }
  const dirty = JSON.stringify(profile) !== JSON.stringify(original)
    || structuredFields.some(([key]) => structured[key] !== JSON.stringify(original?.[key] ?? {}, null, 2))
  useEffect(() => { onDirty(dirty); return () => onDirty(false) }, [dirty, onDirty])
  if (!original || !profile) return <p role="alert">The proposed profile is missing. Reopen this revision before continuing.</p>
  const editable = !disabled && !needsReload && view.sourceMatches && event.state !== 'archived'
  const update = (patch: Partial<CanonicalDeliveryProfile>) => setProfile({ ...profile, ...patch })
  const updateDose = (patch: Record<string, unknown>) => update({ dosage: { ...profile.dosage, ...patch } })
  const number = (value: unknown) => typeof value === 'number' ? value : null
  const range = (field: 'sets' | 'reps', index: number) => Array.isArray(profile.dosage[field]) ? number(profile.dosage[field][index]) : null
  const updateRange = (field: 'sets' | 'reps', index: number, value: number | null) => {
    const values = [range(field, 0), range(field, 1)]; values[index] = value; updateDose({ [field]: values })
  }
  const summaryValid = summary.trim().length >= 10 && summary.length <= 2000
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!editable || !dirty || errors.length || !summaryValid) return
    onChange({ action: 'edit', expectedEventHash: event.contentHash, changeSummary: summary, profile: { ...profile, ...parsed } })
  }
  const transition = (action: 'submit' | 'return' | 'archive') => {
    if (disabled || needsReload || dirty || !summaryValid) return
    onChange({ action, expectedEventHash: event.contentHash, changeSummary: summary })
  }
  const discard = () => {
    setProfile(original); setStructured(Object.fromEntries(structuredFields.map(([key]) => [key, JSON.stringify(original[key], null, 2)])))
    setSummary(''); setResetKey((value) => value + 1)
  }
  return <div className="space-y-4">
    <div className="rounded-lg bg-indigo-50 p-3 text-sm">
      <p className="font-semibold">{event.card.displayName} · {variant?.displayName}</p>
      <p>{EXERCISE_DELIVERY_LABELS[event.target.phaseKey] ?? event.target.phaseKey} · {event.target.profileKey} · Proposed version {event.card.cardVersion}</p>
      <p role="status">Revision status: <strong>{event.state === 'review' ? 'Awaiting review' : event.state === 'archived' ? 'Archived' : 'Draft'}</strong> · Saved {new Date(event.createdAt).toLocaleString()}</p>
    </div>
    {!view.sourceMatches && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">The published source changed. Editing and review submission are paused. Research the current card to prepare a new proposal, or archive this revision.</p>}
    <p className="text-sm text-gray-600">Submission prepares this revision for human review. Approval and publication are not yet available here.</p>
    <details><summary className="cursor-pointer text-sm font-semibold">Publication readiness findings · {event.readiness.issues.length}</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{event.readiness.issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul></details>
    <form onSubmit={submit} className="space-y-4" aria-label="Edit staged delivery profile">
      <fieldset disabled={!editable} className="min-w-0 space-y-4" key={resetKey}>
        <legend className="mb-3 font-semibold">Proposed profile</legend>
        <CanonicalProfileInstructions profile={profile} disabled={!editable} onChange={update} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="Minimum sets" min={1} value={range('sets', 0)} onChange={(value) => updateRange('sets', 0, value)} />
          <NumberField label="Maximum sets" min={1} value={range('sets', 1)} onChange={(value) => updateRange('sets', 1, value)} />
          <Field label="Repetition prescription"><select className={controlClass} value={profile.dosage.reps == null ? 'timed' : 'reps'} onChange={(e) => updateDose({ reps: e.target.value === 'timed' ? null : [null, null] })}>
            <option value="reps">Repetitions</option><option value="timed">Timed work only</option></select></Field>
          {profile.dosage.reps != null && <><NumberField label="Minimum repetitions" min={1} value={range('reps', 0)} onChange={(value) => updateRange('reps', 0, value)} />
            <NumberField label="Maximum repetitions" min={1} value={range('reps', 1)} onChange={(value) => updateRange('reps', 1, value)} /></>}
          <NumberField label="Work seconds" min={1} optional={profile.dosage.reps != null} value={number(profile.dosage.workSeconds)} onChange={(value) => updateDose({ workSeconds: value })} />
          <NumberField label="Rest seconds" value={number(profile.dosage.restSeconds)} onChange={(value) => updateDose({ restSeconds: value })} />
          <NumberField label="Phase suitability" min={1} max={100} value={profile.phaseSuitability} onChange={(value) => update({ phaseSuitability: value ?? 0 })} />
          <NumberField label="Methodology alignment" min={1} max={100} value={profile.methodologyAlignment} onChange={(value) => update({ methodologyAlignment: value ?? 0 })} />
        </div>
        <MultiChoice label="Profile required equipment" options={(taxonomy?.equipment ?? []).map((term) => ({ id: term.key, name: term.name }))}
          selected={profile.equipmentRequired} onChange={(equipmentRequired) => update({ equipmentRequired })} />
        <details><summary className="cursor-pointer text-sm font-semibold">Profile classifications</summary><div className="mt-3">
          {taxonomy?.taxonomyV2 ? <TaxonomyV2ScopeEditor title="Delivery profile classifications" scope="delivery_profile" block={profile.taxonomyV2} catalog={taxonomy.taxonomyV2}
            disabled={!editable} onChange={(taxonomyV2) => update({ taxonomyV2 })} /> : <p className="text-sm text-gray-600">Controlled classifications are unavailable. Existing suggestions are retained.</p>}
        </div></details>
        <details><summary className="cursor-pointer text-sm font-semibold">Advanced programming fields</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">{structuredFields.map(([key, label]) => <Field key={key} label={label}>
            <textarea rows={5} className={`${controlClass} font-mono text-xs`} value={structured[key]} onChange={(e) => setStructured({ ...structured, [key]: e.target.value })} />
          </Field>)}</div></details>
      </fieldset>
      {errors.length > 0 && <ul role="alert" className="list-disc pl-5 text-sm text-amber-900">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
      {event.state !== 'archived' && <Field label="Revision change summary" hint="Describe the edit or the reason for this review action (10–2000 characters).">
        <textarea disabled={disabled} minLength={10} maxLength={2000} required rows={2} className={controlClass} value={summary} onChange={(e) => setSummary(e.target.value)} /></Field>}
      {dirty && <p role="status" className="text-sm text-amber-900">Unsaved profile changes. Save or discard them before changing review status or leaving this proposal.</p>}
      <div className="flex flex-wrap gap-2">
        {event.state !== 'archived' && <button type="submit" className={actionClass} disabled={!editable || !dirty || !!errors.length || !summaryValid}>Save profile changes</button>}
        {dirty && <button type="button" className={actionClass} disabled={disabled} onClick={discard}>Discard profile changes</button>}
        {event.state === 'draft' && <button type="button" className={actionClass} disabled={!editable || dirty || !summaryValid} onClick={() => transition('submit')}>Submit revision for review</button>}
        {event.state === 'review' && <button type="button" className={actionClass} disabled={!editable || dirty || !summaryValid} onClick={() => transition('return')}>Return revision to draft</button>}
        {event.state !== 'archived' && <button type="button" className={actionClass} disabled={disabled || needsReload || dirty || !summaryValid} onClick={() => transition('archive')}>Archive revision</button>}
        <button type="button" className={actionClass} disabled={disabled || dirty} onClick={onReload}>Refresh staged revision</button>
      </div>
    </form>
  </div>
}
