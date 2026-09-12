import {createHash} from 'node:crypto'
const fail=message=>Object.assign(new Error(message),{status:409})
export function ptoStateReviewInput(b){
 if(!b||b.confirmed!==true||typeof b.basisFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(b.basisFingerprint)||!Number.isSafeInteger(b.stateIncomeTaxCents)||b.stateIncomeTaxCents<0||typeof b.sourceReference!=='string'||b.sourceReference.trim().length<20||b.sourceReference.length>2000||/[\u0000-\u001f\u007f]/.test(b.sourceReference))throw fail('Confirm the exact PTO withholding basis, state tax amount and professional calculation reference.')
 return {version:1,basisFingerprint:b.basisFingerprint,stateIncomeTaxCents:b.stateIncomeTaxCents,sourceReference:b.sourceReference.trim(),confirmed:true}
}
export function ptoStateReviewBasis(source){
 if(source.year!==2026||source.workState!=='MD'||source.residenceState!=='MD'||!Number.isSafeInteger(source.federalIncomeTaxCents)||source.federalIncomeTaxCents<0)throw fail('Complete supported federal withholding and Maryland-resident wage treatment before reviewing state PTO withholding.')
 const basis={version:1,...source}
 return {...basis,fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex')}
}
export function applyPtoStateReview(review,basis){
 const r=ptoStateReviewInput(review)
 if(r.basisFingerprint!==basis.fingerprint)throw fail('PTO wages, contributions or withholding sources changed. Review the current state withholding basis again.')
 return r
}
