import {createHash,randomUUID} from 'node:crypto'
import {encryptDocument,decryptDocument,vaultReady} from './onboarding.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readModernTreasuryCarrierAccount} from './modernTreasuryCarrierPayments.js'
import {verifyModernTreasuryFundingAccount} from './modernTreasuryPayments.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const context=(facility,id)=>`payroll-carrier-payee:${facility}:${id}`
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const carrierName=value=>{if(typeof value!=='string'||value.trim().length<2||value.length>200||/[\u0000-\u001f\u007f]/.test(value))throw fail('Enter the carrier name used on its invoices.');return value.trim()}
const masked=account=>({holderName:account.holderName,accountType:account.accountType,accountLast4:account.accountLast4,mode:account.mode})
export async function readCarrierPayee(db,facility,id){
 const row=(await db.query('SELECT * FROM payroll_carrier_payee WHERE facility_id=$1 AND id=$2',[facility,id])).rows[0]
 if(!row)throw fail('Carrier payee was not found.',404)
 return {...row,destination:JSON.parse(decryptDocument(row.encrypted_destination,context(facility,id)).toString())}
}
export function registerCarrierPayeeRoutes(app,pool,{fetcher=fetch}={}){
 const base='/api/admin/payroll/carrier-payees'
 const endpoint=work=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${req.canonicalAccess.facilityId}`]);const data=await work(db,req);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to review carrier payment destination.'})}finally{db.release()}}
 const currentConnection=async(db,facility)=>(await db.query('SELECT id FROM payroll_payment_connection WHERE facility_id=$1 ORDER BY id DESC LIMIT 1',[facility])).rows[0]?.id
 const latest=async(db,facility,key)=>(await db.query('SELECT id,revision FROM payroll_carrier_payee WHERE facility_id=$1 AND carrier_key=$2 ORDER BY revision DESC LIMIT 1',[facility,key])).rows[0]
 const prepare=async(db,req)=>{
  const b=req.body||{},carrier=carrierName(b.carrier),facility=req.canonicalAccess.facilityId
  if(!uuid(b.accountId)||!Number.isSafeInteger(b.connectionRevision)||b.connectionRevision<=0)throw fail('Choose a carrier account and the current payment connection.')
  const connectionId=await currentConnection(db,facility)
  if(Number(connectionId)!==b.connectionRevision)throw fail('Employer payment connection changed. Refresh carrier setup.',409)
  const old=await latest(db,facility,carrier.toLowerCase()),configuration=await readPayrollPaymentConnection(db,facility,connectionId)
  const funding=await verifyModernTreasuryFundingAccount({...configuration,fetcher})
  if(funding.status!=='VERIFIED')throw fail('Verify the employer funding account before reviewing this carrier destination.',409)
  const result=await readModernTreasuryCarrierAccount({...configuration,fetcher},b.accountId.toLowerCase())
  if(result.status!=='VERIFIED')throw fail(result.status==='UNAVAILABLE'?'Carrier account lookup is unavailable. Retry the review.':'Carrier destination requires a verified business account and valid ACH details.',409)
  const account=result.account,fingerprint=hash({facility,carrier,connectionId:Number(connectionId),previousId:old?.id||null,account})
  return {carrier,connectionId:Number(connectionId),previousId:old?.id||null,revision:Number(old?.revision||0)+1,account,fingerprint}
 }
 app.get(base,endpoint(async(db,req)=>{
  const facility=req.canonicalAccess.facilityId,carrier=carrierName(req.query.carrier),connectionRevision=Number(await currentConnection(db,facility)||0)
  const history=(await db.query('SELECT p.id,p.carrier_name,p.revision,p.connection_id,p.masked_destination,p.reference,p.created_at,(SELECT jsonb_build_object(\'status\',c.status,\'created_at\',c.created_at) FROM payroll_carrier_payee_check c WHERE c.payee_id=p.id ORDER BY c.id DESC LIMIT 1) AS verification,(SELECT coalesce(jsonb_agg(jsonb_build_object(\'id\',c.id,\'status\',c.status,\'created_at\',c.created_at) ORDER BY c.id DESC),\'[]\'::jsonb) FROM payroll_carrier_payee_check c WHERE c.payee_id=p.id) AS checks FROM payroll_carrier_payee p WHERE p.facility_id=$1 AND p.carrier_key=$2 ORDER BY p.revision DESC',[facility,carrier.toLowerCase()])).rows
  return {connectionRevision,vaultReady:vaultReady(),history:history.map((row,index)=>({...row,current:index===0,connectionCurrent:Number(row.connection_id)===connectionRevision}))}
 }))
 app.post(`${base}/preview`,endpoint(async(db,req)=>{const p=await prepare(db,req);return {carrier:p.carrier,connectionRevision:p.connectionId,previousId:p.previousId,fingerprint:p.fingerprint,account:masked(p.account)}}))
 app.post(base,endpoint(async(db,req)=>{
  const b=req.body||{}
  if(b.confirmed!==true||typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm the carrier association and cite the independently reviewed payment instructions.')
  const p=await prepare(db,req)
  if(b.previousId!==p.previousId||b.fingerprint!==p.fingerprint)throw fail('Carrier or funding details changed. Preview and confirm the destination again.',409)
  const facility=req.canonicalAccess.facilityId,id=randomUUID(),encrypted=encryptDocument(Buffer.from(JSON.stringify(p.account)),context(facility,id))
  await db.query('INSERT INTO payroll_carrier_payee(id,facility_id,carrier_key,carrier_name,revision,connection_id,encrypted_destination,masked_destination,fingerprint,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,facility,p.carrier.toLowerCase(),p.carrier,p.revision,p.connectionId,encrypted,masked(p.account),p.fingerprint,b.reference.trim(),req.adminId])
  await db.query("INSERT INTO payroll_carrier_payee_check(payee_id,status,created_by) VALUES($1,'VERIFIED',$2)",[id,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_PAYEE_REVIEWED','carrier_payee',$3,$4)",[facility,req.adminId,id,{revision:p.revision,connectionRevision:p.connectionId,previousId:p.previousId}])
  return {id,revision:p.revision}
 }))
 app.post(`${base}/:id/verify`,endpoint(async(db,req)=>{
  if(!uuid(req.params.id))throw fail('Choose a retained carrier payee.')
  const facility=req.canonicalAccess.facilityId,row=await readCarrierPayee(db,facility,req.params.id),old=await latest(db,facility,row.carrier_key)
  if(old.id!==row.id)throw fail('Verify the current carrier payee revision.',409)
  let status='CONNECTION_CHANGED'
  if(Number(await currentConnection(db,facility))===Number(row.connection_id)){
   const configuration=await readPayrollPaymentConnection(db,facility,row.connection_id),funding=await verifyModernTreasuryFundingAccount({...configuration,fetcher}),result=await readModernTreasuryCarrierAccount({...configuration,fetcher},row.destination.accountId)
   status=funding.status==='UNAVAILABLE'||result.status==='UNAVAILABLE'?'UNAVAILABLE':funding.status!=='VERIFIED'||result.status!=='VERIFIED'||result.account.fingerprint!==row.destination.fingerprint?'CHANGED':'VERIFIED'
  }
  const check=(await db.query('INSERT INTO payroll_carrier_payee_check(payee_id,status,created_by) VALUES($1,$2,$3) RETURNING id,status,created_at',[row.id,status,req.adminId])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_PAYEE_CHECKED','carrier_payee',$3,$4)",[facility,req.adminId,row.id,{checkId:Number(check.id),status}])
  return check
 }))
}
