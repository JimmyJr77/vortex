import test from 'node:test'
import assert from 'node:assert/strict'
import {i9DifferentDocumentsExaminationInput as input,validateI9DifferentDocumentsExamination as validate} from '../i9DifferentDocumentsExamination.js'
const context={today:'2026-09-13',offerAcceptedOn:'2026-09-01',hireDate:'2026-09-01',originalExaminedOn:'2026-09-01',dueOn:'2026-11-30',eVerify:false,attestationKind:'CITIZEN'}
const doc={title:'Synthetic document',issuingAuthority:'Synthetic issuer',number:'SYNTHETIC',expiresOn:'2030-01-01'}
const review={recordedOn:context.today,answers:{initials:'RA',section2:{documentChoice:'LIST_B_C',listB:doc,listC:doc,firstDayEmployed:context.hireDate,examinationMethod:'PHYSICAL',additionalInformation:''}}}
const row=key=>({rowKey:key,copyIds:[key==='B'?'1':'2'],copiesComplete:true,accepted:true,acceptance:'STANDARD',followUpKind:'NONE',noFollowUpConfirmed:true})
const facts=()=>({differentDocumentsConfirmed:true,authorizationIndefinite:true,authorizationEvidence:'Reviewed retained citizenship and acceptable document evidence.',examination:{examinedOn:context.today,examinerInitials:'RA',identityEvidence:'Authenticated hiring administrator performed the examination.',businessDays:[1,2,3,4,5],closedDates:[],calendarConfirmed:true,shortEmployment:false,employeeChoseDocuments:true,section1Reviewed:true,documentsGenuineAndRelated:true,physicalPresence:true,documents:[row('B'),row('C')]}})
const check=(raw=facts(),r=review,c=context)=>validate(input(raw),r,c)
test('replacement uses the receipt deadline while preserving actual examination and signing dates',()=>{
 assert.deepEqual(check(),{dueOn:'2026-11-30',late:false,authorizationIndefinite:true,authorizationThrough:null,followups:[]})
 assert.throws(()=>check(facts(),review,{...context,dueOn:'2026-09-12'}),/late/)
 const f=facts();f.examination.lateReason='Replacement completion was delayed; actual date retained.'
 assert.equal(check(f,review,{...context,dueOn:'2026-09-12'}).late,true)
 assert.throws(()=>check(facts(),{...review,recordedOn:'2026-09-12'}),/today/)
 const old=facts();old.examination.examinedOn='2026-08-31';assert.throws(()=>check(old),/precede/)
 const future=facts();future.examination.examinedOn='2026-09-14';assert.throws(()=>check(future),/future/)
 const initials=facts();initials.examination.examinerInitials='XX';assert.throws(()=>check(initials),/initials/)
})
test('finite authorization requires a non-identity reverification deadline and citizen expiration is rejected',()=>{
 const f=facts();f.authorizationIndefinite=false;f.authorizationThrough='2026-10-01'
 assert.throws(()=>check(f),/citizen/)
 const worker={...context,attestationKind:'AUTHORIZED_WORKER'}
 assert.throws(()=>check(f,review,worker),/Schedule/)
 const action={noFollowUpConfirmed:false,followUpKind:'REVERIFICATION',followUpOn:'2026-10-01',ruleSource:'https://www.uscis.gov/i-9-central',ruleEvidence:'Verified current employment authorization expiration.'}
 Object.assign(f.examination.documents[1],action)
 assert.equal(check(f,review,worker).followups[0].rowKey,'C')
 assert.throws(()=>check({...f,authorizationThrough:'2026-09-12'},review,worker),/expired/)
 f.examination.documents[1].followUpOn='2026-10-02';assert.throws(()=>check(f,review,worker),/deadline/)
 f.examination.documents=[{...row('B'),...action},row('C')];assert.throws(()=>check(f,review,worker),/Schedule/)
})
test('different-document confirmation, complete rows, actual originals and strict fields are required',()=>{
 assert.throws(()=>input({...facts(),differentDocumentsConfirmed:'true'}),/Confirm/)
 assert.throws(()=>input({...facts(),dueOn:'2030-01-01'}),/fields/)
 assert.throws(()=>input({...facts(),authorizationThrough:'2030-01-01'}),/either/)
 const f=facts();f.examination.documents.pop();assert.throws(()=>check(f),/exactly/)
 const receipt=facts();receipt.examination.documents[0].acceptance='RECEIPT';assert.throws(()=>check(receipt),/another receipt/)
 const ambiguous=facts();ambiguous.examination.physicalPresence='false';assert.throws(()=>input(ambiguous),/explicitly/)
 const physical=facts();physical.examination.physicalPresence=false;assert.throws(()=>check(physical),/physical/)
 assert.throws(()=>check(facts(),review,{...context,eVerify:true}),/photograph/)
})

test('an extension cannot postpone the separately verified authorization deadline',()=>{
 const f=facts(),notation='RA 09/13/2026 Verified applicable document extension.'
 f.authorizationIndefinite=false;f.authorizationThrough='2026-10-01'
 Object.assign(f.examination.documents[1],{noFollowUpConfirmed:false,acceptance:'EXTENSION',validUntil:'2031-01-01',formNotation:notation,followUpKind:'REVERIFICATION',followUpOn:'2031-01-01',ruleSource:'https://www.uscis.gov/i-9-central',ruleEvidence:'Examiner retained the applicable document extension evidence.'})
 const r={...review,answers:{...review.answers,section2:{...review.answers.section2,additionalInformation:notation}}},worker={...context,attestationKind:'AUTHORIZED_WORKER'}
 assert.throws(()=>check(f,r,worker),/authorization deadline/)
 f.examination.documents[1].followUpOn='2026-10-01'
 assert.equal(check(f,r,worker).followups[0].dueOn,'2026-10-01')
 assert.throws(()=>check(f,r,{...worker,dueOn:undefined}),/receipt deadline/)
})
test('alternative replacement examination keeps matching video, qualification, and List B photo evidence',()=>{
 const f=facts();Object.assign(f.examination,{physicalPresence:false,listBPhotoConfirmed:true,alternative:{goodStanding:true,allSitesEnrolled:true,trainingComplete:true,consistentProcedure:true,copiesReceivedBeforeVideo:true,sameOriginalsPresented:true,liveVideoOn:context.today,qualificationEvidence:'Verified hiring-site enrollment and examiner training.',videoEvidence:'Live video examination of the same original documents.'}})
 const r={...review,answers:{...review.answers,section2:{...review.answers.section2,examinationMethod:'ALTERNATIVE'}}}
 assert.throws(()=>check(f,r),/qualification/)
 assert.equal(check(f,r,{...context,eVerify:true}).late,false)
 f.examination.alternative.liveVideoOn='2026-09-12';assert.throws(()=>check(f,r,{...context,eVerify:true}),/qualification/)
})
