import {checkReplacementPlan} from './checkReplacementReview.js'
import {payrollBankAccounting} from './paymentAccounting.js'
// Called under the employer payment-connection lock. These records authorize no
// payment: they bind already retained handoff, wage review and bank recovery.
export async function retainCheckReplacementCloseout(db,facility,runId){
 const originals=(await db.query(`SELECT i.*,i.payment_date::text AS wage_date,d.delivery_date::text AS delivered_on FROM payroll_check_issue i JOIN payroll_run r ON r.id=i.payroll_run_id LEFT JOIN payroll_check_delivery d ON d.issue_id=i.id WHERE i.facility_id=$1 AND i.payroll_run_id=$2 AND r.status='APPROVED' AND EXISTS(SELECT 1 FROM payroll_check_replacement_authorization WHERE issue_id=i.id)`,[facility,runId])).rows
 if(!originals.length)return
 const bank=await payrollBankAccounting(db,facility,runId,{allowApproved:true})
 if(bank.blockingIssues.length)return
 for(const original of originals){
  if(original.delivered_on!==original.wage_date)continue
  const review=await checkReplacementPlan(db,facility,runId,Number(original.batch_id),Number(original.employee_id),{requireFresh:true})
  if(review.issues.length||review.status!=='REVIEW_RETAINED')continue
  const authorization=(await db.query('SELECT a.*,a.payment_date::text AS actual_date FROM payroll_check_replacement_authorization a LEFT JOIN payroll_check_replacement_cancellation c ON c.authorization_id=a.id WHERE a.issue_id=$1 AND c.authorization_id IS NULL ORDER BY a.created_at DESC,a.id DESC LIMIT 1',[original.id])).rows[0]
  if(!authorization||review.history[0]?.review.amountCents!==Number(authorization.amount_cents)||review.history[0]?.review.noOtherPaymentConfirmed!==true||authorization.actual_date!==review.history[0]?.review.replacementDate||authorization.method!==review.method||Number(authorization.amount_cents)!==Number(original.amount_cents))continue
  const observation=(await db.query("SELECT id,source,result,created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp() AS fresh FROM payroll_check_replacement_observation WHERE authorization_id=$1 ORDER BY id DESC LIMIT 1",[authorization.id])).rows[0]
  if(!observation?.fresh||observation.source!=='RECOVERY'||observation.result?.status!=='COMPLETED'||observation.result?.settlementStatus!=='BANK_POSTED')continue
  if(authorization.method==='CHECK'&&!(await db.query('SELECT 1 FROM payroll_check_replacement_delivery WHERE authorization_id=$1',[authorization.id])).rowCount)continue
  const movements=bank.events.filter(e=>e.sourceKind==='CHECK_REPLACEMENT'&&e.originalInstructionId===original.id)
  if(!movements.length||movements.some(e=>e.instructionId!==authorization.id||e.kind!=='WITHDRAWAL'||e.issues.length)||movements.reduce((n,e)=>n+e.amountCents,0)!==Number(original.amount_cents))continue
  const originalObservation=(await db.query('SELECT id FROM payroll_check_issue_observation WHERE issue_id=$1 ORDER BY id DESC LIMIT 1',[original.id])).rows[0],stopObservation=(await db.query('SELECT o.id FROM payroll_check_stop_observation o JOIN payroll_check_stop s ON s.id=o.stop_id WHERE s.issue_id=$1 ORDER BY o.id DESC LIMIT 1',[original.id])).rows[0]
  const saved=(await db.query('INSERT INTO payroll_check_replacement_closeout(issue_id,authorization_id,review_id,original_observation_id,stop_observation_id,replacement_observation_id,evidence) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING id',[original.id,authorization.id,review.revision,originalObservation.id,stopObservation.id,observation.id,{wageDate:original.wage_date,replacementDate:authorization.actual_date,method:authorization.method,amountCents:Number(original.amount_cents),movements}])).rows[0]
  if(saved)await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'CHECK_REPLACEMENT_CLOSEOUT_READY','check_replacement_closeout',$2,$3)",[facility,String(saved.id),{runId,issueId:original.id,authorizationId:authorization.id,wageDate:original.wage_date,replacementDate:authorization.actual_date}])
 }
}
