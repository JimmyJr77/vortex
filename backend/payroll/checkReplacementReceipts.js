import {decryptDocument} from './onboarding.js'
import {paymentAccountingEvidence} from './paymentAccounting.js'
import {checkReplacementContext} from './checkReplacementAuthorization.js'
import {checkReplacementPlan} from './checkReplacementReview.js'
export async function replacementCheckReceipts(db,facility,{employeeId,runId,now=()=>new Date()}={}){
 const rows=(await db.query(`SELECT i.*,original.facility_id,original.payroll_run_id,original.batch_id,original.employee_id,original.payment_date::text AS original_payment_date,a.acknowledged_at,d.delivery_date::text,d.created_at AS delivered_at,p.provider_id,e.legal_first_name||' '||e.legal_last_name AS employee_name
  FROM payroll_check_replacement_delivery d JOIN payroll_check_replacement_authorization i ON i.id=d.authorization_id JOIN payroll_check_issue original ON original.id=i.issue_id
  JOIN payroll_check_replacement_document p ON p.authorization_id=i.id JOIN payroll_employee e ON e.id=original.employee_id AND e.facility_id=original.facility_id
  LEFT JOIN payroll_check_replacement_receipt_acknowledgment a ON a.authorization_id=i.id
  WHERE original.facility_id=$1 AND i.method='CHECK' AND ($2::bigint IS NULL OR original.employee_id=$2) AND ($3::bigint IS NULL OR original.payroll_run_id=$3)
  ORDER BY d.created_at DESC,i.id`,[facility,employeeId??null,runId??null])).rows
 const receipts=[]
 for(const row of rows){
  const observations=(await db.query('SELECT id,source,result,created_at FROM payroll_check_replacement_observation WHERE authorization_id=$1 ORDER BY id',[row.id])).rows
  const latest=observations.at(-1),result=latest?.result;let status='NEEDS_REVIEW',bankPostedDates=[]
  const original=await checkReplacementPlan(db,facility,Number(row.payroll_run_id),Number(row.batch_id),Number(row.employee_id),{requireFresh:false})
  if(!original.issues.length&&result?.providerId===row.provider_id&&result.dateMatches===true&&result.expiryMatches===true&&result.liveMode===true){
   if(result.status==='SENT'&&Date.parse(result.expiresAt)>now().getTime())status='OUTSTANDING'
   if(result.status==='COMPLETED')try{
    const intent=JSON.parse(decryptDocument(row.encrypted_intent,checkReplacementContext(row.id)).toString())
    const evidence=paymentAccountingEvidence({id:row.id,amount_cents:row.amount_cents,mode:intent.mode,originating_account_id:intent.originatingAccountId,payment_rail:'CHECK'},observations)
    if(!evidence.issues.length&&evidence.events.length&&evidence.events.every(e=>e.providerId===row.provider_id)){
     status='BANK_CONFIRMED';bankPostedDates=[...new Set(evidence.events.map(e=>e.postedDate))]
    }
   }catch{/* Preserve delivery history when current bank evidence cannot be verified. */}
  }
  receipts.push({sourceKind:'REPLACEMENT_CHECK',originalPaymentDate:row.original_payment_date,id:row.id,runId:Number(row.payroll_run_id),employeeName:row.employee_name,amountCents:Number(row.amount_cents),paymentDate:row.delivery_date,deliveredAt:row.delivered_at,acknowledgedAt:row.acknowledged_at,status,bankPostedDates,observedAt:latest?.created_at||null})
 }
 return receipts
}
