import { button, input } from './shared'

export type LeadParticipation = '' | 'free_trial' | 'drop_in' | 'recent_drop'
export interface LeadFilterValues { contacted: string; followUp: string; ageMin: string; ageMax: string; gender: string; participation: LeadParticipation }

export default function LeadFilters({ value, onChange, search, onSearch, keywords, onKeywords, onReset }: {
  value: LeadFilterValues; onChange: (patch: Partial<LeadFilterValues>) => void
  search: string; onSearch: (value: string) => void; keywords: string; onKeywords: (value: string) => void; onReset: () => void
}) {
  return <section aria-label="Lead filters" className="mb-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium">Name, email, phone<input className={input} maxLength={200} value={search} onChange={event => onSearch(event.target.value)} placeholder="Search parent or child names, email, or phone" /></label>
      <label className="text-sm font-medium">Keywords<input className={input} maxLength={200} value={keywords} onChange={event => onKeywords(event.target.value)} placeholder="Inquiry, interests, or notes" /></label>
    </div>
    <fieldset><legend className="mb-2 text-sm font-medium">Participation</legend>
      <div className="flex flex-wrap gap-2">
        {([['', 'All lead types'], ['free_trial', 'Free trials'], ['drop_in', 'Drop-ins'], ['recent_drop', 'Recent drops']] as const).map(([key, label]) => <button key={key} type="button" className={`${button} aria-pressed:border-sky-600 aria-pressed:bg-sky-50 aria-pressed:text-sky-800`} aria-pressed={value.participation === key} onClick={() => onChange({ participation: value.participation === key ? '' : key })}>{label}</button>)}
      </div>
      {value.participation ? <p className="mt-2 text-xs text-slate-500">{value.participation === 'recent_drop' ? 'Class enrollments dropped in the past 90 days. Class swaps are excluded. ' : ''}Includes matching active and converted leads.</p> : null}
    </fieldset>
    <div className="flex flex-wrap items-end gap-4">
      <fieldset className="min-w-0"><legend className="mb-2 text-sm font-medium">Contact</legend><div className="flex flex-wrap gap-1">
        {[['', 'All'], ['false', 'Not contacted']].map(([key, label]) => <button key={key} type="button" className={button} aria-pressed={value.contacted === key && (key !== '' || value.followUp !== 'true')} onClick={() => onChange(key === '' ? { contacted: '', followUp: '' } : { contacted: key })}>{label}</button>)}
        <button type="button" className={button} aria-pressed={value.followUp === 'true'} onClick={() => onChange({ followUp: value.followUp === 'true' ? '' : 'true' })}>Follow-up Needed</button>
        <button type="button" className={button} aria-pressed={value.contacted === 'true'} onClick={() => onChange({ contacted: 'true' })}>Contacted</button>
      </div></fieldset>
      <div className="flex gap-2"><label className="w-28 text-sm font-medium">Min age<input className={input} type="number" min={0} max={120} step={1} value={value.ageMin} onChange={event => onChange({ ageMin: event.target.value })} placeholder="Any" /></label><label className="w-28 text-sm font-medium">Max age<input className={input} type="number" min={0} max={120} step={1} value={value.ageMax} onChange={event => onChange({ ageMax: event.target.value })} placeholder="Any" /></label></div>
      <label className="min-w-40 text-sm font-medium">Gender (kid)<select aria-label="Gender (kid)" className={input} value={value.gender} onChange={event => onChange({ gender: event.target.value })}><option value="">Any gender</option><option value="female">Female</option><option value="male">Male</option></select></label>
      <button type="button" className={`${button} ml-auto mb-0.5`} onClick={onReset}>Reset filters</button>
    </div>
  </section>
}
