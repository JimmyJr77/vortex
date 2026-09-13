import {randomUUID} from 'node:crypto'
import {employerI9ReviewFixture,syntheticI9CopyPdf} from './employerI9ReviewFixture.js'
import {I9_EMPLOYER_ATTESTATION} from '../i9Examination.js'
export async function receiptFixture(h){
 const {api,employee,task,base,reviewBody}=await employerI9ReviewFixture(h,{draftOverrides:{listA:[{title:'U.S. Passport receipt',issuingAuthority:'U.S. Department of State',number:'receipt SYNTHETIC',expiresOn:'2026-11-30'}],additionalInformation:'RA 09/01/2026: Synthetic lost passport replacement receipt.'}})
 const copy=await api(base+'/employer-copies',{...reviewBody,rowKey:'A1',requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:(await syntheticI9CopyPdf()).toString('base64')})
 for(let page=1;page<=4;page++)await api(base+'/employer-page',{...reviewBody,documentKey:'main',page,displayed:true})
 for(let page=1;page<=2;page++)await api(base+'/employer-copy-page',{...reviewBody,copyId:copy.id,page,displayed:true})
 const signed=await api(base+'/employer-sign',{...reviewBody,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:I9_EMPLOYER_ATTESTATION,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination:{examinedOn:'2026-09-01',examinerInitials:'RA',identityEvidence:'Authenticated hiring admin performed the synthetic examination.',businessDays:[1,2,3,4,5],closedDates:[],calendarConfirmed:true,shortEmployment:false,lateReason:'Historical synthetic fixture certified at the actual current date.',employeeChoseDocuments:true,section1Reviewed:true,documentsGenuineAndRelated:true,physicalPresence:true,documents:[{rowKey:'A1',copyIds:[copy.id],copiesComplete:true,accepted:true,acceptance:'RECEIPT',validUntil:'2026-11-30',formNotation:'RA 09/01/2026: Synthetic lost passport replacement receipt.',followUpKind:'RECEIPT_REPLACEMENT',followUpOn:'2026-11-30',ruleSource:'https://www.uscis.gov/i-9-central',ruleEvidence:'Synthetic lost-passport receipt retained for replacement by November 30, 2026.'}]}})

 return {api,employee,task,signed,pdf:await syntheticI9CopyPdf()}
}
