import {createHash} from 'node:crypto'
import {benefitContributionReport} from './benefitContributionReport.js'
export async function carrierContributions(db,facility,start,end){
 const rows=await benefitContributionReport(db,facility,start,end)
 return rows.slice(1).map(r=>({key:createHash('sha256').update(JSON.stringify([r[10],r[2],r[4],r[6],r[11]])).digest('hex'),employeeId:r[2],employeeName:r[3],planId:r[4],planName:r[5],optionLabel:r[7],amountCents:Math.round(Number(r[8])*100),runId:r[10],paymentDate:r[0]}))
}
export async function matchCarrierContributions(db,facility,invoice,source){
 const allocation=invoice.allocation;if(!allocation)return
 const fail=message=>{throw Object.assign(new Error(message),{status:409})}
 const selections=allocation.contributions||[]
 if(!Array.isArray(selections)||selections.length>1000||selections.some(s=>!s||typeof s.key!=='string'||!Number.isSafeInteger(s.amountCents)||s.amountCents<=0)||new Set(selections.map(s=>s.key)).size!==selections.length||selections.reduce((n,s)=>n+s.amountCents,0)!==allocation.employeeContributionCents)fail('Match the employee allocation to specific retained payroll contributions.')
 const others=(await db.query(`SELECT DISTINCT ON(carrier_key,invoice_key) invoice FROM payroll_benefit_carrier_invoice WHERE facility_id=$1 AND coverage_month=$2 AND NOT(carrier_key=$3 AND invoice_key=$4) ORDER BY carrier_key,invoice_key,revision DESC`,[facility,invoice.month,invoice.carrier.toLowerCase(),invoice.invoiceNumber.toLowerCase()])).rows
 if(selections.length&&others.some(r=>r.invoice.allocation?.employeeContributionCents>0&&!r.invoice.allocation.contributions))fail('Reconcile older invoice allocations without matched payroll contributions before assigning more of this month’s deductions.')
 for(const selected of selections){const retained=source.contributions.find(s=>s.key===selected.key);if(!retained)fail('The selected payroll contribution is unavailable. Refresh the invoice evidence.')
  const used=others.reduce((sum,r)=>sum+(r.invoice.allocation?.contributions||[]).filter(s=>s.key===selected.key).reduce((n,s)=>n+s.amountCents,0),0)
  if(used+selected.amountCents>retained.amountCents)fail('A selected employee contribution is already allocated to another invoice or exceeds its retained deduction.')
 }
 allocation.contributions=selections.map(s=>({...source.contributions.find(r=>r.key===s.key),amountCents:s.amountCents})).sort((a,b)=>a.key.localeCompare(b.key))
 allocation.version=2
}
