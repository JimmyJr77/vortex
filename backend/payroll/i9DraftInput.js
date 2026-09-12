// Drafts intentionally accept incomplete entries. They cannot carry a signature,
// employer decision or an assertion that Section 1 is complete.
const fail=message=>Object.assign(new Error(message),{status:400})
const fields=['lastName','firstName','middleInitial','otherLastNames','address','apartment','city','state','postalCode','dateOfBirth','ssn','email','phone','aNumber','authorizationExpiresOn','identifierNumber','passportCountry']
const choices={attestationKind:['','CITIZEN','NONCITIZEN_NATIONAL','PERMANENT_RESIDENT','AUTHORIZED_WORKER'],identifierKind:['','A_NUMBER','I94','PASSPORT']}
const flags=['ssnPending','preparerAssisted']
export function i9DraftInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw fail('Use valid I-9 draft entries.')
 if(Object.keys(input).some(key=>![...fields,...Object.keys(choices),...flags].includes(key)))throw fail('An I-9 draft cannot contain signatures, employer decisions or unknown fields.')
 const result={}
 for(const key of [...fields,...Object.keys(choices)]){
  const value=input[key]??''
  if(typeof value!=='string'||value.length>200||/[\u0000-\u001f\u007f]/.test(value))throw fail('Use plain text without control characters in the I-9 draft.')
  result[key]=value.normalize('NFC')
 }
 if(!/^[\d-]{0,11}$/.test(result.ssn)||!/^[\d-]{0,10}$/.test(result.dateOfBirth))throw fail('Use a partial SSN or date in its expected format.')
 for(const [key,allowed] of Object.entries(choices))if(!allowed.includes(result[key]))throw fail('Use a supported I-9 draft choice.')
 for(const key of flags){const value=input[key]??null;if(value!==null&&typeof value!=='boolean')throw fail('Use yes, no or unanswered for the I-9 draft questions.');result[key]=value}
 return result
}
