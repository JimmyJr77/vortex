import { button, input } from './shared'

export interface LeadFilterValues { contacted: string; followUp: string; converted: string; ageMin: string; ageMax: string; gender: string }

export default function LeadFilters({ value, onChange, search, onSearch, keywords, onKeywords, onReset }: {
  value: LeadFilterValues; onChange: (patch: Partial<LeadFilterValues>) => void
  search: string; onSearch: (value: string) => void; keywords: string; onKeywords: (value: string) => void; onReset: () => void
}) {
  return <section aria-label="Lead filters" className="mb-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium">Name, email, phone<input className={input} maxLength={200} value={search} onChange={event => onSearch(event.target.value)} placeholder="Search lead contact details" /></label>
      <label className="text-sm font-medium">Keywords<input className={input} maxLength={200} value={keywords} onChange={event => onKeywords(event.target.value)} placeholder="Inquiry, interests, or notes" /></label>
    </div>
    <div className="flex flex-wrap items-end gap-4">
      <fieldset className="min-w-0"><legend className="mb-2 text-sm font-medium">Contact</legend><div className="flex flex-wrap gap-1">
        {[['', 'All'], ['false', 'Not contacted']].map(([key, label]) => <button key={key} type="button" className={`${button} ${value.contacted === key && (key !== '' || value.followUp !== 'true') ? '!border-slate-950 !bg-slate-950 !text-white' : ''}`} aria-pressed={value.contacted === key && (key !== '' || value.followUp !== 'true')} onClick={() => onChange(key === '' ? { contacted: '', followUp: '' } : { contacted: key })}>{label}</button>)}
        <button type="button" className={`${button} ${value.followUp === 'true' ? '!border-slate-950 !bg-slate-950 !text-white' : ''}`} aria-pressed={value.followUp === 'true'} onClick={() => onChange({ followUp: value.followUp === 'true' ? '' : 'true' })}>Follow-up Needed</button>
        <button type="button" className={`${button} ${value.contacted === 'true' ? '!border-slate-950 !bg-slate-950 !text-white' : ''}`} aria-pressed={value.contacted === 'true'} onClick={() => onChange({ contacted: 'true' })}>Contacted</button>
      </div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-medium">Conversion</legend><div className="flex flex-wrap gap-1">{[['', 'All'], ['false', 'Unconverted'], ['true', 'Converted']].map(([key, label]) => <button key={key} type="button" className={`${button} ${value.converted === key ? '!border-slate-950 !bg-slate-950 !text-white' : ''}`} aria-pressed={value.converted === key} onClick={() => onChange({ converted: key })}>{label}</button>)}</div></fieldset>
      <div className="flex gap-2"><label className="w-28 text-sm font-medium">Min age<input className={input} type="number" min={0} max={120} step={1} value={value.ageMin} onChange={event => onChange({ ageMin: event.target.value })} placeholder="Any" /></label><label className="w-28 text-sm font-medium">Max age<input className={input} type="number" min={0} max={120} step={1} value={value.ageMax} onChange={event => onChange({ ageMax: event.target.value })} placeholder="Any" /></label></div>
      <label className="min-w-40 text-sm font-medium">Gender (kid)<select aria-label="Gender (kid)" className={input} value={value.gender} onChange={event => onChange({ gender: event.target.value })}><option value="">Any gender</option><option value="female">Female</option><option value="male">Male</option></select></label>
      <button type="button" className={`${button} ml-auto mb-0.5`} onClick={onReset}>Reset filters</button>
    </div>
  </section>
}
