import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {allocationFormatFixture} from './retirementAllocationFixture.js'
import {receiptContractFixture} from './retirementReceiptContractFixture.js'
import {id} from './retirementDestinationProvider.js'

// Database-boundary exercise using the isolated approved employer payroll fixture.
// Public file preparation remains gated; these bytes are not provider instructions.
export async function assertEmployerRemittanceReservation(h,api,run,delivery,planRevisionId){
 await api('/payment-connection',{organizationId:id(1),originatingAccountId:id(2),apiKey:'synthetic-employer-remittance-key',mode:'TEST',reference:'Reviewed synthetic funding account',expectedRevision:0,confirmed:true},'POST',201)
 const path='/retirement-plans/standard/destination',state=await api(path),input={accountId:id(3),planRevisionId,connectionRevision:state.connectionRevision},preview=await api(path+'/preview',input)
 const destination=await api(path,{...input,...preview,requestKey:randomUUID(),confirmed:true,reference:'Independently reviewed synthetic retirement trustee instructions'})
 const fields=['employerMatchingCents','employerNonelectiveCents'],base=allocationFormatFixture()
 const format=await api('/retirement-plans/standard/allocation-format',{planRevisionId,expectedRevision:0,requestKey:randomUUID(),format:{...base,columns:[...base.columns,...fields.map(field=>({field,header:field}))]}})
 const timing=(await api('/retirement-plans/standard/timing')).history[0]
 const insert=(amount=2400,allocations=delivery.allocations)=>h.pool.query(`INSERT INTO payroll_retirement_remittance_authorization(id,facility_id,run_id,plan_id,plan_revision_id,destination_id,format_id,timing_id,amount_cents,basis,encrypted_allocation,request_key,request_fingerprint,reference,outside_activity_reviewed,created_by) VALUES($1,1,$2,'standard',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,99) RETURNING id`,[randomUUID(),run.id,planRevisionId,destination.id,format.id,timing.id,amount,{amountCents:amount,allocations},Buffer.from('Synthetic database boundary fixture; not a deliverable file'),randomUUID(),'synthetic','Synthetic exact employer remittance reservation'])
 await assert.rejects(insert(1400),/exact employee and employer/)
 await assert.rejects(insert(2401),/exact employee and employer/)
 await assert.rejects(insert(),/current reviewed timing, allocation and receipt/)
 const contract=receiptContractFixture()
 await api('/retirement-plans/standard/receipt-contract',{action:'REVIEW',planRevisionId,allocationFormatId:format.id,expectedRevision:0,requestKey:randomUUID(),contract:{...contract,employerContributionsConfirmed:true,columns:[...contract.columns,...fields.map(field=>({field,header:field}))]}})
 await assert.rejects(insert(2400,delivery.allocations.map(a=>({...a,employerMatchingCents:700,employerNonelectiveCents:300}))),/categories must match/)
 await assert.rejects(insert(2400,[]),/participant allocations/ )
 await assert.rejects(insert(2400,[...delivery.allocations,...delivery.allocations]),/participant allocations/)
 await assert.rejects(insert(2400,delivery.allocations.map(a=>({...a,ordinaryPretaxCents:a.ordinaryPretaxCents+1}))),/participant allocations/)
 const results=await Promise.allSettled([insert(),insert()])
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 const rejected=results.find(r=>r.status==='rejected');assert.match(rejected.reason.message,/already reserved/)
 const row=(await h.pool.query('SELECT amount_cents FROM payroll_retirement_remittance_authorization WHERE run_id=$1',[run.id])).rows
 assert.equal(row.length,1);assert.equal(Number(row[0].amount_cents),2400)
}
