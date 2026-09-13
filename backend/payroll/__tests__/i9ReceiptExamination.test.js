import test from 'node:test'
import assert from 'node:assert/strict'
import {i9ReceiptExaminationInput,validateI9ReceiptExamination} from '../i9ReceiptExamination.js'
const findings=()=>({examinedOn:'2026-09-13',identityEvidence:'Authenticated examiner met with this employee.',actualReplacementConfirmed:true,receiptMatchEvidence:'The actual passport replaces the lost passport receipt.',documentsGenuineAndRelated:true,copiesComplete:true,copyIds:['1'],examinationMethod:'PHYSICAL',physicalPresence:true,acceptance:'STANDARD',acceptanceSource:'https://www.uscis.gov/i-9-central',acceptanceEvidence:'Original unexpired passport matches the retained receipt.',validUntil:'2036-01-01',authorizationIndefinite:true,authorizationThrough:'',documentRequiresReverification:false,followUpKind:'NONE',followUpOn:'',noFurtherFollowupConfirmed:true})
const answers=()=>({sourceKind:'SECTION2',rowKey:'A1',amendedOn:'2026-09-13',replacement:{expiresOn:'2036-01-01'},explanation:'Actual passport replaces the lost passport receipt.'})
const context=()=>({today:'2026-09-13',dueOn:'2026-11-30',originalExaminedOn:'2026-09-01',attestationKind:'CITIZEN',eVerify:false})
const check=(f=findings(),a=answers(),c=context())=>validateI9ReceiptExamination(i9ReceiptExaminationInput(f),a,c)
test('actual receipt replacement can complete for a citizen without reverification',()=>{
 assert.deepEqual(check(),{dueOn:'2026-11-30',late:false,nextFollowUpKind:'NONE',nextFollowUpOn:null})
 assert.throws(()=>check({...findings(),documentRequiresReverification:true}),/Do not impose/)
 assert.throws(()=>check({...findings(),followUpKind:'REVERIFICATION',followUpOn:'2036-01-01',noFurtherFollowupConfirmed:false}),/Do not impose/)
 assert.throws(()=>check({...findings(),actualReplacementConfirmed:false}),/Confirm/)
 assert.throws(()=>check({...findings(),acceptance:'RECEIPT'}),/Another receipt/)
})
test('actual dates, late reason and reviewed amendment date cannot be backdated',()=>{
 assert.throws(()=>check({...findings(),examinedOn:'2026-08-31'}),/actual examination/)
 assert.throws(()=>check({...findings(),examinedOn:'2026-09-14'}),/actual examination/)
 assert.throws(()=>check(findings(),{...answers(),amendedOn:'2026-09-12'}),/today/)
 assert.throws(()=>check(findings(),answers(),{...context(),dueOn:'2026-09-12'}),/late completion/)
 assert.equal(check({...findings(),lateReason:'The actual replacement arrived after the recorded deadline.'},answers(),{...context(),dueOn:'2026-09-12'}).late,true)
})
test('required confirmations, copy selection and official references reject malformed or coerced findings',()=>{
 for(const bad of [{copiesComplete:false},{documentsGenuineAndRelated:false},{copyIds:[]},{copyIds:['1','1']},{copyIds:['9223372036854775808']},{physicalPresence:'true'},{authorizationIndefinite:'true'},{examinedOn:'2026-02-30'},{acceptanceSource:'https://uscis.gov.attacker.example/rule'},{acceptanceSource:'http://uscis.gov/rule'},{acceptanceSource:'https://user:password@uscis.gov/rule'},{unknown:true},{receiptMatchEvidence:'yes'}])assert.throws(()=>check({...findings(),...bad}),e=>e.status===400)
})
test('finite authorization requires a follow-up by its earliest applicable deadline',()=>{
 const c={...context(),attestationKind:'AUTHORIZED_WORKER'},a={...answers(),replacement:{expiresOn:'2028-01-01'}}
 const f={...findings(),validUntil:'2028-01-01',authorizationIndefinite:false,authorizationThrough:'2027-12-01',documentRequiresReverification:true,followUpKind:'REVERIFICATION',followUpOn:'2027-12-01',noFurtherFollowupConfirmed:false}
 assert.equal(check(f,a,c).nextFollowUpOn,'2027-12-01')
 assert.throws(()=>check({...f,followUpOn:'2028-01-01'},a,c),/earliest/)
 assert.throws(()=>check({...f,followUpKind:'NONE',followUpOn:''},a,c),/Schedule required/)
 assert.throws(()=>check({...f,authorizationThrough:'2026-09-12'},a,c),/current valid/)
 assert.throws(()=>check(f,{...a,rowKey:'B'},c),/List B/)
 assert.throws(()=>check({...f,authorizationIndefinite:true},a,c),/Indefinite/)
})
test('expired replacement requires exception evidence on the reviewed amendment',()=>{
 const evidence='Applicable automatic extension evidence for this replacement.'
 const a={...answers(),replacement:{expiresOn:'2026-09-01'},explanation:evidence},c={...context(),attestationKind:'AUTHORIZED_WORKER'}
 const f={...findings(),acceptance:'EXTENSION',acceptanceEvidence:evidence,validUntil:'2027-01-01',authorizationIndefinite:false,authorizationThrough:'2027-01-01',documentRequiresReverification:true,followUpKind:'REVERIFICATION',followUpOn:'2027-01-01',noFurtherFollowupConfirmed:false}
 assert.equal(check(f,a,c).nextFollowUpKind,'REVERIFICATION')
 assert.throws(()=>check({...f,acceptance:'STANDARD'},a,c),/expired/)
 assert.throws(()=>check(f,{...a,explanation:'Missing exception evidence.'},c),/reviewed amendment/)
 assert.throws(()=>check({...f,validUntil:'2026-09-12'},a,c),/currently valid/)
})
test('alternative examination requires current qualification, live video and matching originals',()=>{
 const alternative={goodStanding:true,allSitesEnrolled:true,trainingComplete:true,consistentProcedure:true,copiesReceivedBeforeVideo:true,sameOriginalsPresented:true,liveVideoOn:'2026-09-13',qualificationEvidence:'Hiring site enrollment and examiner training verified.',videoEvidence:'Employee presented the same originals during live video.'}
 const f={...findings(),examinationMethod:'ALTERNATIVE',physicalPresence:false,alternative},c={...context(),eVerify:true}
 assert.equal(check(f,answers(),c).late,false)
 assert.throws(()=>check(f),/alternative-procedure/)
 assert.throws(()=>check({...f,alternative:{...alternative,liveVideoOn:'2026-09-12'}},answers(),c),/alternative-procedure/)
 assert.throws(()=>check({...f,alternative:{...alternative,sameOriginalsPresented:false}},answers(),c),/Confirm/)
 assert.throws(()=>check({...findings(),alternative},answers(),c),/physical examination/)
})
