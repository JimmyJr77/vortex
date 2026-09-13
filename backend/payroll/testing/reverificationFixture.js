import {randomUUID} from 'node:crypto'
import {employerI9ReviewFixture,syntheticI9CopyPdf} from './employerI9ReviewFixture.js'
import {I9_EMPLOYER_ATTESTATION} from '../i9Examination.js'
export async function reverificationFixture(h,{eVerify=false}={}){
 const fixture=await employerI9ReviewFixture(h,{authorizedWorker:true,eVerify}),{api,base,reviewBody}=fixture,pdf=await syntheticI9CopyPdf()
 const copy=await api(base+'/employer-copies',{...reviewBody,rowKey:'A1',requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:pdf.toString('base64')})
 for(let page=1;page<=4;page++)await api(base+'/employer-page',{...reviewBody,documentKey:'main',page,displayed:true})
 for(let page=1;page<=2;page++)await api(base+'/employer-copy-page',{...reviewBody,copyId:copy.id,page,displayed:true})
 const signed=await api(base+'/employer-sign',{...reviewBody,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:I9_EMPLOYER_ATTESTATION,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination:{examinedOn:'2026-09-01',examinerInitials:'RA',identityEvidence:'Authenticated examiner performed the synthetic source examination.',businessDays:[1,2,3,4,5],closedDates:[],calendarConfirmed:true,shortEmployment:false,lateReason:'Historical synthetic fixture certified at the actual current date.',employeeChoseDocuments:true,section1Reviewed:true,documentsGenuineAndRelated:true,physicalPresence:true,documents:[{rowKey:'A1',copyIds:[copy.id],copiesComplete:true,accepted:true,acceptance:'STANDARD',followUpKind:'REVERIFICATION',followUpOn:'2030-01-01',ruleSource:'https://www.uscis.gov/i-9-central',ruleEvidence:'Synthetic authorization remains valid through January 2030.'}]}})
 return {...fixture,signed,pdf}
}
