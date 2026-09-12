import {randomUUID} from 'node:crypto'
import {carrierPremiumReversalPreview} from './carrierPremiumReversal.js'
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status})}
const reference=input=>{if(input?.confirmed!==true||typeof input.reference!=='string'||input.reference.trim().length<12||input.reference.length>2000||/[\u0000-\u001f\u007f]/.test(input.reference))fail('Confirm the premium reversal action and provide its review reference.',400);return input.reference.trim()}
export async function authorizeCarrierPremiumReversal(db,facility,id,input,admin,options){
 const ref=reference(input)
 if(typeof input.requestKey!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(input.requestKey))fail('Refresh the reversal authorization form.',400)
 const preview=await carrierPremiumReversalPreview(db,facility,id,input.reversalDate,options)
 if(input.fingerprint!==preview.fingerprint)fail('Premium reversal facts changed. Refresh and review the preview before authorizing.')
 const old=(await db.query('SELECT r.*,c.authorization_id AS cancelled FROM payroll_carrier_reversal_authorization r LEFT JOIN payroll_carrier_reversal_cancellation c ON c.authorization_id=r.id WHERE r.premium_authorization_id=$1 AND r.request_key=$2',[id,input.requestKey])).rows[0]
 if(old){if(old.cancelled||old.fingerprint!==preview.fingerprint||old.reference!==ref)fail('This reversal request was cancelled or has different terms. Start a fresh authorization.');return {id:old.id,reused:true}}
 if((await db.query('SELECT r.id FROM payroll_carrier_reversal_authorization r WHERE r.premium_authorization_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_reversal_cancellation c WHERE c.authorization_id=r.id)',[id])).rows.length)fail('A reversal authorization is already retained. Refresh its history before continuing.')
 const reversalId=randomUUID()
 await db.query('INSERT INTO payroll_carrier_reversal_authorization(id,premium_authorization_id,request_key,preview,fingerprint,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[reversalId,id,input.requestKey,preview,preview.fingerprint,ref,admin])
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_PREMIUM_REVERSAL_AUTHORIZED','carrier_reversal_authorization',$3,$4)",[facility,admin,reversalId,{premiumAuthorizationId:id,fingerprint:preview.fingerprint,reference:ref}])
 return {id:reversalId,reused:false}
}
export async function cancelCarrierPremiumReversal(db,facility,id,input,admin){
 const ref=reference(input)
 if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))fail('Choose a retained reversal authorization.',400)
 const r=(await db.query('SELECT r.id FROM payroll_carrier_reversal_authorization r JOIN payroll_carrier_premium_authorization a ON a.id=r.premium_authorization_id JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE r.id=$1 AND i.facility_id=$2',[id,facility])).rows[0]
 if(!r)fail('Reversal authorization was not found.',404)
 if((await db.query('SELECT authorization_id FROM payroll_carrier_reversal_cancellation WHERE authorization_id=$1',[id])).rows.length)return {id,reused:true}
 if((await db.query('SELECT authorization_id FROM payroll_carrier_reversal_claim WHERE authorization_id=$1',[id])).rows.length)fail('This reversal has a dispatch claim. Recover its outcome before correction.')
 await db.query('INSERT INTO payroll_carrier_reversal_cancellation(authorization_id,reference,created_by) VALUES($1,$2,$3)',[id,ref,admin])
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_PREMIUM_REVERSAL_CANCELLED','carrier_reversal_authorization',$3,$4)",[facility,admin,id,{reference:ref}])
 return {id,reused:false}
}
