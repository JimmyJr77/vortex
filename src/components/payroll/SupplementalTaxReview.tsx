type Row=Record<string,unknown>
const money=(cents:unknown)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(cents)/100)
export default function SupplementalTaxReview({tax}:{tax:unknown}){
 if(!tax||typeof tax!=='object')return null
 const t=tax as Row,b=t.aggregateBasis as Row|undefined
 if(typeof t.federalIncomeTaxCents!=='number')return null
 return <div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="font-bold">Calculated federal withholding: {money(t.federalIncomeTaxCents)}</p>{b?<><p>Aggregate basis: regular payroll {String(b.regularRunId)} · {money(b.regularWagesCents)} wages.</p><p>Earlier supplemental wages: {money(b.previousSupplementalCents)}. Prior federal withholding subtracted: {money(Number(b.regularFederalWithheldCents)+Number(b.previousFederalWithheldCents))}.</p></>:<p>Eligible federal supplemental method, including any mandatory excess rate.</p>}<p>Review the state calculation and any approval blockers separately.</p></div>
}
