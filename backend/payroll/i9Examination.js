import {i9DocumentEntries} from './i9DocumentEntries.js'
export const I9_EMPLOYER_ATTESTATION='I attest, under penalty of perjury, that (1) I have examined the documentation presented by the above-named employee, (2) the above-listed documentation appears to be genuine and to relate to the employee named, and (3) to the best of my knowledge, the employee is authorized to work in the United States.'
const fail=message=>Object.assign(new Error(message),{status:400})
const object=(value,keys,label)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw fail(`Review the ${label} fields.`);return value}
const text=(value,label,required=true,max=2000)=>{if(value==null||value===''){if(required)throw fail(`Complete ${label}.`);return ''}if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw fail(`Review ${label}.`);return value.trim().normalize('NFC')}
const date=(value,label)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw fail(`Use a valid date for ${label}.`);return value}
const yes=(value,label)=>{if(value!==true)throw fail(`Confirm ${label}.`);return true}
const boolean=(value,label)=>{if(typeof value!=='boolean')throw fail(`Answer ${label}.`);return value}
const id=value=>{if(!/^[1-9]\d{0,18}$/.test(String(value))||BigInt(value)>9223372036854775807n)throw fail('Select a retained copy.');return String(BigInt(value))}
const source=value=>{const raw=text(value,'official rule reference');let url;try{url=new URL(raw)}catch{throw fail('Use an official HTTPS rule reference.')}if(url.protocol!=='https:'||url.username||url.password||url.search||!['uscis.gov','e-verify.gov','ice.gov','dhs.gov','justice.gov','govinfo.gov','federalregister.gov'].some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`)))throw fail('Use an official I-9 rule reference without credentials or query parameters.');return url.href}
// Normalize separately so an unchanged historical signing retry does not depend
// on a later wall-clock date. Legal/document acceptance remains examiner-owned.
export function i9ExaminationInput(value){
 const b=object(value,['examinedOn','examinerInitials','identityEvidence','businessDays','closedDates','calendarConfirmed','shortEmployment','lateReason','employeeChoseDocuments','section1Reviewed','documentsGenuineAndRelated','physicalPresence','listBPhotoConfirmed','alternative','documents'],'examination')
 if(!Array.isArray(b.businessDays)||!b.businessDays.length||b.businessDays.some(n=>!Number.isInteger(n)||n<0||n>6)||new Set(b.businessDays).size!==b.businessDays.length)throw fail('Select the employer’s actual business days.')
 if(!Array.isArray(b.closedDates)||b.closedDates.length>366||new Set(b.closedDates).size!==b.closedDates.length)throw fail('Review the employer closure dates.')
 if(!Array.isArray(b.documents)||!b.documents.length||b.documents.length>3)throw fail('Review every presented document entry.')
 const documents=b.documents.map(raw=>{
  const d=object(raw,['rowKey','copyIds','copiesComplete','accepted','acceptance','ruleSource','ruleEvidence','validUntil','formNotation','followUpKind','followUpOn','noFollowUpConfirmed'],'document examination')
  if(!['A1','A2','A3','B','C'].includes(d.rowKey)||!['STANDARD','RECEIPT','EXTENSION','OTHER_ACCEPTABLE'].includes(d.acceptance)||!['NONE','RECEIPT_REPLACEMENT','REVERIFICATION','OTHER'].includes(d.followUpKind))throw fail('Select the document’s acceptance and follow-up decisions.')
  if(!Array.isArray(d.copyIds)||!d.copyIds.length||d.copyIds.length>50)throw fail('Select the copies that contain this document’s required pages.')
  const copyIds=d.copyIds.map(id).sort((a,b)=>BigInt(a)<BigInt(b)?-1:1)
  if(new Set(copyIds).size!==copyIds.length)throw fail('Select each copy only once.')
  return {rowKey:d.rowKey,copyIds,copiesComplete:yes(d.copiesComplete,'the selected copies are clear and include every required side/page'),accepted:yes(d.accepted,'this document is acceptable for the chosen list or combination'),acceptance:d.acceptance,ruleSource:d.ruleSource?source(d.ruleSource):'',ruleEvidence:text(d.ruleEvidence,'document acceptance evidence',false),validUntil:d.validUntil?date(d.validUntil,'document validity through date'):'',formNotation:text(d.formNotation,'the notation retained on the form',false,1000),followUpKind:d.followUpKind,followUpOn:d.followUpOn?date(d.followUpOn,'document follow-up date'):'',noFollowUpConfirmed:d.noFollowUpConfirmed===true}
 }).sort((a,b)=>a.rowKey.localeCompare(b.rowKey))
 if(new Set(documents.map(d=>d.rowKey)).size!==documents.length)throw fail('Review each document row once.')
 let alternative=null
 if(b.alternative!=null){
  const a=object(b.alternative,['goodStanding','allSitesEnrolled','trainingComplete','consistentProcedure','copiesReceivedBeforeVideo','sameOriginalsPresented','liveVideoOn','qualificationEvidence','videoEvidence'],'alternative procedure')
  alternative={goodStanding:yes(a.goodStanding,'current E-Verify good standing'),allSitesEnrolled:yes(a.allSitesEnrolled,'enrollment of every hiring site using the procedure'),trainingComplete:yes(a.trainingComplete,'required E-Verify training'),consistentProcedure:yes(a.consistentProcedure,'consistent and nondiscriminatory application'),copiesReceivedBeforeVideo:yes(a.copiesReceivedBeforeVideo,'receipt and examination of copies before live video'),sameOriginalsPresented:yes(a.sameOriginalsPresented,'presentation of the same original documents during live video'),liveVideoOn:date(a.liveVideoOn,'live video date'),qualificationEvidence:text(a.qualificationEvidence,'employer/site eligibility and training evidence'),videoEvidence:text(a.videoEvidence,'live video examination evidence')}
 }
 return {examinedOn:date(b.examinedOn,'actual examination date'),examinerInitials:text(b.examinerInitials,'examiner initials',true,20),identityEvidence:text(b.identityEvidence,'examiner identity and authority evidence'),businessDays:[...b.businessDays].sort(),closedDates:b.closedDates.map(v=>date(v,'employer closure')).sort(),calendarConfirmed:yes(b.calendarConfirmed,'the employer business calendar'),shortEmployment:boolean(b.shortEmployment,'whether employment lasts fewer than three business days'),lateReason:text(b.lateReason,'late-completion explanation',false),employeeChoseDocuments:yes(b.employeeChoseDocuments,'the employee chose the acceptable documents'),section1Reviewed:yes(b.section1Reviewed,'review of the current Section 1 and preparer certifications'),documentsGenuineAndRelated:yes(b.documentsGenuineAndRelated,'the documents reasonably appear genuine and relate to this employee'),physicalPresence:b.physicalPresence===true,listBPhotoConfirmed:b.listBPhotoConfirmed===true,alternative,documents}
}
export function i9CompletionDueOn(firstDay,businessDays,closedDates,shortEmployment){
 if(shortEmployment)return firstDay
 const day=new Date(`${firstDay}T00:00:00Z`);let remaining=3
 for(let count=0;count<400;count++){day.setUTCDate(day.getUTCDate()+1);const value=day.toISOString().slice(0,10);if(businessDays.includes(day.getUTCDay())&&!closedDates.includes(value)&&!--remaining)return value}
 throw fail('The employer calendar does not provide three business days.')
}
export function validateI9Examination(exam,answers,context){
 const today=date(context.today,'current signing date'),offer=date(context.offerAcceptedOn,'offer acceptance'),hire=date(context.hireDate,'employee hire date')
 if(answers.firstDayEmployed!==hire)throw fail('Correct the hire date or employer form so the first employment date matches the payroll record.')
 if(exam.examinedOn<offer||exam.examinedOn>today)throw fail('The actual examination date must follow offer acceptance and cannot be in the future.')
 if(exam.identityEvidence.length<12)throw fail('Record the basis for the examiner’s identity and authority.')
 const dueOn=i9CompletionDueOn(hire,exam.businessDays,exam.closedDates,exam.shortEmployment)
 if(today>dueOn&&exam.lateReason.length<12)throw fail('Record why completion is late; the signature will retain today’s actual date.')
 if(answers.examinationMethod==='PHYSICAL'){
  if(!exam.physicalPresence||exam.alternative)throw fail('Confirm physical examination of the original documents in the employee’s presence.')
 }else{
  const a=exam.alternative
  if(context.eVerify!==true||!a||exam.physicalPresence||a.liveVideoOn!==exam.examinedOn||a.qualificationEvidence.length<12||a.videoEvidence.length<12)throw fail('Complete the current employer qualification and live-video evidence for the alternative procedure.')
 }
 if(context.eVerify===true&&answers.documentChoice==='LIST_B_C'&&!exam.listBPhotoConfirmed)throw fail('Confirm the List B identity document contains a photograph for this E-Verify employer.')
 const entries=i9DocumentEntries(answers)
 if(entries.length!==exam.documents.length||entries.some(e=>!exam.documents.some(d=>d.rowKey===e.key)))throw fail('Examine exactly the documents recorded on the reviewed form.')
 for(const d of exam.documents){
  const entry=entries.find(e=>e.key===d.rowKey).values
  if(d.acceptance==='STANDARD'){
   if(entry.expiresOn&&entry.expiresOn<exam.examinedOn)throw fail('An expired document requires its applicable acceptance rule and evidence, not standard unexpired-document treatment.')
   if(d.validUntil&&d.validUntil!==entry.expiresOn)throw fail('Standard document validity must match the expiration recorded on the form.')
  }else{
   if(!d.ruleSource||d.ruleEvidence.length<12||d.formNotation.length<12||!answers.additionalInformation.includes(d.formNotation)||!d.formNotation.includes(exam.examinerInitials)||!d.formNotation.includes(`${exam.examinedOn.slice(5,7)}/${exam.examinedOn.slice(8,10)}/${exam.examinedOn.slice(0,4)}`))throw fail('Record the applicable official rule, evidence and an initialed, dated notation on the reviewed form for this document exception.')
   if(d.acceptance==='RECEIPT'&&exam.shortEmployment)throw fail('Receipts cannot be used for employment lasting fewer than three business days.')
   if(['RECEIPT','EXTENSION'].includes(d.acceptance)&&(!d.validUntil||d.validUntil<today||(d.followUpKind==='NONE'&&d.rowKey!=='B')))throw fail('Record the current receipt/extension validity and required follow-up.')
  }
  if(d.acceptance==='RECEIPT'&&d.followUpKind!=='RECEIPT_REPLACEMENT')throw fail('Schedule the required receipt replacement follow-up.')
  if(d.rowKey==='B'&&d.followUpKind==='REVERIFICATION')throw fail('List B identity documents do not establish authorization or require reverification.')
  if(d.followUpKind==='NONE'){
   if(!d.noFollowUpConfirmed||d.followUpOn)throw fail('Explicitly confirm that this document requires no follow-up, or schedule one.')
  }else{
   if(!d.followUpOn||!d.ruleSource||d.ruleEvidence.length<12)throw fail('Record the follow-up date and verified rule basis.')
   const through=d.validUntil||entry.expiresOn
   if(d.followUpOn<today||(through&&d.followUpOn>through))throw fail('Schedule follow-up no later than document validity ends; resolve already-expired evidence before certification.')
   if(d.followUpKind==='REVERIFICATION'&&['CITIZEN','NONCITIZEN_NATIONAL'].includes(context.attestationKind))throw fail('Do not reverify a U.S. citizen or noncitizen national’s work authorization. Use the appropriate document follow-up if needed.')
  }
 }
 if(context.attestationKind==='AUTHORIZED_WORKER'&&context.authorizationExpiresOn&&context.authorizationExpiresOn!=='N/A'){
  const through=exam.documents.filter(d=>d.rowKey!=='B'&&d.acceptance==='EXTENSION').map(d=>d.validUntil).filter(Boolean).sort().at(-1)||date(context.authorizationExpiresOn,'employee authorization expiration')
  // A replacement receipt can be the next required action. It must occur by
  // authorization expiry; receipt completion then records current authorization
  // and schedules the ensuing reverification. A receipt never extends it.
  const timelyAction=exam.documents.some(d=>d.rowKey!=='B'&&d.followUpOn<=through&&(d.followUpKind==='REVERIFICATION'||(d.acceptance==='RECEIPT'&&d.followUpKind==='RECEIPT_REPLACEMENT')))
  if(through<today||!timelyAction)throw fail('Resolve expired employment authorization or schedule reverification or receipt replacement by the verified authorization date.')
 }
 return {dueOn,late:today>dueOn}
}
