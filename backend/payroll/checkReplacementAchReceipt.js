import {decryptDocument} from './onboarding.js'
import {checkReplacementContext} from './checkReplacementAuthorization.js'
import {checkReplacementPlan} from './checkReplacementReview.js'
import {paymentAccountingEvidence} from './paymentAccounting.js'
async function confirmed(db,row){
 const observations=(await db.query('SELECT id,source,result FROM payroll_check_replacement_observation WHERE authorization_id=$1 ORDER BY id',[row.id])).rows,latest=observations.at(-1)
 if(latest?.source!=='RECOVERY'||latest.result?.status!=='COMPLETED'||latest.result?.settlementStatus!=='BANK_POSTED')return null
 try{
  const intent=JSON.parse(decryptDocument(row.encrypted_intent,checkReplacementContext(row.id)).toString())
  const original=await checkReplacementPlan(db,Number(row.facility_id),Number(row.payroll_run_id),Number(row.batch_id),Number(row.employee_id),{requireFresh:false})
  const evidence=paymentAccountingEvidence({id:row.id,amount_cents:row.amount_cents,mode:intent.mode,originating_account_id:intent.originatingAccountId,payment_rail:'ACH'},observations)
  if(original.issues.length||evidence.issues.length||!evidence.events.length||evidence.events.some(e=>e.kind!=='WITHDRAWAL')||evidence.events.reduce((n,e)=>n+e.amountCents,0)!==Number(row.amount_cents))return null
  // The full history comparison uses canonical bank movements, ignoring provider list ordering.
  return latest
 }catch{return null}
}
const source=`SELECT a.*,a.payment_date::text AS replacement_date,i.facility_id,i.payroll_run_id,i.batch_id,i.employee_id,i.payment_date::text AS original_payment_date FROM payroll_check_replacement_authorization a JOIN payroll_check_issue i ON i.id=a.issue_id`
export async function retainCheckReplacementAchReceipt(db,id,observationId){
 const row=(await db.query(`${source} WHERE a.id=$1 AND a.method='DIRECT_DEPOSIT'`,[id])).rows[0]
 if(!row)return false
 const latest=await confirmed(db,row)
 if(!latest||Number(latest.id)!==Number(observationId))return false
 return (await db.query(`INSERT INTO payroll_check_replacement_ach_receipt(authorization_id,observation_id) VALUES($1,$2) ON CONFLICT(authorization_id) DO NOTHING RETURNING authorization_id`,[id,observationId])).rowCount===1
}
export async function checkReplacementAchReceipts(db,facility,{employeeId,runId}={}){
 const rows=(await db.query(`${source} WHERE i.facility_id=$1 AND a.method='DIRECT_DEPOSIT' AND ($2::bigint IS NULL OR i.employee_id=$2) AND ($3::bigint IS NULL OR i.payroll_run_id=$3) AND EXISTS(SELECT 1 FROM payroll_check_replacement_ach_receipt r WHERE r.authorization_id=a.id)`,[facility,employeeId??null,runId??null])).rows,result=[]
 for(const row of rows){
  const retained=(await db.query(`SELECT r.created_at,o.result,e.legal_first_name||' '||e.legal_last_name AS employee_name FROM payroll_check_replacement_ach_receipt r JOIN payroll_check_replacement_observation o ON o.id=r.observation_id JOIN payroll_employee e ON e.id=$2 AND e.facility_id=$3 WHERE r.authorization_id=$1`,[row.id,row.employee_id,facility])).rows[0]
  const current=await confirmed(db,row),status=current?.result.providerId===retained.result.providerId?'BANK_CONFIRMED':'NEEDS_REVIEW'
  result.push({sourceKind:'STOPPED_CHECK',id:row.id,runId:Number(row.payroll_run_id),employeeName:retained.employee_name,amountCents:Number(row.amount_cents),originalPaymentDate:row.original_payment_date,paymentDate:row.replacement_date,account:row.account_summary,bankPostedDates:[...new Set(retained.result.settlementEvidence.map(e=>e.postedDate))],createdAt:retained.created_at,status})
 }
 return result
}
