import {retirementContributionAssessment} from './retirementContributionAssessment.js'
import {retirementContributionAlertDecision} from './retirementContributionAlertDecision.js'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
// This coordinator only consumes retained evidence; it never calls a provider.
export async function refreshRetirementContribution(pool,facility,id,{actorId=null,now=new Date(),automatic=false}={}){
 const db=await pool.connect()
 try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
  if(automatic){
   const last=(await db.query(`SELECT max(at) AS at FROM (SELECT checked_at AS at FROM payroll_retirement_contribution_checkpoint WHERE facility_id=$1 AND authorization_id=$2 UNION ALL SELECT created_at FROM payroll_retirement_contribution_failure WHERE facility_id=$1 AND authorization_id=$2) t`,[facility,id])).rows[0].at
   if(last&&+new Date(last)>+new Date(now)-300000){await db.query('COMMIT');return {skipped:true,changed:false}}
  }
  const result=await retainRetirementContribution(db,facility,id,{actorId,now});await db.query('COMMIT');return result
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}

// Caller holds the employer payment lock and owns the current transaction.
export async function retainRetirementContribution(db,facility,id,{actorId=null,now=new Date()}={}){
  const assessment=await retirementContributionAssessment(db,facility,id,{now}),decision=retirementContributionAlertDecision(assessment)
  const previous=(await db.query('SELECT id,fingerprint FROM payroll_retirement_contribution_assessment WHERE facility_id=$1 AND authorization_id=$2 ORDER BY id DESC LIMIT 1',[facility,id])).rows[0]
  let historyId=previous?.id,changed=false
  if(previous?.fingerprint!==decision.fingerprint){
   historyId=(await db.query('INSERT INTO payroll_retirement_contribution_assessment(facility_id,authorization_id,fingerprint,summary,created_by,created_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[facility,id,decision.fingerprint,decision.summary,actorId,new Date(now).toISOString()])).rows[0].id;changed=true
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_CONTRIBUTION_ASSESSED','retirement_remittance_authorization',$3,$4)",[facility,actorId,id,{assessmentId:String(historyId),status:decision.summary.status}])
  }
  await db.query('INSERT INTO payroll_retirement_contribution_checkpoint(facility_id,authorization_id,assessment_id,checked_at) VALUES($1,$2,$3,$4) ON CONFLICT(authorization_id) DO UPDATE SET assessment_id=EXCLUDED.assessment_id,checked_at=EXCLUDED.checked_at',[facility,id,historyId,new Date(now).toISOString()])
  const key=`retirement-contribution-${id}`
  if(decision.combinedAlert==='OPEN')await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING',$3,$4) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,title=EXCLUDED.title,message=EXCLUDED.message",[facility,key,decision.title,decision.summary.issues.join(' ')||'Review the retained payroll, bank, participant and accounting evidence.'])
  else await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=COALESCE(dismissed_at,now()) WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,key])
  if(decision.clearDeliveryWarnings){
   const allocations=(await db.query('SELECT id FROM payroll_retirement_allocation_authorization a WHERE facility_id=$1 AND remittance_id=$2 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation c WHERE c.authorization_id=a.id)',[facility,id])).rows
   const keys=[`retirement-bank-${id}`,...allocations.flatMap(a=>[`retirement-allocation-${a.id}`,`retirement-receipt-${a.id}`])]
   await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=COALESCE(dismissed_at,now()) WHERE facility_id=$1 AND dedupe_key=ANY($2::text[]) AND status='OPEN'",[facility,keys])
  }
  await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=COALESCE(dismissed_at,now()) WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`retirement-contribution-check-${id}`])
  return {assessmentId:String(historyId),changed,status:decision.summary.status,checkedAt:new Date(now).toISOString()}
}
// Preserve newly observed provider evidence even if assessment storage fails.
export async function reconcileRetirementObservation(db,facility,id,{actorId=null}={}){
 await db.query('SAVEPOINT retirement_contribution_assessment')
 try{
  await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility])
  const result=await retainRetirementContribution(db,facility,id,{actorId})
  await db.query('RELEASE SAVEPOINT retirement_contribution_assessment');return result
 }catch{
  await db.query('ROLLBACK TO SAVEPOINT retirement_contribution_assessment')
  const message='Contribution evidence was retained, but its combined assessment needs a retry. Automatic checks will retry; review contribution history if this persists.'
  await db.query('INSERT INTO payroll_retirement_contribution_failure(facility_id,authorization_id,message) VALUES($1,$2,$3)',[facility,id,message])
  await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Retirement contribution check needs recovery',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,`retirement-contribution-check-${id}`,message])
  await db.query('RELEASE SAVEPOINT retirement_contribution_assessment');return {failed:true}
 }
}

export function registerRetirementContributionHistory(app,pool){
 const path='/api/admin/payroll/retirement-remittance-authorizations/:id/assessment-history'
 app.post(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{const data=await refreshRetirementContribution(pool,req.canonicalAccess.facilityId,req.params.id,{actorId:req.adminId});res.json({success:true,data})}
  catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain contribution assessment.'})}
 })
 app.get(path,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const before=req.query.beforeId,beforeFailure=req.query.beforeFailureId
   if(!uuid(req.params.id)||[before,beforeFailure].some(cursor=>cursor!==undefined&&(typeof cursor!=='string'||!/^[1-9][0-9]{0,18}$/.test(cursor)||BigInt(cursor)>9223372036854775807n)))throw Object.assign(new Error('Choose a valid contribution and history cursor.'),{status:400})
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
   const args=[req.canonicalAccess.facilityId,req.params.id]
   if(!(await db.query('SELECT id FROM payroll_retirement_remittance_authorization WHERE facility_id=$1 AND id=$2',args)).rowCount)throw Object.assign(new Error('Retirement contribution not found.'),{status:404})
   const rows=(await db.query('SELECT id,summary,created_at,created_by IS NULL AS automatic FROM payroll_retirement_contribution_assessment WHERE facility_id=$1 AND authorization_id=$2 AND ($3::bigint IS NULL OR id<$3) ORDER BY id DESC LIMIT 21',[...args,before??null])).rows
   const checkpoint=(await db.query('SELECT assessment_id,checked_at FROM payroll_retirement_contribution_checkpoint WHERE facility_id=$1 AND authorization_id=$2',args)).rows[0]??null
   const failures=(await db.query('SELECT id,message,created_at FROM payroll_retirement_contribution_failure WHERE facility_id=$1 AND authorization_id=$2 AND ($3::bigint IS NULL OR id<$3) ORDER BY id DESC LIMIT 21',[...args,beforeFailure??null])).rows
   const history=rows.slice(0,20);await db.query('COMMIT')
   res.json({success:true,data:{history,checkpoint,nextCursor:rows.length>20?String(history.at(-1).id):null,failures:failures.slice(0,20),nextFailureCursor:failures.length>20?String(failures[19].id):null}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read contribution assessment history.'})}finally{db.release()}
 })
}
