import {retirementJournalLines,verifyRetirementPosting} from './retirementJournal.js'
import { randomBytes, createHash } from 'node:crypto'
import { encryptDocument, decryptDocument, vaultReady } from './onboarding.js'
import { publicAppUrl } from '../email/publicAppUrl.js'
import { priorMonthlyBenefitCollection } from './monthlyBenefits.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(value).digest('hex')
const context=facility=>`quickbooks:${facility}`
export const QUICKBOOKS_ACCOUNTS=['wages','employerTax','reimbursements','taxLiability','deductions','clearing']
function config() {
 const clientId=process.env.QUICKBOOKS_CLIENT_ID,clientSecret=process.env.QUICKBOOKS_CLIENT_SECRET,redirectUri=process.env.QUICKBOOKS_REDIRECT_URI
 const environment=process.env.QUICKBOOKS_ENVIRONMENT==='production'?'production':'sandbox'
 return {clientId,clientSecret,redirectUri,environment,configured:Boolean(clientId&&clientSecret&&redirectUri&&vaultReady())}
}
async function tokenRequest(body,fetcher=fetch) {
 const c=config()
 const res=await fetcher('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams(body).toString(),signal:AbortSignal.timeout(20000)})
 if(!res.ok)throw fail('QuickBooks authorization failed. Reconnect the company account.',502)
 const token=await res.json()
 if(typeof token.access_token!=='string'||!token.access_token||typeof token.refresh_token!=='string'||!token.refresh_token||!Number.isFinite(Number(token.expires_in||3600))||Number(token.expires_in||3600)<=0)throw fail('QuickBooks returned incomplete authorization.',502)
 return {...token,expiresAt:Date.now()+Number(token.expires_in||3600)*1000}
}
async function connectionToken(db,connection,fetcher) {
 let tokens=JSON.parse(decryptDocument(connection.encrypted_tokens,context(connection.facility_id)).toString())
 if(Number(tokens.expiresAt)<Date.now()+60000) {
  tokens=await tokenRequest({grant_type:'refresh_token',refresh_token:tokens.refresh_token},fetcher)
  await db.query('UPDATE payroll_quickbooks_connection SET encrypted_tokens=$1,updated_at=now() WHERE facility_id=$2',[encryptDocument(Buffer.from(JSON.stringify(tokens)),context(connection.facility_id)),connection.facility_id])
 }
 return tokens.access_token
}
async function qbo(db,connection,path,{body,fetcher=fetch}={}) {
 const token=await connectionToken(db,connection,fetcher)
 const base=connection.environment==='production'?'https://quickbooks.api.intuit.com':'https://sandbox-quickbooks.api.intuit.com'
 const res=await fetcher(`${base}/v3/company/${encodeURIComponent(connection.realm_id)}/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,Accept:'application/json','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)})
 const data=await res.json().catch(()=>({}))
 if(!res.ok||data.Fault)throw fail(`QuickBooks request failed (${res.status}). Review the connection and account mappings, then retry.`,502)
 return data
}
async function verifyRetirementAccount(db,connection,retirement,fetcher){
 const result=await qbo(db,connection,`account/${encodeURIComponent(retirement)}`,{fetcher}),account=result.Account
 if(String(account?.Id)!==String(retirement)||account.Active!==true||account.AccountType!=='Other Current Liability'||account.CurrencyRef&&account.CurrencyRef.value!=='USD')throw fail('Retirement contributions require an active USD-compatible Other Current Liability account.',409)
}
function benefitJournalLines(run) {
 const employees=run.calculation_snapshot?.employees||[]
 const participating=employees.filter(e=>e.payItems?.some(i=>i.benefitDeduction))
 if(!participating.length)return []
 if(new Set(employees.map(e=>Number(e.employeeId))).size!==employees.length)throw fail('Reconcile duplicate employee evidence before syncing benefit deductions.',409)
 const total=employees.reduce((n,e)=>n+Number(e.totalDeductionCents),0)
 if(!Number.isSafeInteger(total)||total!==Number(run.deduction_cents))throw fail('Benefit journal deductions do not reconcile to the finalized run.',409)
 const date=run.pay_date instanceof Date?run.pay_date.toISOString().slice(0,10):String(run.pay_date).slice(0,10)
 const grouped=new Map()
 for(const employee of participating) {
  let collected
  try {collected=priorMonthlyBenefitCollection([{...run,payment_date:date,posttax_deduction_cents:employee.posttaxDeductionCents}],employee.employeeId,date.slice(0,7))}
  catch(e){throw fail(e.message,409)}
  for(const item of collected.items){
   const key=JSON.stringify([item.planId,item.optionId,date.slice(0,7),item.planName,item.optionLabel])
   const line=grouped.get(key)||['deductions',0,'Credit',`${date.slice(0,7)} benefit contribution: ${item.planName} — ${item.optionLabel}`]
   line[1]+=item.monthlyCents;grouped.set(key,line)
  }
 }
 return [...grouped.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,line])=>line)
}
export function journalEntries(run) {
 const retirement=retirementJournalLines(run),retirementCents=retirement.reduce((n,line)=>n+line[1],0)
 const benefits=benefitJournalLines(run),benefitCents=benefits.reduce((n,line)=>n+line[1],0)
 const lines=[['wages',Number(run.gross_pay_cents),'Debit'],['employerTax',Number(run.employer_tax_cents),'Debit'],['reimbursements',Number(run.reimbursement_cents),'Debit'],['taxLiability',Number(run.employee_tax_cents)+Number(run.employer_tax_cents),'Credit'],['deductions',Number(run.deduction_cents)-benefitCents-retirementCents,'Credit'],...benefits,...retirement,['clearing',Number(run.net_pay_cents),'Credit']]
 if(lines.some(([,amount])=>!Number.isSafeInteger(amount)||amount<0))throw fail('Journal amounts must be non-negative integer cents.')
 if(lines.reduce((sum,[,amount,posting])=>sum+(posting==='Debit'?amount:-amount),0)!==0)throw fail('Payroll journal does not balance.',409)
 if(!lines.some(([,amount])=>amount>0))throw fail('Cannot sync a zero-value payroll journal.',409)
 return lines.filter(([,amount])=>amount>0)
}
export function journalPayload(run,accounts) {
 const lines=journalEntries(run)
 if(lines.some(([key])=>key==='retirement')&&QUICKBOOKS_ACCOUNTS.some(key=>String(accounts[key])===String(accounts.retirement)))throw fail('Use a separate retirement contribution liability account.',409)
 for(const [key,amount] of lines)if(amount&&!/^\d+$/.test(String(accounts[key]||'')))throw fail(`Choose a QuickBooks account for ${key}.`)
 const date=run.pay_date instanceof Date?run.pay_date.toISOString().slice(0,10):String(run.pay_date).slice(0,10)
 return {TxnDate:date,DocNumber:`VTX-PAY-${run.id}`,PrivateNote:`Vortex payroll run ${run.id}`,Line:lines.filter(([,amount])=>amount>0).map(([key,amount,posting,description])=>({Amount:amount/100,Description:description||`Vortex payroll run ${run.id}`,DetailType:'JournalEntryLineDetail',JournalEntryLineDetail:{PostingType:posting,AccountRef:{value:String(accounts[key])}}}))}
}
export async function verifyBenefitPosting(db,run) {
 const benefitEmployees=(run.calculation_snapshot?.employees||[]).filter(e=>e.payItems?.some(i=>i.benefitDeduction))
   if(benefitEmployees.length){
    const posted=(await db.query('SELECT employee_id,posttax_deduction_cents FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows
    for(const employee of benefitEmployees){
     const matches=posted.filter(r=>Number(r.employee_id)===Number(employee.employeeId))
     if(matches.length!==1||Number(matches[0].posttax_deduction_cents)!==Number(employee.posttaxDeductionCents))throw fail('Posted benefit deductions do not reconcile to the finalized employee evidence.',409)
    }
   }
}
const clearSyncAlert=(db,facility,runId)=>db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`quickbooks-${runId}`])
export async function syncQuickbooksRun(pool,facility,runId,{fetcher=fetch,expectedJobId=null,automatic=false,expectedDestination=null}={}) {
 const db=await pool.connect()
 try {
  await db.query('BEGIN')
  const connection=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
  if(!connection)throw fail('Connect QuickBooks before syncing payroll.',409)
  if(automatic&&(!connection.auto_sync||connection.realm_id!==expectedDestination?.realm_id||connection.environment!==expectedDestination?.environment))throw fail('Automatic sync settings or destination changed. Run the checks again.',409)
  const run=(await db.query(`SELECT r.*,COALESCE(r.payment_date,p.pay_date) AS pay_date FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.id=$1 AND r.facility_id=$2`,[runId,facility])).rows[0]
  if(!run||run.status!=='FINALIZED')throw fail('Only finalized payroll can be synced.',409)
  const existing=(await db.query('SELECT * FROM payroll_quickbooks_sync WHERE facility_id=$1 AND payroll_run_id=$2 AND realm_id=$3 AND environment=$4',[facility,runId,connection.realm_id,connection.environment])).rows[0]
  if(expectedJobId!==null&&String(existing?.id)!==String(expectedJobId))throw fail('This saved job belongs to a different QuickBooks destination. Reconnect its company and environment before retrying.',409)
  if(automatic&&!existing&&(await db.query('SELECT id FROM payroll_quickbooks_sync WHERE facility_id=$1 AND payroll_run_id=$2 LIMIT 1',[facility,runId])).rows.length)throw fail('This payroll has a saved journal for another company. Review the destination before starting an explicit sync.',409)
  let job=existing
  if(!job) {
   const payload=journalPayload(run,connection.account_ids)
   await verifyBenefitPosting(db,run)
   const retirementLines=await verifyRetirementPosting(db,run)
   if(retirementLines?.length)await verifyRetirementAccount(db,connection,connection.account_ids.retirement,fetcher)
   job=(await db.query(`INSERT INTO payroll_quickbooks_sync (facility_id,payroll_run_id,realm_id,request_id,payload,environment) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,[facility,runId,connection.realm_id,hash(`${facility}:${runId}:${connection.realm_id}:${connection.environment}`).slice(0,40),payload,connection.environment])).rows[0]
  }
  if(job.status==='SYNCED')await clearSyncAlert(db,facility,runId)
  // Commit the immutable request before sending it. Retries reuse this request ID and payload.
  await db.query('COMMIT')
  if(job.status==='SYNCED')return job
  await db.query('BEGIN')
  const locked=(await db.query('SELECT * FROM payroll_quickbooks_sync WHERE id=$1 FOR UPDATE',[job.id])).rows[0]
  const current=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
  if(!current||current.realm_id!==job.realm_id||current.environment!==job.environment)throw fail('The connected QuickBooks company changed. Review the pending sync.',409)
  if(automatic&&!current.auto_sync)throw fail('Automatic sync was disabled before sending. The saved job remains available for review.',409)
  if(locked.status==='SYNCED'){await clearSyncAlert(db,facility,runId);await db.query('COMMIT');return locked}
  try {
   const data=await qbo(db,current,`journalentry?requestid=${job.request_id}`,{body:job.payload,fetcher})
   if(!data.JournalEntry?.Id)throw fail('QuickBooks did not return a journal confirmation. Retry this same job.',502)
   job=(await db.query(`UPDATE payroll_quickbooks_sync SET status='SYNCED',external_id=$1,error_message=NULL,attempts=attempts+1,updated_at=now() WHERE id=$2 RETURNING *`,[data.JournalEntry.Id,job.id])).rows[0]
   await db.query(`INSERT INTO payroll_audit_log (facility_id,action,entity_type,entity_id,after_data) VALUES ($1,'QUICKBOOKS_SYNCED','payroll_run',$2,$3)`,[facility,String(runId),{journalId:data.JournalEntry.Id}])
  } catch(e) {
   await db.query(`UPDATE payroll_quickbooks_sync SET status='FAILED',error_message=$1,attempts=attempts+1,updated_at=now() WHERE id=$2`,[e.status?e.message:'QuickBooks could not confirm the request. Retry the saved job.',job.id])
   await db.query('COMMIT');throw e
  }
  await clearSyncAlert(db,facility,runId)
  await db.query('COMMIT');return job
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
function endpoint(work) {return async(req,res)=>{try{res.json({success:true,data:await work(req)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'QuickBooks operation failed.'})}}}
export function registerQuickbooksAdminRoutes(app,pool,{fetcher=fetch}={}) {
 app.get('/api/admin/payroll/quickbooks',endpoint(async req=>{
  const f=req.canonicalAccess.facilityId,c=config(),before=req.query.before
  if(before!==undefined&&(typeof before!=='string'||!/^\d{1,18}$/.test(before)||BigInt(before)<=0n))throw fail('Choose a valid journal history cursor.')
  const row=(await pool.query('SELECT realm_id,environment,account_ids,auto_sync,connected_at FROM payroll_quickbooks_connection WHERE facility_id=$1',[f])).rows[0]
  const jobs=(await pool.query('SELECT id,payroll_run_id,realm_id,environment,status,external_id,error_message,attempts,updated_at,request_id,payload FROM payroll_quickbooks_sync WHERE facility_id=$1 AND ($2::bigint IS NULL OR id<$2::bigint) ORDER BY id DESC LIMIT 51',[f,before||null])).rows
  const page=jobs.slice(0,50)
  return {configured:c.configured,environment:c.environment,connection:row||null,jobs:page,nextCursor:jobs.length>50?String(page.at(-1).id):null}
 }))
 app.post('/api/admin/payroll/quickbooks/authorize',endpoint(async req=>{
  const c=config();if(!c.configured)throw fail('Configure QuickBooks client credentials, redirect URI, and encrypted storage on the server first.',503)
  const state=randomBytes(32).toString('base64url')
  const saved=await pool.query('INSERT INTO payroll_quickbooks_oauth_state (token_hash,facility_id,admin_id,environment,redirect_uri,client_id,connection_generation) SELECT $1,facility_id,$3,$4,$5,$6,quickbooks_connection_generation FROM payroll_settings WHERE facility_id=$2 RETURNING token_hash',[hash(state),req.canonicalAccess.facilityId,req.adminId,c.environment,c.redirectUri,c.clientId])
  if(!saved.rows.length)throw fail('Open Employer setup before connecting QuickBooks.',409)
  const url=new URL('https://appcenter.intuit.com/connect/oauth2');url.search=new URLSearchParams({client_id:c.clientId,response_type:'code',scope:'com.intuit.quickbooks.accounting',redirect_uri:c.redirectUri,state}).toString()
  return {url:url.toString()}
 }))
 app.get('/api/admin/payroll/quickbooks/accounts',endpoint(async req=>{
  const db=await pool.connect()
  try {await db.query('BEGIN');const c=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])).rows[0];if(!c)throw fail('Connect QuickBooks first.',409);const data=await qbo(db,c,'query?query='+encodeURIComponent('select * from Account where Active = true maxresults 1000'),{fetcher});await db.query('COMMIT');return data.QueryResponse?.Account||[]}catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}
 }))
 app.patch('/api/admin/payroll/quickbooks/mapping',endpoint(async req=>{
  const accounts=req.body?.accountIds||{}
  for(const key of QUICKBOOKS_ACCOUNTS)if(!/^\d+$/.test(String(accounts[key]||'')))throw fail('Map all six QuickBooks account IDs.')
  if(req.body?.verified!==true)throw fail('Confirm the bookkeeper has verified this mapping.')
  const db=await pool.connect()
  try {
   await db.query('BEGIN')
   const connection=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])).rows[0]
   if(!connection)throw fail('Connect QuickBooks first.',409)
   const retirement=accounts.retirement===undefined?connection.account_ids?.retirement:accounts.retirement
   const savedAccounts=Object.fromEntries(QUICKBOOKS_ACCOUNTS.map(k=>[k,String(accounts[k])]))
   if(retirement!==undefined&&retirement!==''){
    if(!/^\d+$/.test(String(retirement))||Object.values(savedAccounts).includes(String(retirement)))throw fail('Choose a separate retirement contribution liability account.')
    await verifyRetirementAccount(db,connection,retirement,fetcher)
    savedAccounts.retirement=String(retirement)
   }
   const result=await db.query('UPDATE payroll_quickbooks_connection SET account_ids=$1,auto_sync=$2,updated_at=now() WHERE facility_id=$3 RETURNING realm_id,environment,account_ids,auto_sync',[savedAccounts,req.body.autoSync===true,req.canonicalAccess.facilityId])
   if(!result.rows.length)throw fail('Connect QuickBooks first.',409)
   await db.query(`INSERT INTO payroll_audit_log (facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES ($1,$2,'QUICKBOOKS_MAPPING_VERIFIED','quickbooks_connection',$3,$4)`,[req.canonicalAccess.facilityId,req.adminId,String(req.canonicalAccess.facilityId),result.rows[0]])
   await db.query('COMMIT');return {saved:true}
  }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
 }))
 app.post('/api/admin/payroll/quickbooks/runs/:id/sync',endpoint(req=>syncQuickbooksRun(pool,req.canonicalAccess.facilityId,req.params.id,{fetcher})))
 app.post('/api/admin/payroll/quickbooks/jobs/:id/retry',endpoint(async req=>{
  if(!/^\d{1,18}$/.test(req.params.id))throw fail('Choose a valid saved journal.')
  const job=(await pool.query('SELECT id,payroll_run_id FROM payroll_quickbooks_sync WHERE id=$1 AND facility_id=$2',[req.params.id,req.canonicalAccess.facilityId])).rows[0]
  if(!job)throw fail('Saved journal not found.',404)
  return syncQuickbooksRun(pool,req.canonicalAccess.facilityId,job.payroll_run_id,{expectedJobId:job.id,fetcher})
 }))
 app.post('/api/admin/payroll/quickbooks/disconnect',endpoint(async req=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId
  try {
   await db.query('BEGIN')
   await db.query('UPDATE payroll_settings SET quickbooks_connection_generation=quickbooks_connection_generation+1 WHERE facility_id=$1',[facility])
   await db.query('DELETE FROM payroll_quickbooks_oauth_state WHERE facility_id=$1',[facility])
   const before=(await db.query('DELETE FROM payroll_quickbooks_connection WHERE facility_id=$1 RETURNING realm_id,environment',[facility])).rows[0]
   await db.query(`INSERT INTO payroll_audit_log (facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES ($1,$2,'QUICKBOOKS_DISCONNECTED','quickbooks_connection',$3,$4)`,[facility,req.adminId,String(facility),before||{}])
   await db.query('COMMIT');return {disconnected:true}
  }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
 }))
}
export function registerQuickbooksCallback(app,pool,{fetcher=fetch}={}) {
 app.get('/api/payroll/quickbooks/callback',async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  const db=await pool.connect()
  try {
   // Consume before exchanging the single-use authorization code; failures require a fresh link.
   const state=(await db.query('DELETE FROM payroll_quickbooks_oauth_state WHERE token_hash=$1 RETURNING *',[hash(String(req.query.state||''))])).rows[0]
   if(!state||new Date(state.expires_at)<=new Date())throw fail('QuickBooks connection link expired or was already used. Start again from payroll.',400)
   const c=config()
   if(!c.configured||state.environment!==c.environment||state.redirect_uri!==c.redirectUri||state.client_id!==c.clientId)throw fail('QuickBooks configuration changed. Start a new connection from payroll.',409)
   if(req.query.error||typeof req.query.code!=='string'||!req.query.code||typeof req.query.realmId!=='string'||!/^\d+$/.test(req.query.realmId))throw fail('QuickBooks authorization was not completed. Start again from payroll.')
   const tokens=await tokenRequest({grant_type:'authorization_code',code:req.query.code,redirect_uri:state.redirect_uri},fetcher)
   await db.query('BEGIN')
   const settings=(await db.query('SELECT quickbooks_connection_generation FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[state.facility_id])).rows[0]
   if(!settings||settings.quickbooks_connection_generation!==state.connection_generation)throw fail('This authorization was cancelled by a disconnect. Start a new connection from payroll.',409)
   const existing=(await db.query('SELECT realm_id,environment,account_ids,auto_sync,connected_at FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[state.facility_id])).rows[0]
   if(existing&&new Date(existing.connected_at)>new Date(state.created_at))throw fail('The QuickBooks connection changed while this link was pending. Start again from payroll.',409)
   const sameCompany=existing?.realm_id===req.query.realmId&&existing?.environment===state.environment
   const accounts=sameCompany?existing.account_ids:{},autoSync=sameCompany?existing.auto_sync:false
   await db.query(`INSERT INTO payroll_quickbooks_connection (facility_id,realm_id,encrypted_tokens,environment,connected_by,account_ids,auto_sync) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (facility_id) DO UPDATE SET realm_id=EXCLUDED.realm_id,encrypted_tokens=EXCLUDED.encrypted_tokens,environment=EXCLUDED.environment,connected_by=EXCLUDED.connected_by,account_ids=EXCLUDED.account_ids,auto_sync=EXCLUDED.auto_sync,connected_at=now(),updated_at=now()`,[state.facility_id,req.query.realmId,encryptDocument(Buffer.from(JSON.stringify(tokens)),context(state.facility_id)),state.environment,state.admin_id,accounts,autoSync])
   await db.query(`INSERT INTO payroll_audit_log (facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES ($1,$2,'QUICKBOOKS_CONNECTED','quickbooks_connection',$3,$4)`,[state.facility_id,state.admin_id,String(state.facility_id),{realmId:req.query.realmId,environment:state.environment,mappingPreserved:Boolean(sameCompany)}])
   await db.query('COMMIT');res.redirect(`${publicAppUrl()}/?payrollQuickbooks=connected`)
  } catch(e) {await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).type('text').send(e.status?e.message:'QuickBooks connection failed. Return to payroll and reconnect.')}finally{db.release()}
 })
}

export {qbo as quickbooksRequest}
