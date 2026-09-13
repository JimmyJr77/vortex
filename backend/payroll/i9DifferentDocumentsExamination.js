import {i9ExaminationInput,validateI9Examination} from './i9Examination.js'
const fail=message=>Object.assign(new Error(message),{status:400})
const date=(v,label)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw fail(`Record a real ${label}.`);return v}
export function i9DifferentDocumentsExaminationInput(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['examination','differentDocumentsConfirmed','authorizationIndefinite','authorizationThrough','authorizationEvidence'].includes(k)))throw fail('Review the different-document examination fields.')
 if(raw.differentDocumentsConfirmed!==true||typeof raw.authorizationIndefinite!=='boolean')throw fail('Confirm different acceptable documents and answer whether current authorization is indefinite.')
 if(typeof raw.authorizationEvidence!=='string'||raw.authorizationEvidence.trim().length<12||raw.authorizationEvidence.length>2000||/[\u0000-\u001f\u007f]/.test(raw.authorizationEvidence))throw fail('Record the evidence establishing current employment authorization.')
 const authorizationThrough=raw.authorizationThrough==null||raw.authorizationThrough===''?'':date(raw.authorizationThrough,'authorization expiration')
 if(raw.authorizationIndefinite?!!authorizationThrough:!authorizationThrough)throw fail('Use either indefinite authorization or its verified expiration date.')
 const examination=i9ExaminationInput(raw.examination)
 if(typeof raw.examination.physicalPresence!=='boolean'||raw.examination.documents.some(d=>typeof d.noFollowUpConfirmed!=='boolean'||(d.followUpKind!=='NONE'&&d.noFollowUpConfirmed)))throw fail('Answer physical presence and each document’s follow-up decision explicitly.')
 if(examination.documents.some(d=>d.acceptance==='RECEIPT'||d.followUpKind==='RECEIPT_REPLACEMENT'))throw fail('This certification requires the different acceptable documents; another receipt needs its receipt workflow.')
 return {examination,differentDocumentsConfirmed:true,authorizationIndefinite:raw.authorizationIndefinite,authorizationThrough,authorizationEvidence:raw.authorizationEvidence.trim().normalize('NFC')}
}
// Deadline is supplied from the retained receipt task, never from client fields.
// Initial-hire examination rules stay shared; receipt completion has its own date.
export function validateI9DifferentDocumentsExamination(facts,review,context){
 const exam=facts.examination,dueOn=date(context.dueOn,'receipt deadline'),today=date(context.today,'signing date'),original=date(context.originalExaminedOn,'original receipt examination date')
 if(review.recordedOn!==today)throw fail('Prepare the replacement with today’s actual date before signing.')
 if(exam.examinedOn<original)throw fail('The replacement examination cannot precede the original receipt examination.')
 if(exam.examinerInitials!==review.answers.initials.trim().normalize('NFC'))throw fail('Use the same examiner initials as the reviewed replacement explanation.')
 if(!['CITIZEN','NONCITIZEN_NATIONAL','PERMANENT_RESIDENT','AUTHORIZED_WORKER'].includes(context.attestationKind))throw fail('Review the original employee attestation.')
 if(['CITIZEN','NONCITIZEN_NATIONAL'].includes(context.attestationKind)&&!facts.authorizationIndefinite)throw fail('Do not impose an authorization expiration on a citizen or noncitizen national.')
 if(!facts.authorizationIndefinite){
  if(facts.authorizationThrough<today)throw fail('Resolve expired employment authorization before signing.')
  if(!exam.documents.some(d=>d.rowKey!=='B'&&d.followUpKind==='REVERIFICATION'&&d.followUpOn&&d.followUpOn<=facts.authorizationThrough))throw fail('Schedule reverification by the current verified authorization deadline.')
 }
 const timing=validateI9Examination(exam,review.answers.section2,{...context,authorizationExpiresOn:facts.authorizationIndefinite?null:facts.authorizationThrough},{completionDueOn:dueOn})
 return {...timing,authorizationIndefinite:facts.authorizationIndefinite,authorizationThrough:facts.authorizationThrough||null,followups:exam.documents.filter(d=>d.followUpKind!=='NONE').map(d=>({rowKey:d.rowKey,kind:d.followUpKind,dueOn:d.followUpOn,ruleSource:d.ruleSource,ruleEvidence:d.ruleEvidence}))}
}
