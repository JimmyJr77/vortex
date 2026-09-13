import {randomUUID} from 'node:crypto'
import {signedI9Fixture} from './signedI9Fixture.js'
import {PDFDocument} from 'pdf-lib'
export async function syntheticI9CopyPdf(){const pdf=await PDFDocument.create();pdf.addPage().drawText('SYNTHETIC ID FRONT');pdf.addPage().drawText('SYNTHETIC ID BACK');return Buffer.from(await pdf.save())}
export async function employerI9ReviewFixture(h){
 const {api,employee,task:employeeTask,signed}=await signedI9Fixture(h,{assisted:false})
 await api(`/employees/${employee.id}/onboarding/${employeeTask.id}/review`,{onboardingCycle:1,status:'COMPLETE',note:'Reviewed current employee-signed Section 1; no preparer assistance reported.'})
 const task=(await api(`/employees/${employee.id}/onboarding`)).tasks.find(t=>t.task_key==='I9_REVIEW'),base=`/employees/${employee.id}/onboarding/${task.id}/i9`
 const initial=await api(base+'/employer-draft?onboardingCycle=1'),draft={documentChoice:'LIST_A',listA:[{title:'U.S. Passport',issuingAuthority:'U.S. Department of State',number:'SYNTHETIC-DOCUMENT',expiresOn:'2030-01-01'}],examinationMethod:'PHYSICAL',firstDayEmployed:'2026-09-01',representativeNameAndTitle:'Reviewer Alice, Hiring Admin',businessName:'Synthetic Employer',businessAddress:'20 Example Road, Bowie, MD 20715'}
 const saved=await api(base+'/employer-draft',{onboardingCycle:1,expectedRevision:initial.revision,basisHash:initial.basisHash,requestKey:randomUUID(),draft})
 const review=await api(base+'/employer-preview',{onboardingCycle:1,expectedRevision:saved.revision,basisHash:saved.basisHash})
 return {api,employee,employeeTask,signed,task,base,draft,saved,review,reviewBody:{onboardingCycle:1,reviewId:review.reviewId,previewSha256:review.previewSha256}}
}
