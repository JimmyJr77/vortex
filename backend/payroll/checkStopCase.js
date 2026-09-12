import {retainCheckReplacementCloseout} from './checkReplacementCloseout.js'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {checkReplacementPlan} from './checkReplacementReview.js'
import {payrollBankAccounting} from './paymentAccounting.js'
const fields=['key','instructionId','originalInstructionId','sourceKind','paymentRail','fundingAccountId','providerId','kind','transactionId','postedDate','amountCents','lineItemIds','returnId']
const same=(a,b)=>fields.every(k=>isDeepStrictEqual(a[k],b[k]))
export async function checkStopCases(db,facility,runId){
 const originals=(await db.query(`SELECT i.*,r.status AS run_status,e.legal_first_name||' '||e.legal_last_name AS employee_name FROM payroll_check_issue i JOIN payroll_run r ON r.id=i.payroll_run_id JOIN payroll_employee e ON e.id=i.employee_id AND e.facility_id=i.facility_id WHERE i.facility_id=$1 AND i.payroll_run_id=$2 AND EXISTS(SELECT 1 FROM payroll_check_replacement_authorization a WHERE a.issue_id=i.id) ORDER BY i.id`,[facility,runId])).rows
 if(!originals.length)return []
 const bank=await payrollBankAccounting(db,facility,runId),connection=(await db.query('SELECT realm_id,environment FROM payroll_quickbooks_connection WHERE facility_id=$1',[facility])).rows[0]
 const gross=connection?(await db.query('SELECT id,status FROM payroll_quickbooks_sync WHERE facility_id=$1 AND payroll_run_id=$2 AND realm_id=$3 AND environment=$4',[facility,runId,connection.realm_id,connection.environment])).rows[0]:null
 const journals=(await db.query(`SELECT j.*,o.result FROM payroll_settlement_journal j LEFT JOIN LATERAL(SELECT result FROM payroll_settlement_journal_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1)o ON true WHERE j.facility_id=$1 AND j.payroll_run_id=$2`,[facility,runId])).rows,cases=[]
 for(const original of originals){
  const plan=await checkReplacementPlan(db,facility,runId,Number(original.batch_id),Number(original.employee_id),{requireFresh:false}),issues=[...plan.issues]
  if(original.run_status!=='FINALIZED')issues.push('Finalize the original payroll before closing this case.')
  const authorization=(await db.query('SELECT a.*,a.payment_date::text AS pay_date FROM payroll_check_replacement_authorization a LEFT JOIN payroll_check_replacement_cancellation c ON c.authorization_id=a.id WHERE a.issue_id=$1 AND c.authorization_id IS NULL ORDER BY a.created_at DESC LIMIT 1',[original.id])).rows[0],review=plan.history[0]?.review
  if(!authorization||plan.status!=='REVIEW_RETAINED'||review?.amountCents!==Number(authorization.amount_cents)||review?.method!==authorization.method||review?.replacementDate!==authorization.pay_date||review?.noOtherPaymentConfirmed!==true)issues.push('Retain a current matching unpaid-wage and original-reporting review.')
  const movements=bank.events.filter(e=>e.sourceKind==='CHECK_REPLACEMENT'&&e.originalInstructionId===original.id)
  const latest=authorization?(await db.query('SELECT result FROM payroll_check_replacement_observation WHERE authorization_id=$1 ORDER BY id DESC LIMIT 1',[authorization.id])).rows[0]?.result:null
  if(!authorization||latest?.status!=='COMPLETED'||latest?.settlementStatus!=='BANK_POSTED'||movements.some(e=>e.instructionId!==authorization.id||e.kind==='RETURN'||e.issues.length)||movements.filter(e=>e.kind==='WITHDRAWAL').reduce((n,e)=>n+e.amountCents,0)!==Number(original.amount_cents)||bank.blockingIssues.length)issues.push('The replacement still needs matching confirmed bank payment without returned funds or conflicting movements.')
  if(authorization?.method==='CHECK'&&!(await db.query('SELECT 1 FROM payroll_check_replacement_delivery WHERE authorization_id=$1',[authorization.id])).rowCount)issues.push('Record the replacement check handoff before closing this case.')
  if(gross?.status!=='SYNCED')issues.push('Reconcile the original payroll journal in the current QuickBooks company.')
  const matched=[]
  for(const event of movements){const journal=journals.find(j=>j.event_key===event.key&&j.realm_id===connection?.realm_id&&j.environment===connection?.environment&&j.result?.status==='SYNCED'&&Number(j.payroll_journal_id)===Number(gross?.id)&&same(j.event,event));if(!journal)issues.push('Reconcile the replacement bank journals in the current QuickBooks company.');else matched.push(journal.id)}
  const evidence={authorizationId:authorization?.id||null,reviewId:plan.revision,reviewFingerprint:plan.fingerprint,movements:movements.map(e=>Object.fromEntries(fields.map(k=>[k,e[k]]))),journalIds:matched.sort(),realmId:connection?.realm_id||null,environment:connection?.environment||null}
  const item={instructionId:original.id,employeeName:original.employee_name,status:issues.length?'OPEN':'CLOSED',issues:[...new Set(issues)],evidence}
  item.fingerprint=createHash('sha256').update(JSON.stringify(item)).digest('hex')
  item.history=(await db.query('SELECT status,issues,created_at FROM payroll_check_stop_case WHERE issue_id=$1 ORDER BY id DESC LIMIT 20',[original.id])).rows
  cases.push(item)
 }
 return cases
}
// Call with the employer connection lock and an open transaction.
export async function refreshCheckStopCases(db,facility,runId){
 await retainCheckReplacementCloseout(db,facility,runId)
 const cases=await checkStopCases(db,facility,runId)
 for(const item of cases){
  const previous=(await db.query('SELECT fingerprint FROM payroll_check_stop_case WHERE issue_id=$1 ORDER BY id DESC LIMIT 1',[item.instructionId])).rows[0]
  if(previous?.fingerprint!==item.fingerprint){await db.query('INSERT INTO payroll_check_stop_case(facility_id,payroll_run_id,issue_id,status,issues,evidence,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7)',[facility,runId,item.instructionId,item.status,JSON.stringify(item.issues),item.evidence,item.fingerprint]);await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'CHECK_STOP_CASE_REVIEWED','check_issue',$2,$3)",[facility,item.instructionId,{status:item.status,issues:item.issues}])}
  if(item.status==='CLOSED')await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`check-stop-${item.instructionId}`])
  else await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Stopped-check case needs follow-up',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,`check-stop-${item.instructionId}`,item.issues.join(' ')])
 }
 return cases
}
export function registerCheckStopCaseRoutes(app,pool){
 app.get('/api/admin/payroll/runs/:id/check-stop-cases',async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{const runId=Number(req.params.id),facility=req.canonicalAccess.facilityId;if(!Number.isSafeInteger(runId)||runId<=0)return res.status(400).json({success:false,message:'Choose a payroll run.'});await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');if(!(await db.query('SELECT 1 FROM payroll_run WHERE id=$1 AND facility_id=$2',[runId,facility])).rowCount){await db.query('ROLLBACK');return res.status(404).json({success:false,message:'Payroll run not found.'})}const data=await checkStopCases(db,facility,runId);await db.query('COMMIT');res.json({success:true,data:data.map(({evidence,fingerprint,...item})=>item)})}catch{await db.query('ROLLBACK').catch(()=>{});res.status(500).json({success:false,message:'Unable to review stopped-check cases.'})}finally{db.release()}})
}
