import type { CanonicalMediaReviewDraft } from './canonicalMediaReviewDraft'

/** Human observations start blank. Previously recorded evidence is never an attestation default. */
export function CanonicalMediaReviewFields({ value, onChange, disabled = false }: {
  value: CanonicalMediaReviewDraft; onChange: (value: CanonicalMediaReviewDraft) => void; disabled?: boolean;
}) {
  const control = 'mt-1 w-full rounded border border-indigo-200 px-3 py-2'
  return <fieldset disabled={disabled} className="min-w-0 space-y-3">
    <legend className="sr-only">Media observations</legend>
    <div className="grid gap-3 md:grid-cols-3">
      <label className="text-sm">Observed demonstration quality (1–100)<input type="number" min={1} max={100} value={value.score}
        onChange={(event) => onChange({ ...value, score: event.target.value === '' ? '' : Number(event.target.value) })} className={control} /></label>
      <label className="text-sm">Playback status<select value={value.linkStatus}
        onChange={(event) => onChange({ ...value, linkStatus: event.target.value as CanonicalMediaReviewDraft['linkStatus'] })} className={control}>
        <option value="">Select observed status</option><option value="healthy">Healthy</option><option value="broken">Broken</option><option value="mismatched">Mismatched</option>
      </select></label>
      <label className="text-sm">Exact card match<select value={value.exactVariantMatch == null ? '' : value.exactVariantMatch ? 'yes' : 'no'}
        onChange={(event) => onChange({ ...value, exactVariantMatch: event.target.value === '' ? null : event.target.value === 'yes' })} className={control}>
        <option value="">Select observed match</option><option value="yes">Yes — exact match</option><option value="no">No — not exact</option>
      </select></label>
    </div>
    <label className="block text-sm">Observed review evidence<textarea rows={3} minLength={20} maxLength={2000} value={value.notes}
      onChange={(event) => onChange({ ...value, notes: event.target.value })}
      placeholder="Document playback behavior, exact task comparison, and any accessibility limitation observed." className={control} /></label>
    <fieldset className="rounded border border-indigo-200 bg-white p-3">
      <legend className="px-1 text-xs font-semibold text-indigo-950">Manual-review attestations</legend>
      <p className="mb-2 text-xs text-indigo-900">These record what you personally checked; they do not make a candidate video approved on their own.</p>
      {([
        ['playbackReviewed', 'I watched the current asset through its relevant demonstration.'],
        ['exactVariantCompared', 'I compared the demonstrated task with this card’s exact variant.'],
        ['linkChecked', 'I checked that the selected URL resolves to the observed asset.'],
        ['accessibilityChecked', 'I checked captions, transcript, stills, or other access support that is available.'],
      ] as const).map(([key, label]) => <label key={key} className="mt-1 flex items-start gap-2 text-xs text-gray-800">
        <input type="checkbox" checked={value.basis[key]} onChange={(event) => onChange({ ...value, basis: { ...value.basis, [key]: event.target.checked } })} />{label}
      </label>)}
    </fieldset>
  </fieldset>
}
