import {createHash} from 'node:crypto'
import {settlementPostingPlan} from './settlementPosting.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function settlementAutomationState(db,facility,runId){
 const run=(await db.query('SELECT status FROM payroll_run WHERE facility_id=$1 AND id=$2',[facility,runId])).rows[0]
 if(!run)throw fail('Payroll run not found.',404)
 const plan=await settlementPostingPlan(db,facility,runId),history=(await db.query('SELECT * FROM payroll_settlement_automation WHERE facility_id=$1 AND payroll_run_id=$2 ORDER BY id DESC',[facility,runId])).rows
 const basis={runId,mappingId:plan.mapping?.id||null,payrollJournalId:plan.payrollJournalId,destination:plan.destination?{realmId:plan.destination.realmId,environment:plan.destination.environment}:null},fingerprint=createHash('sha256').update(JSON.stringify(basis)).digest('hex')
 const issues=[...plan.issues];if(run.status!=='FINALIZED')issues.push('Finalize this payroll before authorizing automatic settlement journals.')
 const attempts=(await db.query(`SELECT c.id,c.automation_id,c.created_at,a.realm_id,a.environment,r.status,r.created_at AS completed_at FROM payroll_settlement_automation_check c JOIN payroll_settlement_automation a ON a.id=c.automation_id LEFT JOIN payroll_settlement_automation_result r ON r.check_id=c.id WHERE a.facility_id=$1 AND a.payroll_run_id=$2 ORDER BY c.id DESC LIMIT 20`,[facility,runId])).rows
 const started=(await db.query('SELECT id,automation_check_id FROM payroll_settlement_journal WHERE facility_id=$1 AND payroll_run_id=$2 AND automation_check_id IS NOT NULL',[facility,runId])).rows
 const executions=attempts.map(a=>({id:Number(a.id),authorizationId:Number(a.automation_id),realmId:a.realm_id,environment:a.environment,startedAt:a.created_at,completedAt:a.completed_at,status:a.status||'UNCONFIRMED',journals:started.filter(j=>Number(j.automation_check_id)===Number(a.id)).map(j=>({id:j.id,status:plan.jobs.find(p=>p.id===j.id)?.status||'UNAVAILABLE'}))}))
 const latest=history[0],status=!latest?.enabled?'DISABLED':latest.fingerprint!==fingerprint||issues.length?'NEEDS_REVIEW':'ENABLED'
 return {executions,fingerprint,revision:Number(latest?.id||0),status,issues,mapping:plan.mapping,destination:basis.destination,payrollJournalId:plan.payrollJournalId,canEnable:issues.length===0,history:history.map(r=>({id:Number(r.id),enabled:r.enabled,reference:r.reference,createdAt:r.created_at,createdBy:Number(r.created_by)}))}
}
export async function retainSettlementAutomation(pool,facility,runId,body,actorId){
 if(typeof body?.enabled!=='boolean'||body.confirmed!==true||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||typeof body.reference!=='string'||body.reference.trim().length<12||body.reference.length>500||/[\u0000-\u001f\u007f]/.test(body.reference)||(body.enabled&&body.noOtherPostingConfirmed!==true))throw fail('Review the automatic posting scope and retain its reference and confirmations.',400)
 const db=await pool.connect()
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
  const state=await settlementAutomationState(db,facility,runId)
  if(body.expectedRevision!==state.revision||body.fingerprint!==state.fingerprint)throw fail('Automatic posting inputs changed. Review them again.')
  if(body.enabled&&!state.canEnable)throw fail('Resolve payroll and account mapping issues before enabling automatic posting.')
  const row=(await db.query('INSERT INTO payroll_settlement_automation(facility_id,payroll_run_id,enabled,mapping_id,payroll_journal_id,realm_id,environment,fingerprint,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',[facility,runId,body.enabled,state.mapping?.id||null,state.payrollJournalId,state.destination?.realmId||null,state.destination?.environment||null,state.fingerprint,body.reference.trim(),actorId])).rows[0]
  if(!body.enabled)await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`settlement-automation-${runId}`])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'SETTLEMENT_AUTOMATION_REVIEWED','payroll_run',$3,$4)",[facility,actorId,String(runId),{authorizationId:Number(row.id),enabled:body.enabled}]);await db.query('COMMIT');return {id:Number(row.id)}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
export function registerSettlementAutomationRoutes(app,pool){
 const path='/api/admin/payroll/runs/:id/payment-accounting/automation'
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<=0)throw fail('Choose a payroll run.',400);res.json({success:true,data:await settlementAutomationState(pool,req.canonicalAccess.facilityId,id)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to review settlement automation.'})}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<=0)throw fail('Choose a payroll run.',400);res.json({success:true,data:await retainSettlementAutomation(pool,req.canonicalAccess.facilityId,id,req.body,req.adminId)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain settlement automation.'})}})
}
