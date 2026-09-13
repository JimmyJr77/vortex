import { useEffect, useRef, useState } from 'react'
import { coachFetch } from '../../coach/api'
import { programmingError, type ProgrammingAthleteCohort, type ProgrammingEvidenceChoice } from '../../coach/workoutProgramming'
import { actionClass, controlClass, Field, MultiChoice, NumberField } from './ProgrammingControls'

export interface ProgrammingRosterMember { id: number | string; name: string }
const SOURCE_LABELS = { skill_progress: 'Skill observation', assessment_result: 'Assessment result', gymnastics_evaluation: 'Gymnastics evaluation' }

export function ProgrammingAthletes({ cohort, index, members, unavailableMemberIds, sessionDate, onChange, onRemove }: {
  cohort: ProgrammingAthleteCohort; index: number; members: readonly ProgrammingRosterMember[]; unavailableMemberIds: readonly string[];
  sessionDate: string | null | undefined; onChange: (cohort: ProgrammingAthleteCohort) => void; onRemove?: () => void
}) {
  const [memberId, setMemberId] = useState('')
  const [sourceKind, setSourceKind] = useState<ProgrammingEvidenceChoice['kind']>('skill_progress')
  const [evidence, setEvidence] = useState<readonly ProgrammingEvidenceChoice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const update = (patch: Partial<ProgrammingAthleteCohort>) => onChange({ ...cohort, ...patch })
  const loadEvidence = async () => {
    controller.current?.abort()
    const operation = new AbortController(); controller.current = operation
    setLoading(true); setError(null); setEvidence([])
    try {
      const query = new URLSearchParams({ kind: sourceKind, asOfDate: sessionDate ?? new Date().toISOString().slice(0, 10) })
      const choices = await coachFetch<ProgrammingEvidenceChoice[]>(`/api/coach/workout-programming/evidence/${encodeURIComponent(memberId)}?${query}`, { signal: operation.signal })
      if (!operation.signal.aborted) setEvidence(choices)
    } catch (error) { if (!operation.signal.aborted) setError(programmingError(error)) }
    finally { if (!operation.signal.aborted) setLoading(false) }
  }
  const rosterIds = cohort.memberIds ?? []
  const roster = members.filter((member) => rosterIds.includes(String(member.id)))
  return <fieldset className="space-y-4 rounded-xl border border-gray-200 p-4">
    <legend className="px-1 font-semibold text-gray-900">Athlete group {index + 1}</legend>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <NumberField label="Athletes" min={1} max={100} value={cohort.athleteCount} onChange={(value) => update({ athleteCount: value ?? 0 })} />
      <NumberField label="Youngest age" min={5} max={99} value={cohort.ageMin} onChange={(value) => update({ ageMin: value ?? 0 })} />
      <NumberField label="Oldest age" min={5} max={99} value={cohort.ageMax} onChange={(value) => update({ ageMax: value ?? 0 })} />
      <Field label="Training experience"><select className={controlClass} value={cohort.trainingExperience} onChange={(event) => update({ trainingExperience: event.target.value as ProgrammingAthleteCohort['trainingExperience'] })}>
        <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
      </select></Field>
      <NumberField label="Training months" value={cohort.trainingAgeMonths} optional max={1200} onChange={(trainingAgeMonths) => update({ trainingAgeMonths })} />
    </div>
    <details className="rounded-lg bg-gray-50 p-3"><summary className="cursor-pointer text-sm font-semibold">Roster & existing observations · {rosterIds.length} athletes selected</summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-gray-600">Select the complete group to check individual prerequisites and recorded workload. Without a roster, the request is anonymous group planning.</p>
        <MultiChoice label={`Group ${index + 1} roster`} options={members.map((member) => ({ id: String(member.id), name: member.name, disabled: unavailableMemberIds.includes(String(member.id)) }))}
          selected={rosterIds} onChange={(memberIds) => { update({ memberIds, athleteCount: memberIds.length || cohort.athleteCount,
            evidenceReferences: cohort.evidenceReferences?.filter((entry) => memberIds.includes(entry.memberId)) }); controller.current?.abort(); setLoading(false); setMemberId(''); setEvidence([]) }} />
        {rosterIds.length > 0 && <>
          <div className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Athlete for evidence"><select className={controlClass} value={memberId} disabled={loading} onChange={(event) => { setMemberId(event.target.value); setEvidence([]) }}>
              <option value="">Select an athlete</option>{roster.map((member) => <option key={member.id} value={String(member.id)}>{member.name}</option>)}
            </select></Field>
            <Field label="Observation source"><select className={controlClass} value={sourceKind} disabled={loading} onChange={(event) => { setSourceKind(event.target.value as ProgrammingEvidenceChoice['kind']); setEvidence([]) }}>
              {Object.entries(SOURCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select></Field>
            <button className={actionClass} type="button" disabled={!memberId || loading} onClick={() => void loadEvidence()}>{loading ? 'Loading…' : 'Find observations'}</button>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {evidence.map((entry) => {
            const selected = cohort.evidenceReferences?.some((ref) => ref.kind === entry.kind && ref.id === entry.id && ref.memberId === entry.memberId)
            return <label key={`${entry.kind}:${entry.id}`} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-2 text-sm">
              <input type="checkbox" className="mt-1" checked={selected ?? false} onChange={(event) => update({ evidenceReferences: event.target.checked
                ? [...cohort.evidenceReferences ?? [], { kind: entry.kind, id: entry.id, memberId: entry.memberId, expectedSourceHash: entry.sourceHash }]
                : cohort.evidenceReferences?.filter((ref) => !(ref.kind === entry.kind && ref.id === entry.id && ref.memberId === entry.memberId)) })} />
              <span><strong>{entry.label}</strong> · {entry.measurement}<span className="block text-xs text-gray-500">{entry.observedAt.slice(0, 10)} · {entry.coachObserved ? 'Coach observation' : 'Coach attribution not recorded'}</span></span>
            </label>
          })}
          {evidence.some((entry) => entry.truncated) && <p className="text-xs text-amber-800">Showing the 25 most recent observations. Older source records remain in the athlete profile.</p>}
          <p className="text-xs text-gray-600">{cohort.evidenceReferences?.length ?? 0} source observations attached. Selecting evidence does not itself establish readiness.</p>
          {!!cohort.evidenceReferences?.length && <button type="button" className={actionClass} onClick={() => update({ evidenceReferences: [] })}>Clear attached observations</button>}
        </>}
      </div>
    </details>
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Development notes"><textarea rows={2} className={controlClass} value={cohort.maturityNotes ?? ''} maxLength={1000} onChange={(event) => update({ maturityNotes: event.target.value || null })} placeholder="Relevant development and movement experience" /></Field>
      <Field label="Limitations" hint="One existing limitation per line."><textarea rows={2} className={controlClass} value={cohort.limitations?.join('\n') ?? ''}
        onChange={(event) => update({ limitations: event.target.value.split('\n') })} placeholder="Known restrictions to respect" /></Field>
    </div>
    {onRemove && <button type="button" className={actionClass} onClick={onRemove}>Remove athlete group</button>}
  </fieldset>
}
