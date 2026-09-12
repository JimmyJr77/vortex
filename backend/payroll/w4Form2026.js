// The official blank form is retained locally and verified before rendering.
// This validates submitted form data; it does not sign, store or activate it.
export const W4_2026={year:2026,source:'https://www.irs.gov/pub/irs-pdf/fw4.pdf',requirements:'https://www.irs.gov/publications/p15t',templateSha256:'92444d8856ce55d9e25dca8b6d1420634fc68b11e1ab1f760916ea29ddd312b2',perjury:'Under penalties of perjury, I declare that this certificate, to the best of my knowledge and belief, is true, correct, and complete.'}
const fail=message=>Object.assign(new Error(message),{status:400})
const text=(value,name,max)=>{if(typeof value!=='string')throw fail(`Complete ${name}.`);const result=value.trim().normalize('NFC');if(!result||result.length>max||/[\u0000-\u001f\u007f]/.test(result))throw fail(`Use valid ${name} without control characters.`);return result}
const amount=(value,name)=>{if(value===null||value===undefined||value==='')return null;if(!Number.isSafeInteger(value)||value<0)throw fail(`Use a nonnegative whole-cent amount for ${name}.`);return value}
export function w4FormInput2026(body){
 if(!body||body.year!==2026)throw fail('Use the reviewed 2026 Form W-4.')
 const personal=body.personal||{},ssn=typeof personal.ssn==='string'?personal.ssn.trim().replaceAll('-',''):''
 if(!/^\d{9}$/.test(ssn)||/^(000|666|9\d\d)/.test(ssn)||ssn.slice(3,5)==='00'||ssn.slice(5)==='0000')throw fail('Enter a valid-format Social Security number for Form W-4.')
 const identity={firstNameMiddleInitial:text(personal.firstNameMiddleInitial,'first name and middle initial',100),lastName:text(personal.lastName,'last name',100),address:text(personal.address,'home address',200),cityStateZip:text(personal.cityStateZip,'city, state and ZIP code',200),ssn}
 for(const name of ['twoJobs','exempt','nonresidentAlien'])if(typeof body[name]!=='boolean')throw fail(`Select the ${name} option explicitly.`)
 const filingStatus=body.filingStatus??null
 if(!body.exempt&&!['SINGLE','MARRIED','HEAD_OF_HOUSEHOLD'].includes(filingStatus))throw fail('Select the filing status shown in Step 1(c).')
 const amounts=Object.fromEntries(['qualifyingChildrenCents','otherDependentsCents','creditsCents','otherIncomeCents','deductionsCents','extraWithholdingCents'].map(name=>[name,amount(body[name],name)]))
 if(body.exempt&&(filingStatus!==null||body.twoJobs||Object.values(amounts).some(value=>value!==null)))throw fail('For exemption, complete only personal information and the signature; leave the other steps blank as the form instructs.')
 return {year:2026,templateSha256:W4_2026.templateSha256,personal:identity,filingStatus,twoJobs:body.twoJobs,exempt:body.exempt,nonresidentAlien:body.nonresidentAlien,...amounts}
}
const page='topmostSubform[0].Page1[0].'
export const W4_2026_FIELDS={firstNameMiddleInitial:page+'Step1a[0].f1_01[0]',lastName:page+'Step1a[0].f1_02[0]',address:page+'Step1a[0].f1_03[0]',cityStateZip:page+'Step1a[0].f1_04[0]',ssn:page+'f1_05[0]',SINGLE:page+'c1_1[0]',MARRIED:page+'c1_1[1]',HEAD_OF_HOUSEHOLD:page+'c1_1[2]',twoJobs:page+'c1_2[0]',qualifyingChildrenCents:page+'Step3_ReadOrder[0].f1_06[0]',otherDependentsCents:page+'Step3_ReadOrder[0].f1_07[0]',creditsCents:page+'f1_08[0]',otherIncomeCents:page+'f1_09[0]',deductionsCents:page+'f1_10[0]',extraWithholdingCents:page+'f1_11[0]',exempt:page+'c1_3[0]',employerNameAddress:page+'f1_12[0]',firstEmploymentDate:page+'f1_13[0]',employerEin:page+'f1_14[0]'}
