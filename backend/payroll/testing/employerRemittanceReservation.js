import {decryptDocument} from '../onboarding.js'
import {retirementReceiptCsv} from '../retirementAllocationReceipt.js'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {allocationFormatFixture} from './retirementAllocationFixture.js'
import {receiptContractFixture} from './retirementReceiptContractFixture.js'
import {id} from './retirementDestinationProvider.js'

// Exercise database guards and public preparation/authorization with synthetic providers.
export async function assertEmployerRemittanceReservation(h,api,run,delivery,planRevisionId){
 await api('/payment-connection',{organizationId:id(1),originatingAccountId:id(2),apiKey:'synthetic-employer-remittance-key',mode:'TEST',reference:'Reviewed synthetic funding account',expectedRevision:0,confirmed:true},'POST',201)
 const path='/retirement-plans/standard/destination',state=await api(path),input={accountId:id(3),planRevisionId,connectionRevision:state.connectionRevision},preview=await api(path+'/preview',input)
 const destination=await api(path,{...input,...preview,requestKey:randomUUID(),confirmed:true,reference:'Independently reviewed synthetic retirement trustee instructions'})
 const mappingPath=`/employees/${delivery.allocations[0].employeeId}/retirement-participant/standard`,mapping=await api(mappingPath)
 await api(mappingPath,{sourceFingerprint:mapping.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),disposition:'VERIFIED',providerPlanId:'SYNTHETIC-EMPLOYER-PLAN',participantId:'SYNTHETIC-EMPLOYER-PARTICIPANT',reference:'Synthetic independently reviewed participant mapping',confirmed:true})
 const fields=['employerMatchingCents','employerNonelectiveCents'],base=allocationFormatFixture()
 const format=await api('/retirement-plans/standard/allocation-format',{planRevisionId,expectedRevision:0,requestKey:randomUUID(),format:{...base,columns:[...base.columns,...fields.map(field=>({field,header:field}))]}})
 const timing=(await api('/retirement-plans/standard/timing')).history[0]
 const insert=(amount=2400,allocations=delivery.allocations)=>h.pool.query(`INSERT INTO payroll_retirement_remittance_authorization(id,facility_id,run_id,plan_id,plan_revision_id,destination_id,format_id,timing_id,amount_cents,basis,encrypted_allocation,request_key,request_fingerprint,reference,outside_activity_reviewed,created_by) VALUES($1,1,$2,'standard',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,99) RETURNING id`,[randomUUID(),run.id,planRevisionId,destination.id,format.id,timing.id,amount,{amountCents:amount,allocations},Buffer.from('Synthetic database boundary fixture; not a deliverable file'),randomUUID(),'synthetic','Synthetic exact employer remittance reservation'])
 await assert.rejects(insert(1400),/exact employee and employer/)
 await assert.rejects(insert(2401),/exact employee and employer/)
 await assert.rejects(insert(),/current reviewed timing, allocation and receipt/)
 const filePath=`/runs/${run.id}/retirement-allocation-file`,sourceInput=async()=>({planId:'standard',sourceFingerprint:(await api('/retirement-remittance-sources')).items.find(r=>r.runId===String(run.id)).sourceFingerprint})
 await api(filePath,await sourceInput(),'POST',409)
 const contract=receiptContractFixture()
 await api('/retirement-plans/standard/receipt-contract',{action:'REVIEW',planRevisionId,allocationFormatId:format.id,expectedRevision:0,requestKey:randomUUID(),contract:{...contract,employerContributionsConfirmed:true,columns:[...contract.columns,...fields.map(field=>({field,header:field}))]}})
 await assert.rejects(insert(2400,delivery.allocations.map(a=>({...a,employerMatchingCents:700,employerNonelectiveCents:300}))),/categories must match/)
 await assert.rejects(insert(2400,[]),/participant allocations/ )
 await assert.rejects(insert(2400,[...delivery.allocations,...delivery.allocations]),/participant allocations/)
 await assert.rejects(insert(2400,delivery.allocations.map(a=>({...a,ordinaryPretaxCents:a.ordinaryPretaxCents+1}))),/participant allocations/)
 const results=await Promise.allSettled([insert(),insert()])
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 const rejected=results.find(r=>r.status==='rejected');assert.match(rejected.reason.message,/already reserved/)
 const row=(await h.pool.query('SELECT id,amount_cents FROM payroll_retirement_remittance_authorization WHERE run_id=$1',[run.id])).rows
 assert.equal(row.length,1);assert.equal(Number(row[0].amount_cents),2400)
 await api(`/retirement-remittance-authorizations/${row[0].id}/cancel`,{requestKey:randomUUID(),confirmed:true,reference:'Cancel unsubmitted synthetic database guard fixture'})
 const source=await sourceInput(),file=await api(filePath,source)
 assert.equal(file.amountCents,2400);assert.equal(file.columns.length,10);assert.equal(file.authorizationWindowOpen,true)
 assert.equal(file.allocations[0].employerMatchingCents,600);assert.equal(file.allocations[0].employerNonelectiveCents,400)
 assert.ok(file.employerReceiptContractId)
 const body={...source,fileFingerprint:file.fingerprint,amountCents:file.amountCents,confirmed:true,outsideActivityReviewed:true,requestKey:randomUUID(),reference:'Reviewed exact synthetic combined allocation and outside funding activity'},authPath=`/runs/${run.id}/retirement-remittance-authorizations`
 await api(authPath,{...body,amountCents:1400},'POST',409)
 const [first,retry]=await Promise.all([api(authPath,body),api(authPath,body)]);assert.equal(first.id,retry.id)
 await api(authPath,{...body,requestKey:randomUUID()},'POST',409)
 const retained=(await h.pool.query('SELECT * FROM payroll_retirement_remittance_authorization WHERE id=$1',[first.id])).rows[0]
 const bytes=decryptDocument(retained.encrypted_allocation,`payroll-retirement-remittance:1:${first.id}`),csv=retirementReceiptCsv(bytes),values=Object.fromEntries(csv[0].map((name,i)=>[name,csv[1][i]]))
 assert.equal(values.totalCents,'24.00');assert.equal(values.employerMatchingCents,'6.00');assert.equal(values.employerNonelectiveCents,'4.00')
 assert.equal(values.ordinaryPretaxCents,'10.00');assert.equal(values.ordinaryRothCents,'4.00')
 assert.equal(retained.basis.employerReceiptContractId,file.employerReceiptContractId)
 // A changed receipt review changes the file identity even when byte columns are identical.
 await api(`/retirement-remittance-authorizations/${first.id}/cancel`,{requestKey:randomUUID(),confirmed:true,reference:'Cancel unsubmitted synthetic public reservation for changed receipt review'})
 await api('/retirement-plans/standard/receipt-contract',{action:'REVIEW',planRevisionId,allocationFormatId:format.id,expectedRevision:1,requestKey:randomUUID(),contract:{...contract,reference:'Renewed provider employer receipt evidence with unchanged columns',employerContributionsConfirmed:true,columns:[...contract.columns,...fields.map(field=>({field,header:field}))]}})
 await api(authPath,{...body,requestKey:randomUUID()},'POST',409)
 const refreshed=await api(filePath,await sourceInput());assert.notEqual(refreshed.fingerprint,file.fingerprint)
 await api('/retirement-plans/standard/receipt-contract',{action:'SUSPEND',expectedRevision:2,requestKey:randomUUID(),confirmed:true,reference:'Suspend synthetic receipt interpretation pending provider review'})
 await api(filePath,await sourceInput(),'POST',409)

}
