import {carrierApplicationState} from './carrierApplication.js'

export function summarizeCarrierInvoicePayments(invoice,payments,{historical=false}={}){
 const amount=invoice.invoice.amountCents
 const total=key=>payments.reduce((sum,p)=>sum+p[key],0)
 const authorizedCents=total('amountCents'),bankConfirmedCents=total('bankConfirmedCents'),appliedCents=total('appliedCents'),reconciledCents=total('reconciledCents')
 const valid=payments.every(p=>[p.amountCents,p.bankConfirmedCents,p.appliedCents,p.reconciledCents].every(n=>Number.isSafeInteger(n)&&n>=0)&&p.amountCents>0&&p.reconciledCents<=p.appliedCents&&p.appliedCents<=p.bankConfirmedCents&&p.bankConfirmedCents<=p.amountCents)&&[amount,authorizedCents,bankConfirmedCents,appliedCents,reconciledCents].every(n=>Number.isSafeInteger(n)&&n>=0)&&amount>0&&authorizedCents<=amount&&bankConfirmedCents<=authorizedCents&&appliedCents<=bankConfirmedCents&&reconciledCents<=appliedCents
 const allCurrent=payments.every(p=>p.invoiceId===invoice.id&&p.outsideActivityReviewed===true)
 return {invoiceId:invoice.id,invoiceRevision:Number(invoice.revision),historical,status:valid&&allCurrent&&reconciledCents===amount?'RECONCILED':'OPEN',invoiceAmountCents:amount,authorizedCents,bankConfirmedCents,appliedCents,reconciledCents,unreservedCents:valid?amount-authorizedCents:null,remainingToApplyCents:valid?amount-appliedCents:null,issues:[...(!valid?['Retained invoice amounts require reconciliation.']:[]),...(!allCurrent?['Resolve payment activity from a different invoice revision or without an outside-activity review.']:[])],payments}
}
export async function carrierInvoicePaymentState(db,facility,row){
 const current=(await db.query('SELECT * FROM payroll_benefit_carrier_invoice WHERE facility_id=$1 AND carrier_key=$2 AND invoice_key=$3 ORDER BY revision DESC LIMIT 1',[facility,row.carrier_key,row.invoice_key])).rows[0]
 const active=(await db.query(`SELECT a.id,a.invoice_id,a.amount_cents,a.preview,a.outside_activity_reviewed FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE i.facility_id=$1 AND i.carrier_key=$2 AND i.invoice_key=$3 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_cancellation c WHERE c.authorization_id=a.id) ORDER BY a.created_at,a.id`,[facility,row.carrier_key,row.invoice_key])).rows
 const payments=[]
 for(const payment of active){
  const state=await carrierApplicationState(db,facility,payment.id),amountCents=Number(payment.amount_cents)
  const bank=state.receiptStatus==='BANK_CONFIRMED',review=state.history[0]
  const applied=bank&&['FULLY_APPLIED','PARTIALLY_APPLIED','UNAPPLIED'].includes(state.status)?review.details.appliedCents:0
  const reconciled=state.reconciliation.status==='RECONCILED'&&!state.reconciliationCheckFailed
  payments.push({id:payment.id,invoiceId:payment.invoice_id,amountCents,paymentDate:payment.preview.paymentDate,outsideActivityReviewed:payment.outside_activity_reviewed,bankConfirmedCents:bank?amountCents:0,appliedCents:applied,reconciledCents:reconciled?amountCents:0,issues:[...state.reconciliation.checks.filter(c=>!c.complete).map(c=>c.message),...(state.reconciliationCheckFailed?['Automatic reconciliation needs recovery.']:[])]})
 }
 const assessmentHistory=(await db.query('SELECT id,assessment,created_at FROM payroll_carrier_invoice_assessment WHERE invoice_id=$1 AND facility_id=$2 ORDER BY id DESC LIMIT 10',[current.id,facility])).rows
 const latestCheck=(await db.query('SELECT id,status,message,checked_at FROM payroll_carrier_invoice_check WHERE invoice_id=$1 AND facility_id=$2 ORDER BY id DESC LIMIT 1',[current.id,facility])).rows[0]||null
 const failedChecks=(await db.query("SELECT id,message,checked_at FROM payroll_carrier_invoice_check WHERE invoice_id=$1 AND facility_id=$2 AND status='FAILED' ORDER BY id DESC LIMIT 10",[current.id,facility])).rows
 return {current,balance:{...summarizeCarrierInvoicePayments(current,payments,{historical:current.id!==row.id}),assessmentHistory,latestCheck,failedChecks}}
}
