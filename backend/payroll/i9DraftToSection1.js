import {i9DraftInput} from './i9DraftInput.js'
import {i9Section1Input,I9_EDITION} from './i9Section1.js'
// Convert only the selected attestation branch for a complete preview. Drafts
// may retain unfinished alternative fields, but those are not submitted as part
// of a different attestation. Final validation never runs during draft saving.
export function i9DraftToSection1(draft,context){
 const d=i9DraftInput(draft)
 const personal=Object.fromEntries(['lastName','firstName','middleInitial','otherLastNames','address','apartment','city','state','postalCode','dateOfBirth','ssn','email','phone'].map(key=>[key,d[key]]))
 let attestation={kind:d.attestationKind}
 if(d.attestationKind==='PERMANENT_RESIDENT')attestation={...attestation,aNumber:d.aNumber}
 if(d.attestationKind==='AUTHORIZED_WORKER')attestation={...attestation,authorizationExpiresOn:d.authorizationExpiresOn,identifier:{kind:d.identifierKind,number:d.identifierNumber,...(d.identifierKind==='PASSPORT'?{country:d.passportCountry}:{})}}
 return i9Section1Input({edition:I9_EDITION,personal,attestation,ssnPending:d.ssnPending,preparerAssisted:d.preparerAssisted},context)
}
