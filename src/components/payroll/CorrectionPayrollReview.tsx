type Row=Record<string,unknown>
const money=(v:unknown)=>(Number(v)/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function CorrectionPayrollReview({snapshot}:{snapshot:unknown}){
 const raw=snapshot&&typeof snapshot==='object'?(snapshot as Row).employees:null
 const rows:Row[]=Array.isArray(raw)?raw.filter((r):r is Row=>!!r&&typeof r==='object'&&Array.isArray(r.correctionAuthorizations)&&r.correctionAuthorizations.length>0):[]
 if(!rows.length)return null
 return <section aria-label="Authorized payroll corrections" className="mt-4 space-y-3"><h4 className="font-black">Authorized payroll corrections</h4><p className="text-sm">These corrections are included in this payroll. Recording the final payment also applies the linked time amendment and leave adjustment.</p>{rows.map(row=><article key={String(row.employeeId)} className="space-y-2 rounded-xl border p-4 text-sm"><p className="font-bold">{String(row.employeeName)}</p>{(row.payItems as Row[]).filter(i=>i.kind==='WAGE_CORRECTION').map((item,index)=>{const correction=item.correction as Row;return <p key={index}>Authorization #{String(correction.authorizationId)} · prior-period wages: {money(item.amountCents)}</p>})}<p>Current worked hours: {((Number(row.regularMinutes)+Number(row.overtimeMinutes))/60).toFixed(2)}. Target leave accrual: {Number(row.sickLeaveAccrualMinutes)} minutes.</p><p>The amendment and leave adjustment apply on finalization. Original paid records are retained.</p></article>)}</section>
}
