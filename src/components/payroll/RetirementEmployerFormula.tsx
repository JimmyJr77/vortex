export type EmployerFormula = {
  period: string
  matchCatchUp: boolean
  matchTiers: Array<{upToBps: number; matchBps: number}>
  nonelectiveBps: number
  compensation: Record<string, boolean>
  eligibilityTerms: string
  vestingTerms: string
}
const kinds = [['REGULAR', 'Regular wages'], ['OVERTIME', 'Overtime wages'], ['BONUS', 'Bonuses'], ['PAID_LEAVE', 'Paid leave']] as const
const input = 'mt-1 block w-full rounded-lg border border-slate-300 p-2'
const percent = (text: string) => /^\d+(\.\d{1,2})?$/.test(text) ? Number(text.replace('.', '')) * (text.includes('.') ? 10 ** (2 - text.split('.')[1].length) : 100) : null
export function employerFormulaFromForm(form: Record<string,string>) {
  if(form['employer-formula-review'] !== 'REVIEWED') return undefined
  const matching = ['MATCH', 'MATCH_AND_NONELECTIVE'].includes(form.employerContributions)
  const nonelective = ['NONELECTIVE', 'MATCH_AND_NONELECTIVE'].includes(form.employerContributions)
  return {
    period: form['employer-period'] || '',
    matchCatchUp: matching ? form['employer-matchCatchUp'] === 'true' ? true : form['employer-matchCatchUp'] === 'false' ? false : null : false,
    matchTiers: matching ? Array.from({length: Number(form['employer-tier-count'] || 1)}, (_, index) => ({upToBps: percent(form[`employer-ceiling-${index}`] || ''), matchBps: percent(form[`employer-rate-${index}`] || '')})) : [],
    nonelectiveBps: nonelective ? percent(form['employer-nonelective'] || '') : 0,
    compensation: Object.fromEntries(kinds.map(([key]) => [key, form[`employer-comp-${key}`] === 'true' ? true : form[`employer-comp-${key}`] === 'false' ? false : null])),
    eligibilityTerms: form['employer-eligibility'] || '',
    vestingTerms: form['employer-vesting'] || '',
  }
}
export function employerFormulaToForm(formula?: EmployerFormula): Record<string,string> {
  if(!formula) return {}
  return {
    'employer-formula-review': 'REVIEWED', 'employer-period': formula.period,
    'employer-matchCatchUp': String(formula.matchCatchUp), 'employer-nonelective': String(formula.nonelectiveBps / 100),
    'employer-tier-count': String(formula.matchTiers.length || 1),
    ...Object.fromEntries(formula.matchTiers.flatMap((tier,index) => [[`employer-ceiling-${index}`, String(tier.upToBps / 100)], [`employer-rate-${index}`, String(tier.matchBps / 100)]])),
    ...Object.fromEntries(kinds.map(([key]) => [`employer-comp-${key}`, String(formula.compensation[key])])),
    'employer-eligibility': formula.eligibilityTerms, 'employer-vesting': formula.vestingTerms,
  }
}
export function EmployerFormulaSummary({formula}: {formula?: EmployerFormula}) {
  if(!formula) return <p>Structured employer funding formula has not been reviewed.</p>
  return <div className="space-y-1 break-words">
    <p className="font-bold">Retained employer funding formula</p>
    <p>{formula.period === 'PER_PAYROLL' ? 'Per payroll' : 'Annual formula with true-up'}</p>
    {formula.matchTiers.map((tier,index) => <p key={index}>Match {tier.matchBps / 100}% of deferrals between {index ? formula.matchTiers[index-1].upToBps / 100 : 0}% and {tier.upToBps / 100}% of eligible compensation.</p>)}
    {formula.matchTiers.length ? <p>Catch-up deferrals in matching: {formula.matchCatchUp ? 'Included' : 'Excluded'}</p> : null}
    <p>Nonelective contribution: {formula.nonelectiveBps / 100}% of eligible compensation.</p>
    {kinds.map(([key,label]) => <p key={key}>{label}: {formula.compensation[key] ? 'Included' : 'Excluded'}</p>)}
    <p className="whitespace-pre-wrap">Eligibility: {formula.eligibilityTerms}</p>
    <p className="whitespace-pre-wrap">Vesting: {formula.vestingTerms}</p>
  </div>
}
export default function RetirementEmployerFormula({form, set}: {form: Record<string,string>; set: (key:string,value:string)=>void}) {
  const matching = ['MATCH','MATCH_AND_NONELECTIVE'].includes(form.employerContributions)
  const nonelective = ['NONELECTIVE','MATCH_AND_NONELECTIVE'].includes(form.employerContributions)
  if(!matching && !nonelective) return null
  const count = Number(form['employer-tier-count'] || 1)
  return <section aria-label="Employer funding formula" className="space-y-3 rounded-lg border p-3 sm:col-span-2">
    <h4 className="font-bold">Employer funding formula</h4>
    <p>Record the signed plan’s formula. Payroll calculation and remittance of employer funding are not yet available.</p>
    <label className="block">Structured employer formula review<select value={form['employer-formula-review'] || 'UNREVIEWED'} onChange={e=>set('employer-formula-review',e.target.value)} className={input}><option value="UNREVIEWED">Not yet reviewed</option><option value="REVIEWED">Record reviewed formula</option></select></label>
    {form['employer-formula-review'] === 'REVIEWED' ? <>
      <label className="block">Employer formula period<select value={form['employer-period'] || ''} onChange={e=>set('employer-period',e.target.value)} className={input}><option value="">Review period</option><option value="PER_PAYROLL">Per payroll</option><option value="ANNUAL_TRUE_UP">Annual formula with true-up</option></select></label>
      {matching ? <>
        <p>Each tier ends at a cumulative percentage of eligible compensation. The match rate applies only to deferrals within that band.</p>
        {Array.from({length: count},(_,index)=><div key={index} className="space-y-2 rounded border p-2">
          <label className="block">Tier {index+1} compensation ceiling (%)<input type="number" min="0" max="100" step="0.01" value={form[`employer-ceiling-${index}`] || ''} onChange={e=>set(`employer-ceiling-${index}`,e.target.value)} className={input}/></label>
          <label className="block">Tier {index+1} match rate (%)<input type="number" min="0" max="1000" step="0.01" value={form[`employer-rate-${index}`] || ''} onChange={e=>set(`employer-rate-${index}`,e.target.value)} className={input}/></label>
        </div>)}
        <div className="flex flex-wrap gap-2"><button type="button" disabled={count>=10} onClick={()=>set('employer-tier-count',String(count+1))} className="rounded border p-2">Add matching tier</button><button type="button" disabled={count<=1} onClick={()=>set('employer-tier-count',String(count-1))} className="rounded border p-2">Remove last matching tier</button></div>
        <label className="block">Match catch-up deferrals<select value={form['employer-matchCatchUp'] || ''} onChange={e=>set('employer-matchCatchUp',e.target.value)} className={input}><option value="">Review treatment</option><option value="true">Included</option><option value="false">Excluded</option></select></label>
      </> : null}
      {nonelective ? <label className="block">Nonelective contribution (%)<input type="number" min="0" max="100" step="0.01" value={form['employer-nonelective'] || ''} onChange={e=>set('employer-nonelective',e.target.value)} className={input}/></label> : null}
      {kinds.map(([key,label])=><label key={key} className="block">{label} in employer compensation<select value={form[`employer-comp-${key}`] || ''} onChange={e=>set(`employer-comp-${key}`,e.target.value)} className={input}><option value="">Review definition</option><option value="true">Included</option><option value="false">Excluded</option></select></label>)}
      <label className="block">Employer contribution eligibility and plan reference<textarea value={form['employer-eligibility'] || ''} onChange={e=>set('employer-eligibility',e.target.value)} maxLength={4000} rows={3} className={input}/></label>
      <label className="block">Employer contribution vesting and plan reference<textarea value={form['employer-vesting'] || ''} onChange={e=>set('employer-vesting',e.target.value)} maxLength={4000} rows={3} className={input}/></label>
    </> : null}
  </section>
}
