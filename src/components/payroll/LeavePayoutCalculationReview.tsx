import SupplementalTaxReview from './SupplementalTaxReview'
type Row=Record<string,unknown>
const money=(cents:unknown)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(cents)/100)
export default function LeavePayoutCalculationReview({snapshot}:{snapshot:unknown}){
 const raw=snapshot&&typeof snapshot==='object'?(snapshot as Row).employees:null
 const rows:Row[]=Array.isArray(raw)?raw.filter((row):row is Row=>!!row&&typeof row==='object'&&Array.isArray(row.payItems)&&row.payItems.some((p:Row)=>p.kind==='LEAVE_PAYOUT')):[]
 if(!rows.length)return null
 return <section aria-label="PTO payout calculation review" className="mt-4 space-y-3"><h4 className="font-black">PTO payout calculation review</h4>{rows.map(row=><article className="rounded-xl border border-slate-200 p-4 text-sm" key={String(row.employeeId)}><p className="font-bold">{String(row.employeeName)}</p>{(row.payItems as Row[]).filter(p=>p.kind==='LEAVE_PAYOUT').map(item=>{const payout=item.leavePayout as Row;return <p className="mt-2" key={String(payout.id)}>Payout #{String(payout.id)} · {Number(item.minutes)/60} unused PTO hours at {money(payout.hourlyRateCents)}/hour · {money(item.amountCents)}</p>})}<SupplementalTaxReview tax={row.supplementalTax}/><p className="mt-2 text-slate-600">Taxable vacation payout. These hours do not count as work or earn additional leave. Finalizing payment deducts the reserved hours.</p><p className="mt-2 text-slate-600">{String(row.withholdingMethod).includes('pto-aggregate')?'Withholding combines this payout with regular wages.':'Review the withholding calculation and approval blockers before payment.'}</p></article>)}</section>
}
