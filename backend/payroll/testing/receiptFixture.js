import {randomUUID} from 'node:crypto'
import {employerI9ReviewFixture,syntheticI9CopyPdf} from './employerI9ReviewFixture.js'
import {I9_EMPLOYER_ATTESTATION} from '../i9Examination.js'
export async function receiptFixture(h,{authorizedWorker=false,eVerify=false,multipleReceipts=false}={}){
 const rows=multipleReceipts?['B','C']:['A1']
 const document=row=>({title:`Synthetic List ${row} replacement receipt`,issuingAuthority:'Synthetic issuer',number:`receipt ${row}`,expiresOn:row==='C'?'2026-11-15':'2026-11-30'})
 const {api,employee,task,base,reviewBody}=await employerI9ReviewFixture(h,{authorizedWorker,eVerify,draftOverrides:{...(multipleReceipts?{documentChoice:'LIST_B_C',listA:undefined,listB:document('B'),listC:document('C')}:{listA:[{title:authorizedWorker?'Employment Authorization Document receipt':'U.S. Passport receipt',issuingAuthority:authorizedWorker?'USCIS':'U.S. Department of State',number:'receipt SYNTHETIC',expiresOn:'2026-11-30'}]}),additionalInformation:'RA 09/01/2026: Synthetic lost document replacement receipt.'}})
 const documents=[]
 for(const rowKey of rows){
  const copy=await api(base+'/employer-copies',{...reviewBody,rowKey,requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:(await syntheticI9CopyPdf()).toString('base64')})
  for(let page=1;page<=2;page++)await api(base+'/employer-copy-page',{...reviewBody,copyId:copy.id,page,displayed:true})
  documents.push({rowKey,copyIds:[copy.id],copiesComplete:true,accepted:true,acceptance:'RECEIPT',validUntil:document(rowKey).expiresOn,formNotation:'RA 09/01/2026: Synthetic lost document replacement receipt.',followUpKind:'RECEIPT_REPLACEMENT',followUpOn:document(rowKey).expiresOn,ruleSource:'https://www.uscis.gov/i-9-central',ruleEvidence:'Synthetic lost-document receipt retained for replacement by its recorded deadline.'})
 }
 for(let page=1;page<=4;page++)await api(base+'/employer-page',{...reviewBody,documentKey:'main',page,displayed:true})
 const signed=await api(base+'/employer-sign',{...reviewBody,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:I9_EMPLOYER_ATTESTATION,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination:{examinedOn:'2026-09-01',examinerInitials:'RA',identityEvidence:'Authenticated hiring admin performed the synthetic examination.',businessDays:[1,2,3,4,5],closedDates:[],calendarConfirmed:true,shortEmployment:false,lateReason:'Historical synthetic fixture certified at the actual current date.',employeeChoseDocuments:true,section1Reviewed:true,documentsGenuineAndRelated:true,physicalPresence:true,documents}})

 return {api,employee,task,signed,pdf:await syntheticI9CopyPdf()}
}
