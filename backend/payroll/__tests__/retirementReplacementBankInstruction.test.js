import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementReplacementBankInstruction} from '../retirementReplacementBankInstruction.js'
import {modernTreasuryRetirementInstruction} from '../modernTreasuryRetirementPayments.js'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
function fixture(){
 const allocation={destinationRevisionId:id(3),fundingRevisionId:4,amountCents:1400,withheldDate:'2026-09-18'}
 const authorization={id:id(1),original_authorization_id:id(2),return_authorization_id:id(6),facility_id:'1',file_name:'replacement.csv',preview:{originalAuthorizationId:id(2),returnAuthorizationId:id(6),fileName:'replacement.csv',runId:'7',planId:'standard',amountCents:1400,originalWithheldDate:'2026-09-18',newAllocationRequired:true,priorBatchReversedConfirmed:true,outsideActivityReviewed:true,lateCorrectionReviewed:true,allocation,timing:{depositDate:'2026-09-29',submissionAt:'2026-09-28T16:00:00Z'}}}
 const funding={id:4,configuration:{mode:'TEST',originatingAccountId:id(8)}},destination={id:id(3),connection_id:4,facility_id:1,plan_id:'standard',destination:{accountId:id(9),counterpartyId:id(10),fingerprint:'a'.repeat(64)}}
 return {authorization,funding,destination,options:{now:new Date('2026-09-25T15:00:00Z')}}
}
test('replacement bank instruction preserves original withholding and uses a separate stable payment identity',()=>{
 const f=fixture(),intent=retirementReplacementBankInstruction(f.authorization,f.funding,f.destination,f.options),payload=modernTreasuryRetirementInstruction(intent)
 assert.equal(intent.originalAuthorizationId,id(2));assert.equal(intent.originalWithheldDate,'2026-09-18');assert.equal(intent.paymentDate,'2026-09-29');assert.equal(payload.external_id,`vortex_retirement_${id(1)}`);assert.equal(payload.amount,1400);assert.equal(payload.receiving_account_id,id(9));assert.equal(payload.send_remittance_advice,false)
 assert.deepEqual(retirementReplacementBankInstruction(f.authorization,f.funding,f.destination,f.options),intent)
})
test('replacement instruction rejects changed scope, source amounts, reused identities and closed timing',()=>{
 const changes=[f=>{f.authorization.id=id(2)},f=>{f.authorization.preview.amountCents=1500},f=>{f.authorization.preview.originalWithheldDate='2026-09-19'},f=>{f.destination.facility_id=2},f=>{f.destination.plan_id='other'},f=>{f.funding.id=5},f=>{f.authorization.preview.outsideActivityReviewed=false},f=>{f.authorization.preview.timing.depositDate='2026-09-27'},f=>{f.options.now=new Date('2026-09-28T16:00:00Z')}]
 for(const change of changes){const f=fixture();change(f);assert.throws(()=>retirementReplacementBankInstruction(f.authorization,f.funding,f.destination,f.options))}
})
