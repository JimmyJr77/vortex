import {retirementDestinationAlert} from './retirementDestinationAlerts.js'
import {createHash,randomUUID} from 'node:crypto'
import {encryptDocument,decryptDocument,vaultReady} from './onboarding.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readModernTreasuryCarrierAccount as readBusinessAccount} from './modernTreasuryCarrierPayments.js'
import {verifyModernTreasuryFundingAccount} from './modernTreasuryPayments.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const context=(facility,id)=>`payroll-retirement-destination:${facility}:${id}`
const masked=a=>({holderName:a.holderName,accountType:a.accountType,accountLast4:a.accountLast4,mode:a.mode})
export async function readRetirementDestination(db,facility,id){
 const row=(await db.query('SELECT * FROM payroll_retirement_destination WHERE facility_id=$1 AND id=$2',[facility,id])).rows[0]
 if(!row)throw fail('Retirement destination not found.',404)
 if((await db.query('SELECT id FROM payroll_retirement_destination_suspension WHERE destination_id=$1',[id])).rows.length)throw fail('This retirement destination is suspended. Retain a new independently reviewed destination before remittance.',409)
 return {...row,destination:JSON.parse(decryptDocument(row.encrypted_destination,context(facility,id)).toString())}
}
export async function retirementDestinationStatus(db,facility,planId){
 const row=(await db.query(`SELECT d.id,d.plan_revision_id,d.connection_id,s.id AS suspension_id,(SELECT c.status FROM payroll_retirement_destination_check c WHERE c.destination_id=d.id ORDER BY c.id DESC LIMIT 1) AS account_status,
 (SELECT id FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND tax_year=2026 ORDER BY revision DESC LIMIT 1) AS current_plan,
 (SELECT id FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1) AS current_connection
 FROM payroll_retirement_destination d LEFT JOIN payroll_retirement_destination_suspension s ON s.destination_id=d.id WHERE d.facility_id=$1 AND d.plan_id=$2 ORDER BY d.revision DESC LIMIT 1`,[facility,planId])).rows[0]
 if(!row)return {status:'REVIEW_REQUIRED'}
 const bindingStatus=row.suspension_id?'SUSPENDED':row.plan_revision_id!==row.current_plan?'PLAN_CHANGED':String(row.connection_id)!==String(row.current_connection)?'CONNECTION_CHANGED':'REVIEWED'
 return {destinationId:row.id,suspensionId:row.suspension_id||null,bindingStatus,accountStatus:row.account_status||'UNVERIFIED',status:bindingStatus!=='REVIEWED'?bindingStatus:row.account_status==='VERIFIED'?'REVIEWED':'ACCOUNT_REVIEW_REQUIRED'}
}
export async function verifyRetirementDestination(db,facility,planId,id,{fetcher=fetch,actorId=null,automatic=false,now=new Date()}={}){
 const state=await retirementDestinationStatus(db,facility,planId)
 const scoped=(await db.query('SELECT id FROM payroll_retirement_destination WHERE facility_id=$1 AND plan_id=$2 AND id=$3',[facility,planId,id])).rows[0]
 if(!scoped)throw fail('Retirement destination not found.',404)
 if(state.destinationId!==id)throw fail('Recheck the latest retirement destination revision.',409)
 if(state.status==='SUSPENDED')throw fail('This retirement destination is suspended. Retain a new independently reviewed destination before remittance.',409)
 let status=state.bindingStatus==='REVIEWED'?null:state.bindingStatus
 if(!status){
  try{const row=await readRetirementDestination(db,facility,id),config=await readPayrollPaymentConnection(db,facility,row.connection_id),funding=await verifyModernTreasuryFundingAccount({...config,fetcher}),result=await readBusinessAccount({...config,fetcher},row.destination.accountId)
   status=funding.status==='UNAVAILABLE'||result.status==='UNAVAILABLE'?'UNAVAILABLE':funding.status!=='VERIFIED'||result.status!=='VERIFIED'||result.account.fingerprint!==row.destination.fingerprint?'CHANGED':'VERIFIED'
  }catch{status='UNAVAILABLE'}
 }
 const check=(await db.query('INSERT INTO payroll_retirement_destination_check(destination_id,status,created_by,automatic,created_at) VALUES($1,$2,$3,$4,$5) RETURNING id,status,created_at,automatic',[id,status,automatic?null:actorId,automatic,new Date(now).toISOString()])).rows[0]
 await retirementDestinationAlert(db,facility,planId,status)
 return check
}
export function registerRetirementDestinationRoutes(app,pool,{fetcher=fetch}={}){
 const base='/api/admin/payroll/retirement-plans/:planId/destination'
 const endpoint=work=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  await db.query('BEGIN');const facility=req.canonicalAccess.facilityId
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  const plan=(await db.query('SELECT id,plan FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,req.params.planId])).rows[0]
  if(!plan)throw fail('Retirement plan not found.',404)
  const connection=(await db.query('SELECT id FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[facility])).rows[0]
  const latest=(await db.query('SELECT * FROM payroll_retirement_destination WHERE facility_id=$1 AND plan_id=$2 ORDER BY revision DESC LIMIT 1',[facility,req.params.planId])).rows[0]
  const data=await work(db,req,{facility,plan,connectionRevision:Number(connection?.id||0),latest});await db.query('COMMIT');res.json({success:true,data})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to review retirement remittance destination.'})}finally{db.release()}}
 const prepare=async(db,req,s)=>{
  const b=req.body||{}
  if(!uuid(b.accountId)||!uuid(b.planRevisionId)||!Number.isSafeInteger(b.connectionRevision)||b.connectionRevision<=0)throw fail('Use the current retirement plan, funding connection and provider account.')
  if(s.plan.id!==b.planRevisionId||s.connectionRevision!==b.connectionRevision)throw fail('Plan or funding details changed. Reload and preview the destination.',409)
  const config=await readPayrollPaymentConnection(db,s.facility,s.connectionRevision),funding=await verifyModernTreasuryFundingAccount({...config,fetcher})
  if(funding.status!=='VERIFIED')throw fail('Verify the current employer funding account before retirement destination review.',409)
  // Reuse business ACH identity validation only. Independent trustee/plan
  // association evidence below is distinct from carrier invoice association.
  const result=await readBusinessAccount({...config,fetcher},b.accountId.toLowerCase())
  if(result.status!=='VERIFIED')throw fail('The retirement business destination is unavailable or requires account verification.',409)
  const priorSuspensionId=s.latest?(await db.query('SELECT id FROM payroll_retirement_destination_suspension WHERE destination_id=$1',[s.latest.id])).rows[0]?.id||null:null
  const fingerprint=hash({priorSuspensionId,facility:String(s.facility),planRevisionId:s.plan.id,planFingerprint:s.plan.plan.fingerprint,connectionRevision:s.connectionRevision,previousId:s.latest?.id||null,account:result.account})
  return {account:result.account,fingerprint,previousId:s.latest?.id||null}
 }
 app.get(base,endpoint(async(db,req,s)=>{
  const history=(await db.query(`SELECT d.id,d.revision,d.plan_revision_id,d.connection_id,d.masked_destination,d.reference,d.created_at,
  (SELECT jsonb_build_object('status',c.status,'createdAt',c.created_at,'automatic',c.automatic) FROM payroll_retirement_destination_check c WHERE c.destination_id=d.id ORDER BY c.id DESC LIMIT 1) AS verification,
  (SELECT jsonb_build_object('id',s.id,'reference',s.reference,'createdAt',s.created_at) FROM payroll_retirement_destination_suspension s WHERE s.destination_id=d.id) AS suspension
  FROM payroll_retirement_destination d WHERE d.facility_id=$1 AND d.plan_id=$2 ORDER BY revision DESC`,[s.facility,req.params.planId])).rows
  return {planRevisionId:s.plan.id,planName:s.plan.plan.name,providerName:s.plan.plan.providerName,connectionRevision:s.connectionRevision,vaultReady:vaultReady(),history:history.map((r,i)=>({...r,current:i===0,planCurrent:r.plan_revision_id===s.plan.id,connectionCurrent:Number(r.connection_id)===s.connectionRevision}))}
 }))
 app.post(`${base}/preview`,endpoint(async(db,req,s)=>{const p=await prepare(db,req,s);return {fingerprint:p.fingerprint,previousId:p.previousId,account:masked(p.account)}}))
 app.post(base,endpoint(async(db,req,s)=>{
  const b=req.body||{}
  if(!uuid(b.requestKey)||b.confirmed!==true||typeof b.reference!=='string'||b.reference.trim().length<20||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference)||typeof b.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(b.fingerprint))throw fail('Confirm independently verified trustee/plan payment instructions and retain their reference.')
  const digest=hash({planId:req.params.planId,planRevisionId:b.planRevisionId,connectionRevision:b.connectionRevision,accountId:b.accountId,previousId:b.previousId,fingerprint:b.fingerprint,reference:b.reference.trim()})
  const prior=(await db.query('SELECT id,revision,request_fingerprint FROM payroll_retirement_destination WHERE facility_id=$1 AND request_key=$2',[s.facility,b.requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==digest)throw fail('This request key belongs to different retirement destination evidence.',409);return {id:prior.id,revision:prior.revision,reused:true}}
  const p=await prepare(db,req,s)
  if(b.previousId!==p.previousId||b.fingerprint!==p.fingerprint)throw fail('Destination evidence changed. Preview and confirm the current details.',409)
  const id=randomUUID(),revision=(s.latest?.revision||0)+1,encrypted=encryptDocument(Buffer.from(JSON.stringify(p.account)),context(s.facility,id))
  await db.query('INSERT INTO payroll_retirement_destination(id,facility_id,plan_id,plan_revision_id,revision,connection_id,encrypted_destination,masked_destination,fingerprint,reference,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[id,s.facility,req.params.planId,s.plan.id,revision,s.connectionRevision,encrypted,masked(p.account),p.fingerprint,b.reference.trim(),b.requestKey,digest,req.adminId])
  await db.query("INSERT INTO payroll_retirement_destination_check(destination_id,status,created_by) VALUES($1,'VERIFIED',$2)",[id,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_DESTINATION_REVIEWED','retirement_destination',$3,$4)",[s.facility,req.adminId,id,{planId:req.params.planId,revision,planRevisionId:s.plan.id,connectionRevision:s.connectionRevision}])
  await retirementDestinationAlert(db,s.facility,req.params.planId,'VERIFIED')
  return {id,revision,reused:false}
 }))
 app.post(`${base}/:id/suspend`,endpoint(async(db,req,s)=>{
  const b=req.body||{}
  if(!uuid(req.params.id)||!uuid(b.requestKey)||b.confirmed!==true||typeof b.reference!=='string'||b.reference.trim().length<20||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm suspension and retain the reason for stopping this destination.')
  const row=(await db.query('SELECT id FROM payroll_retirement_destination WHERE facility_id=$1 AND plan_id=$2 AND id=$3',[s.facility,req.params.planId,req.params.id])).rows[0]
  if(!row)throw fail('Retirement destination not found.',404)
  const fingerprint=hash({destinationId:row.id,reference:b.reference.trim()})
  const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_destination_suspension WHERE facility_id=$1 AND request_key=$2',[s.facility,b.requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==fingerprint)throw fail('This request key belongs to a different suspension.',409);return {id:prior.id,reused:true}}
  if(s.latest?.id!==row.id)throw fail('Refresh and suspend the current destination revision.',409)
  if((await db.query('SELECT id FROM payroll_retirement_destination_suspension WHERE destination_id=$1',[row.id])).rows.length)throw fail('This destination is already suspended.',409)
  const id=randomUUID()
  await db.query('INSERT INTO payroll_retirement_destination_suspension(id,facility_id,destination_id,reference,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,s.facility,row.id,b.reference.trim(),b.requestKey,fingerprint,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_DESTINATION_SUSPENDED','retirement_destination',$3,$4)",[s.facility,req.adminId,row.id,{suspensionId:id,planId:req.params.planId}])
  await retirementDestinationAlert(db,s.facility,req.params.planId,'SUSPENDED')
  return {id,reused:false}
 }))
 app.post(`${base}/:id/verify`,endpoint(async(db,req,s)=>{
  if(!uuid(req.params.id))throw fail('Choose a retained retirement destination.')
  return verifyRetirementDestination(db,s.facility,req.params.planId,req.params.id,{fetcher,actorId:req.adminId})
 }))
}
