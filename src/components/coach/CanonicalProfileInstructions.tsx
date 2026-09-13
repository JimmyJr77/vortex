import type { CanonicalDeliveryProfile } from './canonicalCardTypes'

/** Shared coaching fields for ordinary authoring and staged profile revisions. */
export function CanonicalProfileInstructions({ profile, disabled, onChange }: { profile: CanonicalDeliveryProfile; disabled: boolean;
  onChange: (changes: Partial<CanonicalDeliveryProfile>) => void }) {
  return (
  <div className="grid gap-3 md:grid-cols-2">
    <label className="text-sm">Purpose<textarea disabled={disabled} rows={2} value={profile.purpose} onChange={(event) => onChange({ purpose: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
    <label className="text-sm">Expected adaptation<textarea disabled={disabled} rows={2} value={profile.expectedAdaptation} onChange={(event) => onChange({ expectedAdaptation: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
    <label className="text-sm">Quality gate<textarea disabled={disabled} rows={2} value={profile.qualityGate} onChange={(event) => onChange({ qualityGate: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
    <label className="text-sm">Stop rules<textarea disabled={disabled} rows={2} value={profile.stopRules.join('\n')} onChange={(event) => onChange({ stopRules: event.target.value.split('\n') })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
    <label className="text-sm">Coach instructions<textarea disabled={disabled} rows={3} value={profile.coachInstructions} onChange={(event) => onChange({ coachInstructions: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
    <label className="text-sm">Athlete instructions<textarea disabled={disabled} rows={3} value={profile.athleteInstructions} onChange={(event) => onChange({ athleteInstructions: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100" /></label>
  </div>
  )
}
