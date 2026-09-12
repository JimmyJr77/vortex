import {createHash} from 'node:crypto'
import {monthlyBenefitsFixture} from './monthlyBenefitsFixture.js'
export async function carrierInvoiceHistoryFixture(h){
 const {api}=await monthlyBenefitsFixture(h),source=(await api('/benefit-carrier-invoices?month=2026-09')).source
 const invoice=await api('/benefit-carrier-invoices',{month:'2026-09',carrier:'Synthetic History Carrier',invoiceNumber:'HISTORY-SEP',invoiceDate:'2026-09-01',dueDate:'2026-09-30',amountCents:57500,reference:'Synthetic history invoice reference',reconciliation:'Reviewed synthetic carrier invoice evidence for pagination',confirmed:true,fingerprint:source.fingerprint})
 let previous=null
 const append=async(index,at='2026-09-11T12:00:00.000001Z')=>{
  const assessment={invoiceId:invoice.id,invoiceRevision:1,invoiceAmountCents:57500,status:'OPEN',authorizedCents:0,bankConfirmedCents:0,appliedCents:0,reconciledCents:0,unreservedCents:57500,remainingToApplyCents:57500,issues:[`Synthetic historical review ${index}`],payments:[]}
  previous=(await h.pool.query('INSERT INTO payroll_carrier_invoice_assessment(invoice_id,facility_id,previous_id,fingerprint,assessment,created_at) VALUES($1,1,$2,$3,$4,$5) RETURNING id',[invoice.id,previous,createHash('sha256').update(JSON.stringify(assessment)).digest('hex'),assessment,at])).rows[0].id
  return String(previous)
 }
 for(let i=1;i<=25;i++)await append(i,i>20?'2026-09-11T12:00:00.000002Z':undefined)
 await h.pool.query("INSERT INTO payroll_carrier_invoice_check(invoice_id,facility_id,status,message,checked_at) VALUES($1,1,'FAILED','Synthetic retained invoice failure','2026-09-11T12:00:00.000001Z')",[invoice.id])
 return {api,invoice,append}
}
