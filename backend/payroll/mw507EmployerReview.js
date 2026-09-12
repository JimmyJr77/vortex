const fail=message=>Object.assign(new Error(message),{status:409})
const evidence=(value,label)=>{if(typeof value!=='string'||value.trim().length<12||value.trim().length>2000||/[\u0000-\u001f\u007f]/.test(value))throw fail(`Retain detailed ${label} evidence (12–2000 characters).`);return value.trim()}
export function mw507EmployerReview(source,body,employee){
 if(!source.reviewed||body.mw507Fingerprint!==source.fingerprint||String(body.mw507SubmissionId)!==String(source.submissionId))throw fail('Review the current signed MW507 and reload its tax-election values before saving.')
 const r=body.mw507EmployerReview||{}
 if(r.correctnessConfirmed!==true||r.noRevocationConfirmed!==true||r.localRateConfirmed!==true)throw fail('Review Maryland certificate correctness, Comptroller revocation history and the applicable local rate.')
 const correctnessEvidence=evidence(r.correctnessEvidence,'certificate correctness and revocation review'),localRateEvidence=evidence(r.localRateEvidence,'Maryland residence and local-rate')
 const c=source.choices
 if(!['NONE','NO_LIABILITY'].includes(c.claim.kind)||employee.work_state!=='MD'||employee.residence_state!=='MD')throw fail('This signed exemption or nonresident certificate requires the applicable state/local calculation and compliance workflow before automatic election application.')
 const noLiability=c.claim.kind==='NO_LIABILITY'
 if(noLiability&&(!Number.isSafeInteger(r.expectedWeeklyWagesCents)||r.expectedWeeklyWagesCents<0))throw fail('Record the reviewed expected weekly wages in whole cents for the no-liability certificate.')
 if(noLiability&&c.extraWithholdingCents>0)throw fail('Resolve the additional-withholding instruction on this exempt certificate before applying it.')
 const weeklyWageEvidence=noLiability?evidence(r.weeklyWageEvidence,'expected weekly-wage review'):null
 const submissionEvidence=(source.requirements.comptrollerSubmissionReasons.length||(noLiability&&r.expectedWeeklyWagesCents>20000))?evidence(r.comptrollerSubmissionEvidence,'Comptroller certificate submission'):null
 const expected={filingStatus:c.filingStatus,exemptions:c.exemptions,extraWithholdingCents:c.extraWithholdingCents,exempt:noLiability,localRate:3.2}
 const m=body.maryland||{}
 if(Object.keys(expected).some(key=>m[key]!==expected[key]))throw fail('Maryland values must match the signed MW507 and verified local table. Ask the employee to sign an amendment to change certificate values.')
 return {submissionId:source.submissionId,documentId:source.documentId,fingerprint:source.fingerprint,receivedOn:source.receivedOn,onboardingCycle:source.onboardingCycle,claimKind:c.claim.kind,renewBy:source.requirements.renewBy||null,review:{correctnessConfirmed:true,noRevocationConfirmed:true,localRateConfirmed:true,correctnessEvidence,localRateEvidence,comptrollerSubmissionEvidence:submissionEvidence,...(noLiability?{expectedWeeklyWagesCents:r.expectedWeeklyWagesCents,weeklyWageEvidence}:{}),additionalAgreementRequired:source.requirements.additionalAgreementRequired}}
}
