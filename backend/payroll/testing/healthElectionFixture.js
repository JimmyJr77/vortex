import {randomUUID} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {healthQualificationFixture} from './healthQualificationFixture.js'
export async function healthElectionFixture(h,options={}){
 const planId=options.planId||'medical'
 const f=await healthQualificationFixture(h,options),{api,employee}=f
 const disclosurePath=`/health-plan-qualification/${planId}/disclosures`,dstate=await api(`${disclosurePath}?paymentDate=2026-09-18`)
 const pdf=await PDFDocument.create(),page=pdf.addPage();page.drawText('Synthetic employee-safe plan disclosure',{x:40,y:740,size:20});page.drawText('No confidential administrator findings.',{x:40,y:710,size:18})
 const disclosureBytes=Buffer.from(await pdf.save())
 const disclosureBody={paymentDate:'2026-09-18',sourceFingerprint:dstate.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),planYearStartsOn:'2026-09-01',planYearEndsOn:'2027-08-31',employeeTerms:'Eligible employees may elect the displayed qualified accident and health premiums through salary reduction under this written plan.',electionChangesTerms:'Elections are binding for the stated plan period. Midyear changes require a permitted event and administrator review under the written plan.',employeeDisclosureConfirmed:true,document:{filename:'employee-disclosure.pdf',contentBase64:disclosureBytes.toString('base64')}}
 await api(disclosurePath,disclosureBody)
 const participantPath=`/employees/${employee.id}/health-qualification/${planId}`,pstate=await api(`${participantPath}?paymentDate=2026-09-18`)
 const participantBody={requestKey:randomUUID(),sourceFingerprint:pstate.source.fingerprint,expectedRevision:0,effectiveOn:'2026-09-18',effectiveThrough:'2026-12-31',disposition:'ELIGIBLE',electionBasis:'INITIAL_ENROLLMENT',electionDeadline:'2026-09-18',employeeElectionExplanation:'Initial enrollment under the written plan. Sign before the September 18 salary-reduction date.',commonLawEmployeeConfirmed:true,ownershipEligibleConfirmed:true,coverageEligibleConfirmed:true,electionRulesConfirmed:true,nondiscriminationConfirmed:true,confirmed:true,reference:'CONFIDENTIAL-ADMIN-REFERENCE synthetic participant ownership and covered-person findings'}
 await api(participantPath,participantBody)
 const path=`/health-plans/${planId}/election`,state=()=>api(path,undefined,'GET',200,true)
 const current=await state(),proposal=current.offers[0]
 return {...f,disclosurePath,disclosureBody,disclosureBytes,participantPath,participantBody,path,state,proposal,electionBody:{requestKey:randomUUID(),expectedRevision:0,proposalFingerprint:proposal?.fingerprint,action:'ELECT',signature:'Monthly Benefits',confirmed:true,disclosureConfirmed:true,electionRulesConfirmed:true}}
}
