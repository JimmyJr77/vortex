import test from 'node:test'
import assert from 'node:assert/strict'
import {i9DifferentSupplementExaminationInput as parse,validateI9DifferentSupplementExamination as validate} from '../i9DifferentSupplementExamination.js'
const context={today:'2026-09-13',dueOn:'2026-10-01',originalExaminedOn:'2026-09-01',attestationKind:'AUTHORIZED_WORKER',eVerify:false}
const retained={recordedOn:context.today,answers:{initials:'RA',supplement:{document:{list:'C',expiresOn:'2032-01-01'},examinationMethod:'PHYSICAL',additionalInformation:'',newName:{}}}}
const examination={examinedOn:context.today,examinerInitials:'RA',identityEvidence:'Reviewer Alice examined the original document.',reverificationRequired:true,requirementSource:'https://www.uscis.gov/i-9-central',requirementEvidence:'Synthetic finite authorization requires review.',employeeChoseDocuments:true,currentAuthorizationReviewed:true,documentsGenuineAndRelated:true,copiesComplete:true,copyIds:['1'],physicalPresence:true,acceptance:'STANDARD',acceptanceSource:'https://www.uscis.gov/i-9-central',acceptanceEvidence:'Synthetic acceptance findings for workflow testing.',authorizationIndefinite:false,authorizationThrough:'2031-01-01',followUpKind:'REVERIFICATION',followUpOn:'2031-01-01',noFurtherReverificationRequired:false}
const input=overrides=>({differentDocumentsConfirmed:true,replacementEvidence:'Employee selected a different authorization document.',examination:{...examination,...overrides}})
test('different Supplement B requires current consistent examiner findings and timely authorization follow-up',()=>{
 assert.deepEqual(validate(parse(input()),retained,context),{dueOn:context.dueOn,late:false,nextFollowUpKind:'REVERIFICATION',nextFollowUpOn:'2031-01-01'})
 for(const change of [{acceptance:'RECEIPT'},{followUpKind:'RECEIPT_REPLACEMENT'},{employeeChoseDocuments:false},{copyIds:['1','1']}])assert.throws(()=>parse(input(change)))
 assert.throws(()=>parse({...input(),differentDocumentsConfirmed:false}),/Confirm/)
 assert.throws(()=>parse({...input(),replacementEvidence:'short'}),/meaningful/)
 for(const [change,pattern] of [[{examinerInitials:'AB'},/initials/],[{examinedOn:'2026-08-31'},/actual examination/],[{examinedOn:'2026-09-14'},/actual examination/],[{physicalPresence:false},/physical presence/],[{followUpOn:'2032-01-01'},/earliest/],[{followUpKind:'OTHER'},/Schedule reverification/],[{authorizationThrough:'2026-09-12'},/expired authorization/]])assert.throws(()=>validate(parse(input(change)),retained,context),pattern)
 assert.throws(()=>validate(parse(input()),{...retained,recordedOn:'2026-09-12'},context),/today/)
 assert.throws(()=>validate(parse(input()),retained,{...context,attestationKind:'CITIZEN'}),/Do not reverify/)
 assert.throws(()=>validate(parse(input()),retained,{...context,dueOn:'2026-09-12'}),/late completion/)
 assert.equal(validate(parse(input({lateReason:'Employee returned with the replacement after the deadline.'})),retained,{...context,dueOn:'2026-09-12'}).late,true)
 const indefinite=parse(input({authorizationIndefinite:true,authorizationThrough:'',followUpKind:'NONE',followUpOn:'',noFurtherReverificationRequired:true}))
 assert.equal(validate(indefinite,retained,{...context,attestationKind:'PERMANENT_RESIDENT'}).nextFollowUpOn,null)
})
test('different Supplement B preserves exception notation and current alternative examination requirements',()=>{
 const notation='RA 09/13/2026: Synthetic authorization extension reviewed.'
 const extended={...retained,answers:{...retained.answers,supplement:{...retained.answers.supplement,document:{list:'A',expiresOn:'2026-09-01'},additionalInformation:notation}}}
 const findings=parse(input({acceptance:'EXTENSION',validUntil:'2030-01-01',formNotation:notation,followUpOn:'2030-01-01'}))
 assert.equal(validate(findings,extended,context).nextFollowUpOn,'2030-01-01')
 assert.throws(()=>validate(findings,retained,context),/exception notation/)
 assert.throws(()=>validate({...findings,examination:{...findings.examination,followUpOn:'2031-01-01'}},extended,context),/earliest/)
 const alternative={goodStanding:true,allSitesEnrolled:true,trainingComplete:true,consistentProcedure:true,copiesReceivedBeforeVideo:true,sameOriginalsPresented:true,liveVideoOn:context.today,qualificationEvidence:'Synthetic current employer and site qualification.',videoEvidence:'Synthetic live video examination of original documents.'}
 const remote=parse(input({physicalPresence:false,alternative})),remoteForm={...retained,answers:{...retained.answers,supplement:{...retained.answers.supplement,examinationMethod:'ALTERNATIVE'}}}
 assert.throws(()=>validate(remote,remoteForm,context),/qualifications/)
 assert.equal(validate(remote,remoteForm,{...context,eVerify:true}).late,false)
 assert.throws(()=>parse(input({physicalPresence:false,alternative:{...alternative,trainingComplete:false}})),/training/)
})
