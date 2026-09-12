import type {CorrectionWorkweekAmountsData} from '../../utils/workforceApi'
const money=(value:number)=>(value/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function CorrectionWorkweekAmounts({amounts}:{amounts:CorrectionWorkweekAmountsData}){
 if(amounts.workweekPaymentVersion!==1||!amounts.originalWorkweekPayments||!amounts.proposedWorkweekPayments)return null
 const weeks=[...new Set([...amounts.originalWorkweekPayments,...amounts.proposedWorkweekPayments].map(w=>w.week))].sort()
 return <section aria-label="Correction workweek amounts" className="mt-2 space-y-2 rounded border p-2 text-sm"><p className="font-semibold">Workweek amounts</p><p>Straight-time includes base pay for overtime hours. The premium is the additional overtime pay.</p>{weeks.map(week=>{
  const before=amounts.originalWorkweekPayments?.find(w=>w.week===week),after=amounts.proposedWorkweekPayments?.find(w=>w.week===week)
  return <div key={week}><p className="font-semibold">Workweek starting {week}</p><p>Straight-time wages: {money(before?.straightTimePayCents??0)} → {money(after?.straightTimePayCents??0)}</p><p>Overtime premium: {money(before?.premiumCents??0)} → {money(after?.premiumCents??0)}</p></div>
 })}</section>
}
