const fail=message=>Object.assign(new Error(message),{status:400})
const object=(value,keys)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw fail('Review the receipt replacement examination fields.');return value}
const text=(value,label,required=true,max=2000)=>{if(value==null||value===''){if(required)throw fail(`Complete ${label}.`);return ''}if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw fail(`Review ${label}.`);return value.trim().normalize('NFC')}
const date=(value,label)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw fail(`Enter a real date for ${label}.`);return value}
const yes=(value,label)=>{if(value!==true)throw fail(`Confirm ${label}.`);return true}
const bool=(value,label)=>{if(typeof value!=='boolean')throw fail(`Answer ${label}.`);return value}
const optionalDate=(value,label)=>value==null||value===''?'':date(value,label)
const source=value=>{let url;try{url=new URL(text(value,'the official rule reference'))}catch{throw fail('Use an official HTTPS I-9 rule reference.')}if(url.protocol!=='https:'||url.username||url.password||url.search||!['uscis.gov','e-verify.gov','ice.gov','dhs.gov','justice.gov','govinfo.gov','federalregister.gov'].some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`)))throw fail('Use an official I-9 rule reference without credentials or query parameters.');return url.href}
export function i9ReceiptExaminationInput(raw){
 const b=object(raw,['examinedOn','identityEvidence','actualReplacementConfirmed','receiptMatchEvidence','documentsGenuineAndRelated','copiesComplete','copyIds','examinationMethod','physicalPresence','alternative','acceptance','acceptanceSource','acceptanceEvidence','validUntil','authorizationIndefinite','authorizationThrough','documentRequiresReverification','followUpKind','followUpOn','noFurtherFollowupConfirmed','lateReason'])
 if(!Array.isArray(b.copyIds)||!b.copyIds.length||b.copyIds.length>50)throw fail('Select the replacement copies covering every required side and page.')
 const copyIds=b.copyIds.map(id=>{if(!/^[1-9]\d{0,18}$/.test(String(id))||BigInt(id)>9223372036854775807n)throw fail('Select a retained replacement copy.');return String(BigInt(id))}).sort((a,b)=>BigInt(a)<BigInt(b)?-1:1)
 if(new Set(copyIds).size!==copyIds.length)throw fail('Select each copy only once.')
 if(!['PHYSICAL','ALTERNATIVE'].includes(b.examinationMethod)||!['STANDARD','EXTENSION','OTHER_ACCEPTABLE'].includes(b.acceptance)||!['NONE','REVERIFICATION','OTHER'].includes(b.followUpKind))throw fail('Record the actual replacement examination, acceptance and next action. Another receipt requires a separate workflow.')
 let alternative=null
 if(b.alternative!=null){
  const a=object(b.alternative,['goodStanding','allSitesEnrolled','trainingComplete','consistentProcedure','copiesReceivedBeforeVideo','sameOriginalsPresented','liveVideoOn','qualificationEvidence','videoEvidence'])
  alternative={goodStanding:yes(a.goodStanding,'current E-Verify good standing'),allSitesEnrolled:yes(a.allSitesEnrolled,'hiring site enrollment'),trainingComplete:yes(a.trainingComplete,'required training'),consistentProcedure:yes(a.consistentProcedure,'consistent nondiscriminatory use'),copiesReceivedBeforeVideo:yes(a.copiesReceivedBeforeVideo,'review of copies before video'),sameOriginalsPresented:yes(a.sameOriginalsPresented,'presentation of the same originals'),liveVideoOn:date(a.liveVideoOn,'live video'),qualificationEvidence:text(a.qualificationEvidence,'current employer qualification'),videoEvidence:text(a.videoEvidence,'live video evidence')}
 }
 return {examinedOn:date(b.examinedOn,'actual examination'),identityEvidence:text(b.identityEvidence,'examiner identity and authority'),actualReplacementConfirmed:yes(b.actualReplacementConfirmed,'this is the actual replacement document for the retained receipt'),receiptMatchEvidence:text(b.receiptMatchEvidence,'how the replacement matches the receipt'),documentsGenuineAndRelated:yes(b.documentsGenuineAndRelated,'documents reasonably appear genuine and relate to this employee'),copiesComplete:yes(b.copiesComplete,'every required document side/page is retained'),copyIds,examinationMethod:b.examinationMethod,physicalPresence:bool(b.physicalPresence,'physical presence'),alternative,acceptance:b.acceptance,acceptanceSource:source(b.acceptanceSource),acceptanceEvidence:text(b.acceptanceEvidence,'acceptance and future-review rule evidence'),validUntil:optionalDate(b.validUntil,'document validity'),authorizationIndefinite:bool(b.authorizationIndefinite,'indefinite authorization'),authorizationThrough:optionalDate(b.authorizationThrough,'authorization expiration'),documentRequiresReverification:bool(b.documentRequiresReverification,'whether this document requires reverification'),followUpKind:b.followUpKind,followUpOn:optionalDate(b.followUpOn,'next follow-up'),noFurtherFollowupConfirmed:bool(b.noFurtherFollowupConfirmed,'no further follow-up'),lateReason:text(b.lateReason,'late completion reason',false)}
}
export function validateI9ReceiptExamination(exam,answers,context){
 const today=date(context.today,'signing date'),dueOn=date(context.dueOn,'receipt deadline'),earliest=date(context.originalExaminedOn,'receipt examination date')
 if(exam.examinedOn<earliest||exam.examinedOn>today)throw fail('Record an actual examination between the original receipt examination and today.')
 if(answers.amendedOn!==today)throw fail('Prepare the amendment with today’s actual date before signing.')
 if([exam.identityEvidence,exam.receiptMatchEvidence,exam.acceptanceEvidence].some(v=>v.length<12))throw fail('Retain meaningful examiner, receipt-match and acceptance evidence.')
 if(today>dueOn&&exam.lateReason.length<12)throw fail('Explain late completion; retain today’s actual signature date.')
 if(exam.examinationMethod==='PHYSICAL'){
  if(!exam.physicalPresence||exam.alternative)throw fail('Confirm physical examination of the original replacement in the employee’s presence.')
 }else{
  const a=exam.alternative
  if(context.eVerify!==true||exam.physicalPresence||!a||a.liveVideoOn!==exam.examinedOn||a.qualificationEvidence.length<12||a.videoEvidence.length<12)throw fail('Retain current alternative-procedure qualification and matching live-video evidence.')
 }
 const expiration=answers.replacement.expiresOn,citizen=['CITIZEN','NONCITIZEN_NATIONAL'].includes(context.attestationKind)
 if(!['CITIZEN','NONCITIZEN_NATIONAL','PERMANENT_RESIDENT','AUTHORIZED_WORKER'].includes(context.attestationKind))throw fail('Review the retained employee attestation.')
 if(citizen&&(exam.documentRequiresReverification||exam.followUpKind==='REVERIFICATION'||!exam.authorizationIndefinite))throw fail('Do not impose employment-authorization reverification on a citizen or noncitizen national.')
 if(answers.rowKey==='B'&&exam.documentRequiresReverification)throw fail('List B identity documents do not require reverification.')
 if(exam.authorizationIndefinite){if(exam.authorizationThrough)throw fail('Indefinite authorization cannot have an expiration date.')}
 else if(!exam.authorizationThrough||exam.authorizationThrough<today)throw fail('Record current valid employment authorization.')
 if(exam.acceptance==='STANDARD'){
  if(expiration&&expiration<exam.examinedOn)throw fail('An expired replacement needs its applicable acceptance exception.')
  if(exam.validUntil&&exam.validUntil!==expiration)throw fail('Standard validity must match the replacement expiration.')
 }else if(!answers.explanation.includes(exam.acceptanceEvidence))throw fail('Include the acceptance-exception evidence in the reviewed amendment explanation.')
 if(exam.acceptance==='EXTENSION'&&(!exam.validUntil||exam.validUntil<today))throw fail('Record the currently valid extension period.')
 const needsReverification=exam.documentRequiresReverification||!exam.authorizationIndefinite||exam.acceptance==='EXTENSION'
 if(needsReverification&&exam.followUpKind!=='REVERIFICATION')throw fail('Schedule required authorization or document reverification.')
 if(exam.followUpKind==='NONE'){
  if(!exam.noFurtherFollowupConfirmed||exam.followUpOn)throw fail('Confirm no further follow-up and omit its date.')
 }else{
  if(exam.noFurtherFollowupConfirmed||!exam.followUpOn||exam.followUpOn<today)throw fail('Record the required current or future follow-up date.')
  const deadlines=[exam.authorizationThrough,exam.documentRequiresReverification?(exam.acceptance==='STANDARD'?expiration:exam.validUntil):'',exam.acceptance==='EXTENSION'?exam.validUntil:''].filter(Boolean)
  if(deadlines.some(end=>exam.followUpOn>end))throw fail('Schedule follow-up by the earliest applicable verified deadline.')
 }
 return {dueOn,late:today>dueOn,nextFollowUpKind:exam.followUpKind,nextFollowUpOn:exam.followUpOn||null}
}
