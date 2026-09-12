const fail=message=>Object.assign(new Error(message),{status:409})
const evidence=(value,label)=>{if(typeof value!=='string'||value.trim().length<12||value.trim().length>2000||/[\u0000-\u001f\u007f]/.test(value))throw fail(`Retain detailed ${label} evidence (12–2000 characters).`);return value.trim()}
export function mw507EmployerReview(source,body,employee){
 if(!source.reviewed||body.mw507Fingerprint!==source.fingerprint||String(body.mw507SubmissionId)!==String(source.submissionId))throw fail('Review the current signed MW507 and reload its tax-election values before saving.')
 const r=body.mw507EmployerReview||{}
 if(r.correctnessConfirmed!==true||r.noRevocationConfirmed!==true||r.localRateConfirmed!==true)throw fail('Review Maryland certificate correctness, Comptroller revocation history and the applicable local rate.')
 const correctnessEvidence=evidence(r.correctnessEvidence,'certificate correctness and revocation review'),localRateEvidence=evidence(r.localRateEvidence,'Maryland residence and local-rate')
 const c=source.choices
 if(c.claim.kind!=='NONE'||employee.work_state!=='MD'||employee.residence_state!=='MD')throw fail('This signed exemption or nonresident certificate requires the applicable state/local calculation and compliance workflow before automatic election application.')
 const submissionEvidence=source.requirements.comptrollerSubmissionReasons.length?evidence(r.comptrollerSubmissionEvidence,'Comptroller certificate submission'):null
 const expected={filingStatus:c.filingStatus,exemptions:c.exemptions,extraWithholdingCents:c.extraWithholdingCents,exempt:false,localRate:3.2}
 const m=body.maryland||{}
 if(Object.keys(expected).some(key=>m[key]!==expected[key]))throw fail('Maryland values must match the signed MW507 and verified local table. Ask the employee to sign an amendment to change certificate values.')
 return {submissionId:source.submissionId,documentId:source.documentId,fingerprint:source.fingerprint,receivedOn:source.receivedOn,onboardingCycle:source.onboardingCycle,review:{correctnessConfirmed:true,noRevocationConfirmed:true,localRateConfirmed:true,correctnessEvidence,localRateEvidence,comptrollerSubmissionEvidence:submissionEvidence,additionalAgreementRequired:source.requirements.additionalAgreementRequired}}
}
