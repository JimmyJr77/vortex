import test from 'node:test'
import assert from 'node:assert/strict'
import {i9SupplementBExaminationInput,validateI9SupplementBExamination} from '../i9SupplementBExamination.js'
const source='https://www.uscis.gov/i-9-central'
const findings=()=>({examinedOn:'2026-09-13',examinerInitials:'RA',identityEvidence:'Named hiring administrator verified in person.',reverificationRequired:true,requirementSource:source,requirementEvidence:'Current authorization requires the recorded reverification.',employeeChoseDocuments:true,currentAuthorizationReviewed:true,documentsGenuineAndRelated:true,copiesComplete:true,copyIds:['1'],physicalPresence:true,acceptance:'STANDARD',acceptanceSource:source,acceptanceEvidence:'Current original employment authorization document reviewed.',validUntil:'2028-09-13',authorizationIndefinite:false,authorizationThrough:'2028-09-13',followUpKind:'REVERIFICATION',followUpOn:'2028-09-13',noFurtherReverificationRequired:false})
const answers=()=>({document:{list:'A',title:'Employment Authorization Document',number:'SYNTHETIC',expiresOn:'2028-09-13'},examinationMethod:'PHYSICAL',additionalInformation:'',newName:{}})
const context=()=>({today:'2026-09-13',dueOn:'2026-09-13',originalExaminedOn:'2026-01-01',attestationKind:'AUTHORIZED_WORKER',eVerify:false,authorizationExpiresOn:'2026-09-12'})
const check=(f=findings(),a=answers(),c=context())=>validateI9SupplementBExamination(i9SupplementBExaminationInput(f),a,c)
test('reverification evaluates current authorization, rejects prohibited List B/citizen review and preserves actual late timing',()=>{
 assert.deepEqual(check(),{dueOn:'2026-09-13',late:false,nextFollowUpKind:'REVERIFICATION',nextFollowUpOn:'2028-09-13'})
 assert.throws(()=>check(findings(),answers(),{...context(),attestationKind:'CITIZEN'}),/Do not reverify/)
 assert.throws(()=>check(findings(),{...answers(),document:{...answers().document,list:'B'}}),/List B/)
 assert.throws(()=>check({...findings(),examinedOn:'2026-09-14'}),/actual examination/)
 assert.throws(()=>check(findings(),answers(),{...context(),dueOn:'2026-09-12'}),/late/)
 assert.equal(check({...findings(),lateReason:'Employee and examiner were unavailable before the deadline.'},answers(),{...context(),dueOn:'2026-09-12'}).late,true)
})
test('required confirmations and official rules reject silent coercions and unrelated URLs',()=>{
 for(const key of ['reverificationRequired','employeeChoseDocuments','currentAuthorizationReviewed','documentsGenuineAndRelated','copiesComplete'])assert.throws(()=>check({...findings(),[key]:false}),/Confirm/)
 for(const bad of [{copyIds:['1','1']},{copyIds:[]},{copyIds:['9223372036854775808']},{authorizationIndefinite:'false'},{physicalPresence:undefined},{requirementSource:'https://uscis.gov.attacker.example/rule'},{acceptanceSource:'http://uscis.gov/rule'},{requirementSource:'https://user:password@uscis.gov/rule'},{examinedOn:'2026-02-30'},{unknown:true}])assert.throws(()=>check({...findings(),...bad}),e=>e.status===400)
})
test('replacement receipt and extension exceptions require dated form evidence and the correct next action',()=>{
 const notation='RA 09/13/2026: Reviewed the applicable document exception.'
 const a={...answers(),document:{...answers().document,expiresOn:'2026-09-01'},additionalInformation:notation}
 const f={...findings(),acceptance:'EXTENSION',validUntil:'2027-01-01',authorizationThrough:'2027-01-01',followUpOn:'2027-01-01',formNotation:notation}
 assert.equal(check(f,a).nextFollowUpKind,'REVERIFICATION')
 assert.throws(()=>check({...f,acceptance:'STANDARD'},a),/expired document/)
 assert.throws(()=>check({...f,formNotation:''},a),/notation/)
 assert.throws(()=>check(f,{...a,additionalInformation:'Uninitialed notation.'}),/notation/)
 assert.throws(()=>check({...f,followUpOn:'2027-01-02'},a),/earliest/)
 assert.throws(()=>check({...f,acceptance:'RECEIPT'},a),/replacement/)
 assert.equal(check({...f,acceptance:'RECEIPT',followUpKind:'RECEIPT_REPLACEMENT'},a).nextFollowUpKind,'RECEIPT_REPLACEMENT')
})
test('indefinite authorization may close future review only with explicit evidence and no receipt/extension outstanding',()=>{
 const a={...answers(),document:{list:'C',title:'Unrestricted Social Security card',number:'SYNTHETIC',expiresOn:''}}
 const f={...findings(),validUntil:'',authorizationIndefinite:true,authorizationThrough:'',followUpKind:'NONE',followUpOn:'',noFurtherReverificationRequired:true}
 assert.equal(check(f,a).nextFollowUpKind,'NONE')
 assert.throws(()=>check({...f,authorizationThrough:'2028-01-01'},a),/Indefinite/)
 assert.throws(()=>check({...f,noFurtherReverificationRequired:false},a),/No-follow-up/)
 assert.throws(()=>check({...findings(),authorizationThrough:'2026-09-12'}),/expired authorization/)
 assert.throws(()=>check(findings(),{...answers(),newName:{lastName:'Changed'}}),/name change/)
})
test('alternative procedure requires current employer qualification and the same live-video examination date',()=>{
 const alternative={goodStanding:true,allSitesEnrolled:true,trainingComplete:true,consistentProcedure:true,copiesReceivedBeforeVideo:true,sameOriginalsPresented:true,liveVideoOn:'2026-09-13',qualificationEvidence:'Verified hiring-site enrollment, standing and examiner training.',videoEvidence:'Employee presented the same original documents in live video.'}
 const f={...findings(),physicalPresence:false,alternative},a={...answers(),examinationMethod:'ALTERNATIVE'},c={...context(),eVerify:true}
 assert.equal(check(f,a,c).late,false)
 assert.throws(()=>check(f,a),/alternative-procedure/)
 assert.throws(()=>check({...f,alternative:{...alternative,liveVideoOn:'2026-09-12'}},a,c),/alternative-procedure/)
 assert.throws(()=>check({...f,alternative:{...alternative,goodStanding:false}},a,c),/Confirm/)
 assert.throws(()=>check(f,answers(),c),/physical presence/)
})
