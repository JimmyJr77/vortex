import test from 'node:test'
import assert from 'node:assert/strict'
import {i9ExaminationInput,i9CompletionDueOn,validateI9Examination} from '../i9Examination.js'
const context={today:'2026-09-03',offerAcceptedOn:'2026-09-01',hireDate:'2026-09-01',eVerify:false,attestationKind:'CITIZEN'}
const answers={documentChoice:'LIST_A',listA:[{title:'U.S. Passport',issuingAuthority:'Department of State',number:'SYNTHETIC',expiresOn:'2030-01-01'}],firstDayEmployed:'2026-09-01',additionalInformation:'',examinationMethod:'PHYSICAL'}
const input=()=>({examinedOn:'2026-09-02',examinerInitials:'RA',identityEvidence:'Authenticated hiring administrator and examiner.',businessDays:[1,2,3,4,5],closedDates:[],calendarConfirmed:true,shortEmployment:false,employeeChoseDocuments:true,section1Reviewed:true,documentsGenuineAndRelated:true,physicalPresence:true,documents:[{rowKey:'A1',copyIds:['1'],copiesComplete:true,accepted:true,acceptance:'STANDARD',followUpKind:'NONE',noFollowUpConfirmed:true}]})
const validate=(value,form=answers,ctx=context)=>validateI9Examination(i9ExaminationInput(value),form,ctx)
test('business calendar handles closures and short employment; late signatures require explanation',()=>{
 assert.equal(i9CompletionDueOn('2026-09-04',[1,2,3,4,5],['2026-09-07'],false),'2026-09-10')
 assert.equal(i9CompletionDueOn('2026-09-04',[1,2,3,4,5],[],true),'2026-09-04')
 assert.deepEqual(validate(input()),{dueOn:'2026-09-04',late:false})
 assert.throws(()=>validate(input(),answers,{...context,today:'2026-09-05'}),/late/)
 assert.equal(validate({...input(),lateReason:'Recorded examination was certified late.'},answers,{...context,today:'2026-09-05'}).late,true)
 assert.throws(()=>validate({...input(),examinedOn:'2026-09-04'}),/future/)
 assert.throws(()=>validate(input(),{...answers,firstDayEmployed:'2026-09-02'}),/hire date/)
})
test('alternative examination needs current participation and attributable live-video qualifications',()=>{
 const value={...input(),physicalPresence:false,alternative:{goodStanding:true,allSitesEnrolled:true,trainingComplete:true,consistentProcedure:true,copiesReceivedBeforeVideo:true,sameOriginalsPresented:true,liveVideoOn:'2026-09-02',qualificationEvidence:'Verified site enrollment and examiner training records.',videoEvidence:'Live video examination of these same original documents.'}},form={...answers,examinationMethod:'ALTERNATIVE'}
 assert.throws(()=>validate(value,form),/qualification/)
 assert.equal(validate(value,form,{...context,eVerify:true}).late,false)
 assert.throws(()=>validate({...value,alternative:{...value.alternative,trainingComplete:false}},form,{...context,eVerify:true}),/training/)
 assert.throws(()=>validate({...value,physicalPresence:true},form,{...context,eVerify:true}),/qualification/)
})
test('exceptions require an official source, matching signed notation and follow-up; expiry has no silent bypass',()=>{
 const expired={...answers,listA:[{...answers.listA[0],expiresOn:'2026-08-01'}]}
 assert.throws(()=>validate(input(),expired),/expired document/)
 const notation='RA 09/02/2026 Synthetic replacement receipt examined.'
 const value=input();Object.assign(value.documents[0],{acceptance:'RECEIPT',ruleSource:'https://www.uscis.gov/i-9-central',ruleEvidence:'Examiner verified the applicable replacement receipt rule.',validUntil:'2026-11-01',formNotation:notation,followUpKind:'RECEIPT_REPLACEMENT',followUpOn:'2026-10-30',noFollowUpConfirmed:false})
 const form={...expired,additionalInformation:notation}
 assert.equal(validate(value,form).late,false)
 assert.throws(()=>validate(value,expired),/notation/)
 assert.throws(()=>validate({...value,shortEmployment:true,lateReason:'Synthetic delayed completion for this test.'},form),/Receipts cannot/)
 assert.throws(()=>validate({...value,documents:[{...value.documents[0],ruleSource:'https://uscis.gov.attacker.example/rule'}]},form),/official/)
 assert.throws(()=>validate({...value,documents:[{...value.documents[0],followUpOn:'2026-11-02'}]},form),/validity/)
 assert.throws(()=>validate({...value,documents:[{...value.documents[0],followUpKind:'REVERIFICATION'}]},form),/citizen/)
})
test('finite employment authorization needs timely reverification and selected copies cannot repeat',()=>{
 const worker={...context,attestationKind:'AUTHORIZED_WORKER',authorizationExpiresOn:'2026-10-01'}
 assert.throws(()=>validate(input(),answers,worker),/reverification/)
 const value=input();Object.assign(value.documents[0],{followUpKind:'REVERIFICATION',followUpOn:'2026-09-30',ruleSource:'https://www.uscis.gov/i-9-central',ruleEvidence:'Examiner verified the employment authorization expiration.'})
 assert.equal(validate(value,answers,worker).late,false)
 assert.throws(()=>validate({...value,documents:[{...value.documents[0],copyIds:['1','1']}]}),/only once/)
 assert.throws(()=>validate({...value,calendarConfirmed:false}),/calendar/)
})
