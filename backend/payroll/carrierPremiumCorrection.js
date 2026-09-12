import {quickbooksRequest} from './quickbooks.js'
import {resolveCarrierPremiumJournal} from './carrierPremiumDispatch.js'
import {resolveCarrierReversalJournal} from './carrierReversalDispatch.js'
import {carrierPremiumReversalPayload} from './carrierPremiumReversal.js'
import {journalMatches} from './settlementJournal.js'
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status})}
async function verifyPair(db,facility,row,{fetcher=fetch}={}){
 if(!journalMatches(row.reversal_preview.payload,carrierPremiumReversalPayload(row.premium_id,row.premium_preview.payload,row.reversal_preview.payload.TxnDate)))fail('The reversal does not offset the retained original premium journal.')
 const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
 if(!qbo||qbo.realm_id!==row.premium_preview.realmId||qbo.environment!==row.premium_preview.environment||qbo.realm_id!==row.reversal_preview.realmId||qbo.environment!==row.reversal_preview.environment)fail('Reconnect the original QuickBooks company and environment to reconcile this correction.')
 const request=(path,options)=>quickbooksRequest(db,qbo,path,{...options,fetcher})
 const original=await resolveCarrierPremiumJournal({id:row.premium_id,payload:row.premium_preview.payload},request)
 const reversal=await resolveCarrierReversalJournal({id:row.reversal_id,payload:row.reversal_preview.payload},request)
 if(original.status!=='SYNCED'||reversal.status!=='SYNCED'||original.journalId!==row.original_journal_id||reversal.journalId!==row.reversal_journal_id)fail('The original or reversal journal changed or cannot be verified. Recover and reconcile both before correcting the invoice.')
 return {originalJournalId:original.journalId,reversalJournalId:reversal.journalId,realmId:qbo.realm_id,environment:qbo.environment,premiumFingerprint:row.premium_fingerprint,reversalFingerprint:row.reversal_fingerprint}
}
const projection=`a.id AS premium_id,r.id AS reversal_id,a.preview AS premium_preview,r.preview AS reversal_preview,a.fingerprint AS premium_fingerprint,r.fingerprint AS reversal_fingerprint`
export async function reconcileCarrierPremiumReversal(db,facility,id,input,admin,options){
 if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))fail('Choose a retained reversal authorization.',400)
 if(input?.confirmed!==true||typeof input.reference!=='string'||input.reference.trim().length<12||input.reference.length>2000||/[\u0000-\u001f\u007f]/.test(input.reference))fail('Confirm both journals and provide the correction reconciliation reference.',400)
 const reference=input.reference.trim()
 const row=(await db.query(`SELECT ${projection},(SELECT result FROM payroll_carrier_premium_observation WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1) AS original_result,(SELECT result FROM payroll_carrier_reversal_observation WHERE authorization_id=r.id ORDER BY id DESC LIMIT 1) AS reversal_result FROM payroll_carrier_reversal_authorization r JOIN payroll_carrier_premium_authorization a ON a.id=r.premium_authorization_id JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE r.id=$1 AND i.facility_id=$2`,[id,facility])).rows[0]
 if(!row)fail('Reversal authorization was not found.',404)
 const old=(await db.query('SELECT * FROM payroll_carrier_premium_correction WHERE premium_authorization_id=$1',[row.premium_id])).rows[0]
 if(old){if(old.reversal_authorization_id!==id||old.reference!==reference)fail('This premium already has a retained correction reconciliation. Review its history.');return {id:row.premium_id,reused:true}}
 if(row.original_result?.status!=='SYNCED'||row.reversal_result?.status!=='SYNCED')fail('Recover both original and reversal journals before reconciliation.')
 const evidence=await verifyPair(db,facility,{...row,original_journal_id:row.original_result.journalId,reversal_journal_id:row.reversal_result.journalId},options)
 await db.query('INSERT INTO payroll_carrier_premium_correction(premium_authorization_id,reversal_authorization_id,evidence,reference,created_by) VALUES($1,$2,$3,$4,$5)',[row.premium_id,id,evidence,reference,admin])
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_PREMIUM_CORRECTION_RECONCILED','carrier_premium_authorization',$3,$4)",[facility,admin,row.premium_id,{reversalAuthorizationId:id,reference,...evidence}])
 return {id:row.premium_id,reused:false}
}
export async function verifyCarrierCorrectionChain(db,facility,invoice,options){
 const rows=(await db.query(`SELECT ${projection},c.evidence->>'originalJournalId' AS original_journal_id,c.evidence->>'reversalJournalId' AS reversal_journal_id FROM payroll_carrier_premium_correction c JOIN payroll_carrier_premium_authorization a ON a.id=c.premium_authorization_id JOIN payroll_carrier_reversal_authorization r ON r.id=c.reversal_authorization_id JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE i.facility_id=$1 AND i.carrier_key=$2 AND i.invoice_key=$3 ORDER BY i.revision`,[facility,invoice.carrier_key,invoice.invoice_key])).rows
 const date=invoice.invoice.accountingDate||invoice.invoice.invoiceDate
 for(const row of rows)if(date<row.reversal_preview.payload.TxnDate)fail(`Use a premium accounting date on or after the prior reversal date ${row.reversal_preview.payload.TxnDate}.`)
 for(const row of rows)await verifyPair(db,facility,row,options)
}
