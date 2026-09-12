// Structural validation for employee-entered Section 1; this does not establish
// employment eligibility, document authenticity, or an electronic signature.
export const I9_EDITION='01/20/25'
const fail=message=>Object.assign(new Error(message),{status:400})
const object=(value,keys,label)=>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw fail(`Use only the supported ${label} fields.`)
 return value
}
const text=(value,label,required=false,max=200)=>{
 if(value==null||value===''){if(required)throw fail(`Complete ${label}.`);return null}
 if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u001f\u007f]/.test(value))throw fail(`Review ${label}.`)
 return value.trim().normalize('NFC')
}
const date=(value,label)=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw fail(`Use a valid date for ${label}.`)
 return value
}
const aNumber=value=>{const result=text(value,'USCIS/A-Number',true,10).replace(/^A-?/i,'');if(!/^\d{7,9}$/.test(result))throw fail('Enter a seven- to nine-digit USCIS/A-Number.');return result}
export function i9Section1Input(body,context){
 if(typeof context?.eVerify!=='boolean'||context?.offerAccepted!==true)throw fail('Confirm accepted employment offer and employer E-Verify configuration before preparing Section 1.')
 const today=date(context.today,'current employer date')
 const b=object(body,['edition','personal','attestation','ssnPending','preparerAssisted'],'Section 1')
 if(b.edition!==I9_EDITION)throw fail('Use the retained I-9 edition 01/20/25.')
 const p=object(b.personal,['lastName','firstName','middleInitial','otherLastNames','address','apartment','city','state','postalCode','dateOfBirth','ssn','email','phone'],'employee information')
 const personal=Object.fromEntries(['lastName','firstName','address','city','state','postalCode'].map(key=>[key,text(p[key],key,true)]))
 for(const key of ['middleInitial','otherLastNames','apartment','email','phone'])personal[key]=text(p[key],key)
 personal.dateOfBirth=date(p.dateOfBirth,'date of birth')
 if(personal.dateOfBirth>today)throw fail('Date of birth cannot be in the future.')
 personal.ssn=text(p.ssn,'Social Security number',false,11)?.replaceAll('-','')||null
 if(personal.ssn&&(!/^\d{9}$/.test(personal.ssn)||/^(000|666|9\d\d)/.test(personal.ssn)||personal.ssn.slice(3,5)==='00'||personal.ssn.slice(5)==='0000'))throw fail('Enter a valid-format Social Security number, not an ITIN.')
 if(typeof b.ssnPending!=='boolean'||typeof b.preparerAssisted!=='boolean')throw fail('Answer the pending-SSN and preparer/translator questions explicitly.')
 if(b.ssnPending&&personal.ssn)throw fail('A supplied Social Security number cannot also be pending.')
 if(context.eVerify&&!personal.ssn&&!b.ssnPending)throw fail('Provide the SSN or indicate that it has been applied for and is pending for this E-Verify employer.')
 const raw=b.attestation||{};let attestation
 if(['CITIZEN','NONCITIZEN_NATIONAL'].includes(raw.kind)){object(raw,['kind'],'citizenship attestation');attestation={kind:raw.kind}}
 else if(raw.kind==='PERMANENT_RESIDENT'){object(raw,['kind','aNumber'],'permanent-resident attestation');attestation={kind:raw.kind,aNumber:aNumber(raw.aNumber)}}
 else if(raw.kind==='AUTHORIZED_WORKER'){
  object(raw,['kind','authorizationExpiresOn','identifier'],'authorized-worker attestation')
  const expiration=raw.authorizationExpiresOn==='N/A'?'N/A':date(raw.authorizationExpiresOn,'employment authorization expiration')
  const id=raw.identifier||{};let identifier
  if(id.kind==='A_NUMBER'){object(id,['kind','number'],'A-Number identifier');identifier={kind:id.kind,number:aNumber(id.number)}}
  else if(id.kind==='I94'){object(id,['kind','number'],'I-94 identifier');identifier={kind:id.kind,number:text(id.number,'I-94 admission number',true,30)}}
  else if(id.kind==='PASSPORT'){object(id,['kind','number','country'],'passport identifier');identifier={kind:id.kind,number:text(id.number,'foreign passport number',true,40),country:text(id.country,'passport country of issuance',true,100)}}
  else throw fail('Select one authorized-worker identifier alternative.')
  attestation={kind:raw.kind,authorizationExpiresOn:expiration,identifier}
 }else throw fail('Select one of the four Section 1 attestations.')
 return {edition:I9_EDITION,personal,attestation,ssnPending:b.ssnPending,preparerAssisted:b.preparerAssisted}
}
