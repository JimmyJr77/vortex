const fail=message=>Object.assign(new Error(message),{status:400})
const object=(value,keys)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw fail('Review the Supplement B examination fields.');return value}
const text=(value,label,required=true,max=2000)=>{if(value==null||value===''){if(required)throw fail(`Complete ${label}.`);return ''}if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw fail(`Review ${label}.`);return value.trim().normalize('NFC')}
const date=(value,label)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw fail(`Enter a real date for ${label}.`);return value}
const yes=(value,label)=>{if(value!==true)throw fail(`Confirm ${label}.`);return true}
const bool=(value,label)=>{if(typeof value!=='boolean')throw fail(`Answer ${label}.`);return value}
const optionalDate=(value,label)=>value==null||value===''?'':date(value,label)
const source=value=>{let url;try{url=new URL(text(value,'the official rule reference'))}catch{throw fail('Use an official HTTPS I-9 rule reference.')}if(url.protocol!=='https:'||url.username||url.password||url.search||!['uscis.gov','e-verify.gov','ice.gov','dhs.gov','justice.gov','govinfo.gov','federalregister.gov'].some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`)))throw fail('Use an official I-9 rule reference without credentials or query parameters.');return url.href}
export function i9SupplementBExaminationInput(raw){
 const b=object(raw,['examinedOn','examinerInitials','identityEvidence','reverificationRequired','requirementSource','requirementEvidence','employeeChoseDocuments','currentAuthorizationReviewed','documentsGenuineAndRelated','copiesComplete','copyIds','physicalPresence','alternative','acceptance','acceptanceSource','acceptanceEvidence','validUntil','formNotation','authorizationIndefinite','authorizationThrough','followUpKind','followUpOn','noFurtherReverificationRequired','lateReason','nameChangeEvidence'])
 if(!Array.isArray(b.copyIds)||!b.copyIds.length||b.copyIds.length>50)throw fail('Select the replacement document copies covering every required side and page.')
 const copyIds=b.copyIds.map(id=>{if(!/^[1-9]\d{0,18}$/.test(String(id))||BigInt(id)>9223372036854775807n)throw fail('Select a retained replacement copy.');return String(BigInt(id))}).sort((a,b)=>BigInt(a)<BigInt(b)?-1:1)
 if(new Set(copyIds).size!==copyIds.length)throw fail('Select each replacement copy only once.')
 if(!['STANDARD','RECEIPT','EXTENSION','OTHER_ACCEPTABLE'].includes(b.acceptance)||!['NONE','REVERIFICATION','RECEIPT_REPLACEMENT','OTHER'].includes(b.followUpKind))throw fail('Select the document acceptance and next follow-up decisions.')
 let alternative=null
 if(b.alternative!=null){
  const a=object(b.alternative,['goodStanding','allSitesEnrolled','trainingComplete','consistentProcedure','copiesReceivedBeforeVideo','sameOriginalsPresented','liveVideoOn','qualificationEvidence','videoEvidence'])
  alternative={goodStanding:yes(a.goodStanding,'current E-Verify good standing'),allSitesEnrolled:yes(a.allSitesEnrolled,'enrollment of every hiring site using the alternative procedure'),trainingComplete:yes(a.trainingComplete,'required training'),consistentProcedure:yes(a.consistentProcedure,'consistent, nondiscriminatory use of the procedure'),copiesReceivedBeforeVideo:yes(a.copiesReceivedBeforeVideo,'review of copies before live video'),sameOriginalsPresented:yes(a.sameOriginalsPresented,'presentation of the same original documents during live video'),liveVideoOn:date(a.liveVideoOn,'live video examination'),qualificationEvidence:text(a.qualificationEvidence,'current employer/site qualification evidence'),videoEvidence:text(a.videoEvidence,'live-video examination evidence')}
 }
 return {examinedOn:date(b.examinedOn,'actual examination'),examinerInitials:text(b.examinerInitials,'examiner initials',true,20),identityEvidence:text(b.identityEvidence,'examiner identity and authority'),reverificationRequired:yes(b.reverificationRequired,'this employee currently requires reverification and is not exempt'),requirementSource:source(b.requirementSource),requirementEvidence:text(b.requirementEvidence,'the employee-specific reverification basis'),employeeChoseDocuments:yes(b.employeeChoseDocuments,'the employee chose their acceptable List A or C documentation'),currentAuthorizationReviewed:yes(b.currentAuthorizationReviewed,'current authorization and any applicable automatic extensions'),documentsGenuineAndRelated:yes(b.documentsGenuineAndRelated,'the original documents reasonably appear genuine and relate to this employee'),copiesComplete:yes(b.copiesComplete,'the retained copies include every required side/page'),copyIds,physicalPresence:bool(b.physicalPresence,'whether you physically examined the originals in the employee’s presence'),alternative,acceptance:b.acceptance,acceptanceSource:source(b.acceptanceSource),acceptanceEvidence:text(b.acceptanceEvidence,'the acceptance and future-review rule basis'),validUntil:optionalDate(b.validUntil,'document validity'),formNotation:text(b.formNotation,'the initialed, dated form notation',false,1000),authorizationIndefinite:bool(b.authorizationIndefinite,'whether current employment authorization has no expiration'),authorizationThrough:optionalDate(b.authorizationThrough,'current employment authorization expiration'),followUpKind:b.followUpKind,followUpOn:optionalDate(b.followUpOn,'next follow-up'),noFurtherReverificationRequired:bool(b.noFurtherReverificationRequired,'whether no further reverification or document follow-up is required'),lateReason:text(b.lateReason,'late-completion explanation',false),nameChangeEvidence:text(b.nameChangeEvidence,'reported name-change evidence',false)}
}
// This uses the current authorization finding, not the superseded Section 1
// expiration. It does not decide authenticity or legal eligibility for an admin.
export function validateI9SupplementBExamination(exam,answers,context){
 const today=date(context.today,'actual signing date'),dueOn=date(context.dueOn,'this follow-up deadline'),earliest=date(context.originalExaminedOn,'original examination date')
 if(['CITIZEN','NONCITIZEN_NATIONAL'].includes(context.attestationKind))throw fail('Do not reverify a U.S. citizen or noncitizen national.')
 if(!['PERMANENT_RESIDENT','AUTHORIZED_WORKER'].includes(context.attestationKind))throw fail('Review the employee’s retained Section 1 attestation.')
 if(!['A','C'].includes(answers.document.list))throw fail('List B documentation cannot establish continued work authorization.')
 if(exam.examinedOn<earliest||exam.examinedOn>today)throw fail('Use an actual examination date no earlier than the source examination and no later than today.')
 if([exam.identityEvidence,exam.requirementEvidence,exam.acceptanceEvidence].some(v=>v.length<12))throw fail('Retain meaningful examiner, reverification and document-acceptance evidence.')
 if(today>dueOn&&exam.lateReason.length<12)throw fail('Explain late completion. The signature must retain today’s actual date.')
 if(answers.examinationMethod==='PHYSICAL'){
  if(!exam.physicalPresence||exam.alternative)throw fail('Confirm examination of the original documents in the employee’s physical presence.')
 }else if(answers.examinationMethod==='ALTERNATIVE'){
  const a=exam.alternative
  if(context.eVerify!==true||exam.physicalPresence||!a||a.liveVideoOn!==exam.examinedOn||a.qualificationEvidence.length<12||a.videoEvidence.length<12)throw fail('Retain the current alternative-procedure qualifications and live-video evidence.')
 }else throw fail('Use the examination method on the reviewed supplement.')
 const expiration=answers.document.expiresOn
 if(exam.acceptance==='STANDARD'){
  if(expiration&&expiration<exam.examinedOn)throw fail('An expired document needs its applicable acceptance exception and evidence.')
  if(exam.validUntil&&exam.validUntil!==expiration)throw fail('Standard validity must match the document expiration on the supplement.')
 }else if(!exam.formNotation||!answers.additionalInformation.includes(exam.formNotation))throw fail('Retain the exception notation on the reviewed supplement.')
 if(answers.additionalInformation){
  const stamp=`${exam.examinedOn.slice(5,7)}/${exam.examinedOn.slice(8,10)}/${exam.examinedOn.slice(0,4)}`
  if(!answers.additionalInformation.includes(exam.examinerInitials)||!answers.additionalInformation.includes(stamp))throw fail('Initial and date the notation on the reviewed supplement.')
 }
 if(exam.authorizationIndefinite){if(exam.authorizationThrough)throw fail('Indefinite authorization cannot also have an expiration date.')}
 else if(!exam.authorizationThrough||exam.authorizationThrough<today)throw fail('Resolve expired authorization before certification; record its current verified expiration.')
 if(['RECEIPT','EXTENSION'].includes(exam.acceptance)&&(!exam.validUntil||exam.validUntil<today))throw fail('Record the currently valid receipt or extension period.')
 if(exam.followUpKind==='NONE'){
  if(!exam.authorizationIndefinite||!exam.noFurtherReverificationRequired||exam.followUpOn||['RECEIPT','EXTENSION'].includes(exam.acceptance))throw fail('No-follow-up requires documented indefinite authorization and no outstanding receipt or extension review.')
 }else{
  if(exam.noFurtherReverificationRequired||!exam.followUpOn||exam.followUpOn<today)throw fail('Record a current or future date for the required follow-up.')
  const deadlines=[exam.authorizationThrough,exam.acceptance==='STANDARD'?expiration:exam.validUntil].filter(Boolean)
  if(deadlines.some(end=>exam.followUpOn>end))throw fail('The next follow-up must occur by the earliest verified authorization or document-validity deadline.')
 }
 if(exam.acceptance==='RECEIPT'&&exam.followUpKind!=='RECEIPT_REPLACEMENT')throw fail('Schedule the required replacement of the accepted receipt.')
 if(exam.acceptance==='EXTENSION'&&exam.followUpKind!=='REVERIFICATION')throw fail('Schedule reverification by the verified extension deadline.')
 if(Object.values(answers.newName||{}).some(Boolean)&&exam.nameChangeEvidence.length<12)throw fail('Retain the basis for the reported name change.')
 return {dueOn,late:today>dueOn,nextFollowUpKind:exam.followUpKind,nextFollowUpOn:exam.followUpOn||null}
}
