import {randomUUID} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {monthlyBenefitsFixture} from './monthlyBenefitsFixture.js'
export async function healthQualificationFixture(h,{retainPlan=true,benefitsOptions={},existingFixture,planId='medical'}={}){
 const f=existingFixture||await monthlyBenefitsFixture(h,{...benefitsOptions,taxTreatment:'PRETAX'}),path=`/health-plan-qualification/${planId}`,state=await f.api(path)
 const pdf=await PDFDocument.create();pdf.addPage().drawText('Synthetic written Section 125 plan and qualification evidence')
 const bytes=Buffer.from(await pdf.save()),body={requestKey:randomUUID(),expectedRevision:0,sourceFingerprint:state.source.fingerprint,disposition:'QUALIFIED',effectiveOn:'2026-09-01',effectiveThrough:'2027-08-31',classification:'SECTION125_ACCIDENT_HEALTH_PREMIUM',writtenPlanConfirmed:true,eligibleBenefitsConfirmed:true,nondiscriminationConfirmed:true,confirmed:true,reference:'Synthetic reviewed written plan, eligibility/election terms and nondiscrimination results',document:{filename:'private-employer-original-name.pdf',contentBase64:bytes.toString('base64')}}
 if(retainPlan)await f.api(path,body)
 return {...f,h,path,body,bytes}
}
