import {settlementAutomationState} from './settlementAutomation.js'
import {refreshCheckStopCases} from './checkStopCase.js'
import {refreshPaymentReturnCases} from './paymentReturnCase.js'
import {randomUUID,createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {payrollBankAccounting} from './paymentAccounting.js'
import {paymentAccountingMappingState,settlementAccounts} from './paymentAccountingMapping.js'
import {quickbooksRequest} from './quickbooks.js'
import {settlementJournalPayload,journalMatches,resolveSettlementJournal} from './settlementJournal.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
async function jobs(db,facility,runId){return (await db.query(`SELECT j.*,m.details AS mapping_details,c.journal_id AS claimed,v.result FROM payroll_settlement_journal j JOIN payroll_payment_accounting_mapping m ON m.id=j.mapping_id LEFT JOIN payroll_settlement_journal_claim c ON c.journal_id=j.id LEFT JOIN LATERAL(SELECT result FROM payroll_settlement_journal_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1)v ON true WHERE j.facility_id=$1 AND j.payroll_run_id=$2 ORDER BY j.created_at,j.id`,[facility,runId])).rows}
export async function settlementPostingPlan(db,facility,runId){
 if(!Number.isSafeInteger(runId)||runId<=0)throw fail('Choose a valid payroll run.',400)
 const bank=await payrollBankAccounting(db,facility,runId),mapping=await paymentAccountingMappingState(db,facility),saved=await jobs(db,facility,runId),issues=[...(bank.blockingIssues||bank.issues)]
 const current=mapping.history[0],destination=mapping.connection
 if(mapping.status!=='CURRENT'||!current||!destination)issues.push('Verify the current QuickBooks bank/clearing mapping before posting.')
 const gross=destination?(await db.query("SELECT * FROM payroll_quickbooks_sync WHERE facility_id=$1 AND payroll_run_id=$2 AND realm_id=$3 AND environment=$4 AND status='SYNCED'",[facility,runId,destination.realmId,destination.environment])).rows[0]:null
 if(!gross||!/^\d+$/.test(String(gross.external_id)))issues.push('Sync and confirm the payroll journal in this QuickBooks company first.')
 if(gross&&current){
  const run=(await db.query('SELECT net_pay_cents FROM payroll_run WHERE facility_id=$1 AND id=$2',[facility,runId])).rows[0]
  const credits=gross.payload.Line?.filter(l=>l.DetailType==='JournalEntryLineDetail'&&l.JournalEntryLineDetail?.AccountRef?.value===current.details.clearing.id&&l.JournalEntryLineDetail.PostingType==='Credit')||[]
  if(credits.length!==1||Math.round(credits[0].Amount*100)!==Number(run.net_pay_cents))issues.push('The saved payroll journal uses a different clearing account or net amount. Reconcile it before settlement posting.')
 }
 const items=bank.events.map(event=>{
  const prior=saved.find(j=>j.event_key===event.key&&j.realm_id===destination?.realmId&&j.environment===destination?.environment),itemIssues=[...(event.issues||[])];let payload=null
  if(current&&destination){try{payload=settlementJournalPayload(event,current.details,{facilityId:facility,realmId:destination.realmId,environment:destination.environment})}catch{itemIssues.push('The bank movement does not match the current funding-account mapping.')}}
  if(event.kind==='RETURN'){
   const withdrawals=bank.events.filter(e=>e.instructionId===event.instructionId&&e.kind==='WITHDRAWAL')
   if(!withdrawals.length||withdrawals.some(e=>!saved.some(j=>j.event_key===e.key&&j.realm_id===destination?.realmId&&j.environment===destination?.environment&&j.result?.status==='SYNCED')))itemIssues.push('Confirm all original withdrawal journals before posting this returned credit.')
   if(current&&destination)for(const withdrawal of withdrawals){const priorWithdrawal=saved.find(j=>j.event_key===withdrawal.key&&j.realm_id===destination.realmId&&j.environment===destination.environment);if(priorWithdrawal){try{if(!journalMatches(priorWithdrawal.payload,settlementJournalPayload(withdrawal,current.details,{facilityId:facility,realmId:destination.realmId,environment:destination.environment})))itemIssues.push('The original withdrawal journal used different accounts. Reconcile it before posting the return.')}catch{itemIssues.push('The original withdrawal mapping needs review.')}}}
  }
  if(event.sourceKind==='REPLACEMENT'&&event.kind==='WITHDRAWAL'){
   const original=bank.events.filter(e=>e.instructionId===(event.predecessorId||event.originalInstructionId))
   if(!original.some(e=>e.kind==='RETURN')||original.some(e=>!saved.some(j=>j.event_key===e.key&&j.realm_id===destination?.realmId&&j.environment===destination?.environment&&j.result?.status==='SYNCED')))itemIssues.push('Confirm the preceding payment withdrawal and returned-credit journals before posting this replacement.')
   if(current&&destination)for(const movement of original){const priorMovement=saved.find(j=>j.event_key===movement.key&&j.realm_id===destination.realmId&&j.environment===destination.environment);if(priorMovement){try{if(!journalMatches(priorMovement.payload,settlementJournalPayload(movement,current.details,{facilityId:facility,realmId:destination.realmId,environment:destination.environment})))itemIssues.push('Original movement accounts differ from the replacement mapping. Reconcile them first.')}catch{itemIssues.push('Original movement mapping needs review.')}}}
  }
  return {...event,payload,issues:itemIssues,jobId:prior?.id||null,status:prior?.result?.status||(prior?'UNCERTAIN':'NOT_STARTED'),canPost:!prior&&!issues.length&&!itemIssues.length&&!!payload}
 })
 const data={issues,items,mapping:current?{id:Number(current.id),bank:current.details.bank,clearing:current.details.clearing}:null,destination,payrollJournalId:gross?Number(gross.id):null,jobs:saved.map(j=>({id:j.id,eventKey:j.event_key,kind:j.event.kind,postedDate:j.event.postedDate,sourceKind:j.event.sourceKind,employeeName:j.event.employeeName,amountCents:j.event.amountCents,bank:j.mapping_details.bank,clearing:j.mapping_details.clearing,realmId:j.realm_id,environment:j.environment,status:j.result?.status||'UNCERTAIN',journalId:j.result?.journalId||null,payload:j.payload,reference:j.reference}))}
 return {...data,fingerprint:createHash('sha256').update(JSON.stringify(data)).digest('hex')}
}
export async function postSettlementJournal(pool,facility,runId,body,{actorId,fetcher=fetch,automationId=null,automationCheckId=null}={}){
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  if(!Number.isSafeInteger(runId)||runId<=0)throw fail('Choose a valid payroll run.',400)
  if(!['SUBMIT','RECOVER'].includes(body?.action))throw fail('Choose posting or recovery.',400)
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  const connection=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
  if(!connection)throw fail('Connect the matching QuickBooks company before continuing.')
  const saved=await jobs(db,facility,runId)
  let job=body.action==='RECOVER'?saved.find(j=>j.id===body.jobId):saved.find(j=>j.event_key===body.eventKey&&j.realm_id===connection.realm_id&&j.environment===connection.environment)
  const recovery=!!job
  if(body.action==='RECOVER'&&!job)throw fail('Saved settlement journal not found.',404)
  if(job&&(job.realm_id!==connection.realm_id||job.environment!==connection.environment))throw fail('Reconnect this journal’s QuickBooks company and environment to recover it.')
  if(!job&&automationId!==null){
   const automation=await settlementAutomationState(db,facility,runId)
   if(actorId!=null||automation.status!=='ENABLED'||automation.revision!==automationId)throw fail('Automatic posting authorization changed or needs review.')
  }
  if(!job){
   if(body.confirmed!==true||body.noOtherPostingConfirmed!==true||typeof body.reference!=='string'||body.reference.trim().length<12||body.reference.length>500||/[\u0000-\u001f\u007f]/.test(body.reference))throw fail('Review the journal, confirm it has not already been recorded elsewhere, and retain a reference.',400)
   const plan=await settlementPostingPlan(db,facility,runId),item=plan.items.find(i=>i.key===body.eventKey)
   if(plan.fingerprint!==body.fingerprint||!item?.canPost)throw fail('Settlement inputs changed or need review. Refresh the posting plan.')
   const mapping=(await db.query('SELECT * FROM payroll_payment_accounting_mapping WHERE id=$1',[plan.mapping.id])).rows[0],gross=(await db.query('SELECT * FROM payroll_quickbooks_sync WHERE id=$1',[plan.payrollJournalId])).rows[0]
   const bank=await quickbooksRequest(db,connection,`account/${mapping.details.bank.id}`,{fetcher}),clearing=await quickbooksRequest(db,connection,`account/${mapping.details.clearing.id}`,{fetcher}),preferences=await quickbooksRequest(db,connection,'preferences',{fetcher})
   const verified=settlementAccounts(bank.Account,clearing.Account,preferences.Preferences)
   if(!isDeepStrictEqual(verified,{bank:mapping.details.bank,clearing:mapping.details.clearing}))throw fail('QuickBooks account details changed. Verify a new mapping before posting.')
   const payroll=await quickbooksRequest(db,connection,`journalentry/${gross.external_id}`,{fetcher})
   if(String(payroll.JournalEntry?.Id)!==String(gross.external_id)||!journalMatches(payroll.JournalEntry,gross.payload))throw fail('The QuickBooks payroll journal differs from its retained evidence. Reconcile it before posting.')
   if(item.kind==='RETURN')for(const withdrawal of plan.items.filter(i=>i.instructionId===item.instructionId&&i.kind==='WITHDRAWAL')){const prior=saved.find(j=>j.event_key===withdrawal.key&&j.realm_id===connection.realm_id&&j.environment===connection.environment);const remote=await quickbooksRequest(db,connection,`journalentry/${prior.result.journalId}`,{fetcher});if(String(remote.JournalEntry?.Id)!==prior.result.journalId||!journalMatches(remote.JournalEntry,prior.payload))throw fail('An original withdrawal journal changed in QuickBooks. Reconcile it before posting the return.')}
   if(item.sourceKind==='REPLACEMENT'&&item.kind==='WITHDRAWAL')for(const movement of plan.items.filter(i=>i.instructionId===(item.predecessorId||item.originalInstructionId))){const prior=saved.find(j=>j.event_key===movement.key&&j.realm_id===connection.realm_id&&j.environment===connection.environment);const remote=await quickbooksRequest(db,connection,`journalentry/${prior.result.journalId}`,{fetcher});if(String(remote.JournalEntry?.Id)!==prior.result.journalId||!journalMatches(remote.JournalEntry,prior.payload))throw fail('An original movement changed in QuickBooks. Reconcile it before posting the replacement.')}
   const {payload,issues,jobId,status,canPost,...event}=item
   event.review={version:1,noOtherPostingConfirmed:true}
   job=(await db.query('INSERT INTO payroll_settlement_journal(id,facility_id,payroll_run_id,mapping_id,payroll_journal_id,event_key,event,realm_id,environment,payload,reference,created_by,automation_id,automation_check_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',[randomUUID(),facility,runId,mapping.id,gross.id,item.key,event,connection.realm_id,connection.environment,payload,body.reference.trim(),actorId,automationId,automationCheckId])).rows[0]
   await db.query('INSERT INTO payroll_settlement_journal_claim(journal_id,created_by) VALUES($1,$2)',[job.id,actorId])
  }
  await db.query('COMMIT');await db.query('BEGIN')
  const current=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
  let result
  if(!current||current.realm_id!==job.realm_id||current.environment!==job.environment)result={status:'BLOCKED_CONFIGURATION'}
  else{
   let available=true
   if(!recovery){const state=await paymentAccountingMappingState(db,facility);available=state.status==='CURRENT'&&state.revision===Number(job.mapping_id)}
   result=available?await resolveSettlementJournal(job,(path,options={})=>quickbooksRequest(db,current,path,{...options,fetcher}),{allowCreate:!recovery}):{status:'BLOCKED_CONFIGURATION'}
  }
  await db.query('INSERT INTO payroll_settlement_journal_observation(journal_id,source,result) VALUES($1,$2,$3)',[job.id,recovery?'RECOVERY':'SUBMISSION',result])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'SETTLEMENT_JOURNAL_CHECKED','settlement_journal',$3,$4)",[facility,actorId,job.id,{source:recovery?'RECOVERY':'SUBMISSION',...result,automatic:actorId==null,automationId:job.automation_id?Number(job.automation_id):null}])
  if(result.status==='SYNCED')await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`settlement-journal-${job.id}`])
  else await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','QuickBooks settlement needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,`settlement-journal-${job.id}`,`Run ${runId}: settlement journal ${result.status}. Recover the saved journal in Payroll runs before further accounting.`])
  await refreshPaymentReturnCases(db,facility,runId)
  await refreshCheckStopCases(db,facility,runId)
  await db.query('COMMIT');return {jobId:job.id,recovery,result}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{if(locked)await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock]).catch(()=>{});db.release()}
}
export function registerSettlementPostingRoutes(app,pool,{fetcher=fetch}={}){
 const path='/api/admin/payroll/runs/:id/payment-accounting/posting'
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const data=await settlementPostingPlan(db,req.canonicalAccess.facilityId,Number(req.params.id));await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to prepare settlement journals.'})}finally{db.release()}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await postSettlementJournal(pool,req.canonicalAccess.facilityId,Number(req.params.id),req.body,{actorId:req.adminId,fetcher})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to confirm settlement posting. Recover the saved journal before continuing.'})}})
}
