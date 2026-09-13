import type { TaxonomyV2Catalog } from '../../coach/taxonomy'
import type { CanonicalTaxonomyV2Block } from './canonicalCardTypes'

const TAXONOMY_FACETS_BY_SCOPE = {
  definition: ['training_family', 'movement_character'],
  variant: ['movement_character', 'force_velocity'],
  delivery_profile: [
    'tenet',
    'methodology',
    'athletic_niche',
    'programming_set_structure',
    'programming_clock_structure',
    'conditioning_protocol',
    'physiology_mechanism',
  ],
} as const

const TAXONOMY_FACET_LABELS: Record<string, string> = {
  tenet: 'Athleticism tenet',
  methodology: 'Methodology',
  training_family: 'Training family',
  athletic_niche: 'Athletic niche',
  force_velocity: 'Force–velocity emphasis',
  movement_character: 'Movement character',
  programming_set_structure: 'Set structure',
  programming_clock_structure: 'Clock structure',
  conditioning_protocol: 'Conditioning protocol',
  physiology_mechanism: 'Physiology mechanism',
}

export function TaxonomyV2ScopeEditor({
  title,
  scope,
  block,
  catalog,
  disabled,
  onChange,
}: {
  title: string
  scope: keyof typeof TAXONOMY_FACETS_BY_SCOPE
  block: CanonicalTaxonomyV2Block | null | undefined
  catalog: TaxonomyV2Catalog | undefined
  disabled: boolean
  onChange: (next: CanonicalTaxonomyV2Block) => void
}) {
  const value = block ?? { assignments: [], decisions: [] }
  const updateDecision = (facetType: string, decision: 'classified' | 'not_applicable' | null) => {
    const withoutFacet = value.decisions.filter((entry) => entry.facetType !== facetType)
    onChange({
      ...value,
      assignments: decision === 'not_applicable'
        ? value.assignments.filter((entry) => entry.facetType !== facetType)
        : value.assignments,
      decisions: decision == null ? withoutFacet : [...withoutFacet, {
        facetType,
        scope,
        decision,
        rationale: decision === 'not_applicable' ? '' : null,
        confidence: 50,
        reviewStatus: 'suggested',
      }],
    })
  }
  return (
    <fieldset className="rounded-lg border border-gray-200 p-3">
      <legend className="px-1 text-sm font-semibold text-gray-900">{title}</legend>
      <div className="space-y-3">
        {TAXONOMY_FACETS_BY_SCOPE[scope].map((facetType) => {
          const assignments = value.assignments.filter((entry) => entry.facetType === facetType)
          const decision = value.decisions.find((entry) => entry.facetType === facetType)
          const terms = catalog?.facets[facetType] ?? []
          return (
            <div key={facetType} className="rounded border border-gray-100 bg-gray-50 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-800">{TAXONOMY_FACET_LABELS[facetType] ?? facetType}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${assignments.length || decision?.decision === 'not_applicable' ? decision?.reviewStatus === 'approved' || assignments.some((entry) => entry.reviewStatus === 'approved') ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                  {assignments.length || decision?.decision === 'not_applicable'
                    ? decision?.reviewStatus === 'approved' || assignments.some((entry) => entry.reviewStatus === 'approved') ? 'reviewed' : 'review required'
                    : 'missing'}
                </span>
              </div>
              {!disabled && decision?.decision !== 'not_applicable' && (
                <select
                  aria-label={`Add ${TAXONOMY_FACET_LABELS[facetType] ?? facetType} term`}
                  value=""
                  onChange={(event) => {
                    const term = terms.find((entry) => entry.key === event.target.value)
                    if (!term || assignments.some((entry) => entry.key === term.key)) return
                    onChange({
                      assignments: [...value.assignments, {
                        facetType,
                        key: term.key,
                        name: term.name,
                        scope,
                        role: assignments.length === 0 ? 'primary' : 'secondary',
                        weight: assignments.length === 0 ? 5 : 3,
                        confidence: 50,
                        reviewStatus: 'suggested',
                      }],
                      decisions: [
                        ...value.decisions.filter((entry) => entry.facetType !== facetType),
                        { facetType, scope, decision: 'classified', confidence: 50, reviewStatus: 'suggested' },
                      ],
                    })
                  }}
                  className="mt-2 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="">Add controlled term…</option>
                  {terms.filter((term) => !assignments.some((entry) => entry.key === term.key)).map((term) => (
                    <option key={term.id} value={term.key}>{term.name}{term.domain ? ` · ${term.domain.replaceAll('_', ' ')}` : ''}</option>
                  ))}
                </select>
              )}
              <div className="mt-2 space-y-1">
                {assignments.map((assignment) => (
                  <div key={`${facetType}:${assignment.key}`} className="flex flex-wrap items-center gap-2 rounded bg-white px-2 py-1 text-xs">
                    <span className="min-w-32 flex-1 font-medium">{assignment.name ?? terms.find((term) => term.key === assignment.key)?.name ?? assignment.key}</span>
                    <select aria-label={`${assignment.name ?? assignment.key} role`} disabled={disabled} value={assignment.role} onChange={(event) => onChange({
                      ...value,
                      assignments: value.assignments.map((entry) => entry === assignment ? { ...entry, role: event.target.value as typeof entry.role, reviewStatus: 'suggested' } : entry),
                    })} className="rounded border border-gray-300 px-1 py-0.5">
                      {['primary', 'secondary', 'compatible', 'incompatible', 'default'].map((role) => <option key={role}>{role}</option>)}
                    </select>
                    <label>weight <input disabled={disabled} type="number" min={1} max={5} value={assignment.weight} onChange={(event) => onChange({
                      ...value,
                      assignments: value.assignments.map((entry) => entry === assignment ? { ...entry, weight: Number(event.target.value), reviewStatus: 'suggested' } : entry),
                    })} className="w-12 rounded border border-gray-300 px-1 py-0.5" /></label>
                    {!disabled && <button type="button" onClick={() => {
                      const remaining = value.assignments.filter((entry) => entry !== assignment)
                      onChange({
                        assignments: remaining,
                        decisions: remaining.some((entry) => entry.facetType === facetType)
                          ? value.decisions
                          : value.decisions.filter((entry) => entry.facetType !== facetType),
                      })
                    }} className="text-red-700">Remove</button>}
                  </div>
                ))}
              </div>
              {!disabled && assignments.length === 0 && (
                <button type="button" onClick={() => updateDecision(facetType, decision?.decision === 'not_applicable' ? null : 'not_applicable')} className="mt-2 text-xs font-medium text-indigo-700">
                  {decision?.decision === 'not_applicable' ? 'Clear not-applicable decision' : 'Mark not applicable'}
                </button>
              )}
              {decision?.decision === 'not_applicable' && (
                <label className="mt-2 block text-xs">Required rationale
                  <input disabled={disabled} value={decision.rationale ?? ''} onChange={(event) => onChange({
                    ...value,
                    decisions: value.decisions.map((entry) => entry === decision ? { ...entry, rationale: event.target.value, reviewStatus: 'suggested' } : entry),
                  })} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5" />
                </label>
              )}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
