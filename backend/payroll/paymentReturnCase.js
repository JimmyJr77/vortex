import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {paymentAccountingEvidence} from './paymentAccounting.js'
import {replacementReceipts} from './paymentReplacementReceipt.js'
const movementFields=['key','instructionId','fundingAccountId','providerId','kind','transactionId','postedDate','amountCents','lineItemIds','returnId']
const sameMovement=(a,b)=>!!a&&!!b&&movementFields.every(key=>isDeepStrictEqual(a[key],b[key]))
export async function paymentReturnCases(db,facility,runId){
 const originals=(await db.query(`SELECT DISTINCT i.*,r.status AS run_status,e.legal_first_name||' '||e.legal_last_name AS employee_name FROM payroll_payment_instruction i JOIN payroll_run r ON r.id=i.payroll_run_id AND r.facility_id=i.facility_id JOIN payroll_employee e ON e.id=i.employee_id AND e.facility_id=i.facility_id JOIN payroll_payment_replacement_authorization a ON a.instruction_id=i.id WHERE i.facility_id=$1 AND i.payroll_run_id=$2`,[facility,runId])).rows
 if(!originals.length)return []
 const receipts=await replacementReceipts(db,facility,{runId})
 const connection=(await db.query('SELECT realm_id,environment FROM payroll_quickbooks_connection WHERE facility_id=$1',[facility])).rows[0]
 const gross=connection?(await db.query('SELECT id,status FROM payroll_quickbooks_sync WHERE facility_id=$1 AND payroll_run_id=$2 AND realm_id=$3 AND environment=$4',[facility,runId,connection.realm_id,connection.environment])).rows[0]:null
 const journals=(await db.query(`SELECT j.*,v.result FROM payroll_settlement_journal j LEFT JOIN LATERAL(SELECT result FROM payroll_settlement_journal_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1)v ON true WHERE j.facility_id=$1 AND j.payroll_run_id=$2`,[facility,runId])).rows
 const cases=[]
 for(const original of originals){
  const issues=[],source=(await db.query('SELECT o.id,o.source,o.result FROM payroll_payment_observation o JOIN payroll_payment_dispatch_attempt a ON a.id=o.attempt_id WHERE a.instruction_id=$1 ORDER BY o.id',[original.id])).rows
  if(original.run_status!=='FINALIZED')issues.push('Original payroll is not finalized.')
  const bank=paymentAccountingEvidence(original,source),returned=bank.events.find(e=>e.kind==='RETURN')
  if(bank.issues.length||source.at(-1)?.result?.status!=='RETURNED'||!returned)issues.push('Original returned-payment bank evidence needs reconciliation.')
  const authorization=(await db.query('SELECT a.* FROM payroll_payment_replacement_authorization a LEFT JOIN payroll_payment_replacement_cancellation c ON c.authorization_id=a.id WHERE a.instruction_id=$1 AND c.authorization_id IS NULL ORDER BY a.created_at DESC LIMIT 1',[original.id])).rows[0]
  const review=(await db.query('SELECT * FROM payroll_payment_replacement_review WHERE instruction_id=$1 ORDER BY id DESC LIMIT 1',[original.id])).rows[0]
  if(!authorization||!review||review.review.amountCents!==Number(authorization.amount_cents)||review.review.method!==authorization.method||review.review.replacementDate!==authorization.intent.paymentDate||(review.basis.predecessor?.id||null)!==(authorization.predecessor_id||null)||review.review.taxTreatment!=='ORIGINAL_PAYROLL_RETAINED'||!returned||!sameMovement(review.basis.returnEvent,returned)||(review.basis.returnCode||null)!==(source.at(-1)?.result?.returnEvidence?.code||null))issues.push('The retained unpaid-wage and tax-date review needs reconciliation.')
  const receipt=receipts.find(r=>r.id===authorization?.id)
  if(receipt?.status!=='BANK_CONFIRMED')issues.push('The replacement still needs confirmed bank evidence and its receipt.')
  const replacement={events:[],issues:[]}
  const cycles=(await db.query('SELECT a.* FROM payroll_payment_replacement_authorization a JOIN payroll_payment_replacement_attempt t ON t.authorization_id=a.id WHERE a.instruction_id=$1 ORDER BY a.created_at,a.id',[original.id])).rows
  for(const cycle of cycles){
   const observations=(await db.query('SELECT id,source,result FROM payroll_payment_replacement_observation WHERE authorization_id=$1 ORDER BY id',[cycle.id])).rows
   const evidence=paymentAccountingEvidence({id:cycle.id,amount_cents:cycle.amount_cents,originating_account_id:cycle.intent.originatingAccountId,mode:cycle.intent.mode},observations)
   replacement.events.push(...evidence.events);replacement.issues.push(...evidence.issues)
   if(cycle.id!==authorization?.id&&(observations.at(-1)?.result?.status!=='RETURNED'||!evidence.events.some(e=>e.kind==='RETURN')))replacement.issues.push('An earlier replacement still needs confirmed returned funds.')
   if(cycle.id===authorization?.id&&evidence.events.some(e=>e.kind==='RETURN'))replacement.issues.push('The latest replacement was returned.')
   if(cycle.id===authorization?.predecessor_id&&(!sameMovement(review?.basis?.predecessor?.returnEvent,evidence.events.find(e=>e.kind==='RETURN'))||(review?.basis?.predecessor?.returnCode||null)!==(observations.at(-1)?.result?.returnEvidence?.code||null)))replacement.issues.push('The prior replacement return changed after the latest wage review.')
  }
  if(replacement.issues.length)issues.push('Replacement bank movements need review.')
  const movements=[...bank.events,...replacement.events],matched=[]
  if(gross?.status!=='SYNCED')issues.push('The original payroll journal needs reconciliation.')
  const bankLines=movements.flatMap(e=>e.lineItemIds);if(new Set(bankLines).size!==bankLines.length)issues.push('Bank line items overlap between original and replacement payments.')
  if(!connection)issues.push('Reconnect the QuickBooks company to reconcile this case.')
  for(const event of movements){const journal=journals.find(j=>j.event_key===event.key&&j.realm_id===connection?.realm_id&&j.environment===connection?.environment&&j.result?.status==='SYNCED'&&Number(j.payroll_journal_id)===Number(gross?.id)&&sameMovement(j.event,event));if(!journal)issues.push('Confirm the original and replacement bank journals in QuickBooks.');else matched.push(journal.id)}
  if(!replacement.events.some(e=>e.kind==='WITHDRAWAL'))issues.push('Replacement bank withdrawal is not yet confirmed.')
  const evidence={authorizationId:authorization?.id||null,reviewId:review?Number(review.id):null,receiptId:receipt?.id||null,movements:movements.map(e=>Object.fromEntries(movementFields.map(k=>[k,e[k]]))),journalIds:matched.sort(),realmId:connection?.realm_id||null,environment:connection?.environment||null}
  const data={instructionId:original.id,employeeName:original.employee_name,status:issues.length?'OPEN':'CLOSED',issues:[...new Set(issues)],evidence}
  data.fingerprint=createHash('sha256').update(JSON.stringify(data)).digest('hex')
  const history=(await db.query('SELECT status,issues,created_at FROM payroll_payment_return_case WHERE instruction_id=$1 ORDER BY id DESC LIMIT 20',[original.id])).rows
  cases.push({...data,history})
 }
 return cases
}
// Callers hold the employer payment-connection lock and an open transaction.
export async function refreshPaymentReturnCases(db,facility,runId){
 const cases=await paymentReturnCases(db,facility,runId)
 for(const item of cases){
  const previous=(await db.query('SELECT fingerprint FROM payroll_payment_return_case WHERE instruction_id=$1 ORDER BY id DESC LIMIT 1',[item.instructionId])).rows[0]
  if(previous?.fingerprint!==item.fingerprint){await db.query('INSERT INTO payroll_payment_return_case(facility_id,payroll_run_id,instruction_id,status,issues,evidence,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7)',[facility,runId,item.instructionId,item.status,JSON.stringify(item.issues),item.evidence,item.fingerprint]);await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'PAYMENT_RETURN_CASE_REVIEWED','payment_instruction',$2,$3)",[facility,item.instructionId,{status:item.status,issues:item.issues}])}
  if(item.status==='CLOSED')await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`payment-exception-${item.instructionId}`])
  else await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Payroll payment needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,`payment-exception-${item.instructionId}`,`Returned-payment case: ${item.issues.join(' ')}`])
 }
 return cases
}
export function registerPaymentReturnCaseRoutes(app,pool){
 app.get('/api/admin/payroll/runs/:id/payment-return-cases',async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{const runId=Number(req.params.id),facility=req.canonicalAccess.facilityId;if(!Number.isSafeInteger(runId)||runId<=0)return res.status(400).json({success:false,message:'Choose a payroll run.'});await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');if(!(await db.query('SELECT 1 FROM payroll_run WHERE id=$1 AND facility_id=$2',[runId,facility])).rowCount){await db.query('ROLLBACK');return res.status(404).json({success:false,message:'Payroll run not found.'})}const data=await paymentReturnCases(db,facility,runId);await db.query('COMMIT');res.json({success:true,data:data.map(({evidence,fingerprint,...item})=>item)})}catch{await db.query('ROLLBACK').catch(()=>{});res.status(500).json({success:false,message:'Unable to review returned-payment cases.'})}finally{db.release()}})
}
