export const MW507_2026={year:2026,source:'https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/forms/2026/mw507.pdf',templateSha256:'f3a0ac6ac464042b8bbd63ee0d61cbdf464bea5f05124f731e660630caec6140',perjury:'Under the penalty of perjury, I further certify that I am entitled to the number of withholding allowances claimed on line 1 above, or if claiming exemption from withholding, that I am entitled to claim the exempt status on whichever line(s) I completed.'}
const fail=message=>Object.assign(new Error(message),{status:400})
const text=(value,label,max=200)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u001f\u007f]/.test(value))throw fail(`Complete ${label} without control characters.`);return value.trim().normalize('NFC')}
const integer=(value,label)=>{if(!Number.isSafeInteger(value)||value<0)throw fail(`Use a nonnegative whole number for ${label}.`);return value}
const nullable=(value,label)=>value===null||value===undefined?null:integer(value,label)
export function mw507Worksheet2026(input){
 if(!input||!['SINGLE','JOINT'].includes(input.filingGroup))throw fail('Select the exemption worksheet tax-return filing group.')
 const agi=integer(input.agiCents,'estimated federal AGI'),personal=integer(input.personalExemptions,'personal exemptions'),aged=integer(input.agedDependentExemptions,'dependents age 65 or over'),extra=integer(input.additionalDeductionCents,'additional deductible cents'),agedBlind=integer(input.agedBlindExemptions,'age/blindness exemptions')
 if(agedBlind>4)throw fail('Review the age/blindness exemptions for the taxpayer and spouse.')
 const joint=input.filingGroup==='JOINT'
 const exemptionValueCents=joint?(agi<=15000000?320000:agi<=17500000?160000:agi<=20000000?80000:0):(agi<=10000000?320000:agi<=12500000?160000:agi<=15000000?80000:0)
 const a=integer(personal*exemptionValueCents,'worksheet line a'),b=integer(aged*exemptionValueCents,'worksheet line b'),c=extra,d=agedBlind*100000,e=integer(a+b+c+d,'worksheet total'),f=Math.floor(e/320000)
 return {filingGroup:input.filingGroup,agiCents:agi,personalExemptions:personal,agedDependentExemptions:aged,additionalDeductionCents:extra,agedBlindExemptions:agedBlind,exemptionValueCents,lines:{a,b,c,d,e,f}}
}
export function mw507FormInput2026(body){
 if(!body||body.year!==2026)throw fail('Use the reviewed 2026 Maryland MW507.')
 const p=body.personal||{},ssn=typeof p.ssn==='string'?p.ssn.trim().replaceAll('-',''):''
 if(!/^\d{9}$/.test(ssn)||/^(000|666|9\d\d)/.test(ssn)||ssn.slice(3,5)==='00'||ssn.slice(5)==='0000')throw fail('Use a valid-format Social Security number.')
 const personal={fullName:text(p.fullName,'full name'),address:text(p.address,'street address, city, state and ZIP'),county:text(p.county,'county of residence or Maryland work county'),ssn}
 const rate=body.withholdingRate??null
 if(rate!==null&&!['SINGLE','MARRIED','MARRIED_SINGLE'].includes(rate))throw fail('Select a Maryland withholding-rate option.')
 const exemptions=nullable(body.exemptions,'line 1 exemptions'),additionalWithholdingCents=nullable(body.additionalWithholdingCents,'line 2 additional withholding cents')
 const raw=body.claim||{},kind=raw.kind
 let claim
 if(kind==='NONE'){if(rate===null||exemptions===null)throw fail('Select a withholding rate and line 1 exemptions.');claim={kind}}
 else if(kind==='NO_LIABILITY'){
  if(raw.priorYearNoTax!==true||raw.currentYearNoTax!==true||raw.effectiveYear!==2026)throw fail('Line 3 requires both no-liability certifications and effective year 2026.')
  claim={kind,priorYearNoTax:true,currentYearNoTax:true,effectiveYear:2026}
 }else if(kind==='RECIPROCAL'){
  if(!['DC','VA','WV'].includes(raw.state)||raw.noMarylandAbode!==true)throw fail('Line 4 requires a listed domicile state and its Maryland-abode certification.')
  claim={kind,state:raw.state,noMarylandAbode:true}
 }else if(kind==='PENNSYLVANIA'){
  if(raw.noMarylandAbode!==true||!['NONE','YORK_ADAMS','NO_LOCAL_TAX'].includes(raw.localExemption))throw fail('Review the Pennsylvania abode and separate local-tax exemption choices.')
  claim={kind,noMarylandAbode:true,localExemption:raw.localExemption}
 }else if(kind==='MILITARY_SPOUSE'){
  if(!['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].includes(raw.state)||raw.certifiedEligible!==true)throw fail('Line 8 requires an eligible out-of-state domicile and certification. Required military-spouse attachments must also be reviewed.')
  claim={kind,state:raw.state,certifiedEligible:true}
 }else throw fail('Select the Maryland exemption basis explicitly, including none when appropriate.')
 if(Object.keys(raw).some(key=>!Object.hasOwn(claim,key)))throw fail('Remove conflicting exemption-basis entries before preparing the MW507.')
 const worksheet=body.worksheet==null?null:mw507Worksheet2026(body.worksheet)
 if(worksheet&&exemptions!==null&&exemptions>worksheet.lines.f)throw fail('Line 1 cannot exceed line f of the personal exemptions worksheet.')
 return {year:2026,templateSha256:MW507_2026.templateSha256,personal,withholdingRate:rate,exemptions,additionalWithholdingCents,claim,worksheet}
}
// These are review obligations, not proof that Maryland has accepted a claim.
export function mw507ReviewRequirements2026(body){
 const input=mw507FormInput2026(body),reasons=[]
 if(input.exemptions>10)reasons.push('MORE_THAN_TEN_EXEMPTIONS')
 if(['RECIPROCAL','PENNSYLVANIA'].includes(input.claim.kind))reasons.push('NONRESIDENCE_CLAIM')
 if(input.claim.kind==='MILITARY_SPOUSE')reasons.push('MILITARY_SPOUSE_CLAIM')
 return {comptrollerSubmissionReasons:reasons,noLiabilityWeeklyWageReviewRequired:input.claim.kind==='NO_LIABILITY',additionalAgreementRequired:input.additionalWithholdingCents>0,attachmentsRequired:input.claim.kind==='MILITARY_SPOUSE'?['MW507M','SPOUSAL_MILITARY_ID']:[],renewBy:input.claim.kind==='NO_LIABILITY'?'2027-02-15':null,revocationAndCorrectnessReviewRequired:true}
}
export const MW507_FIELDS={fullName:'Text Field 1',ssn:'Text Field 2',address:'Text Field 3',county:'Text Field 4',withholdingRate:'Check Box 1',exemptions:'Text Field 12',additionalWithholdingCents:'Text Field 13',priorYearNoTax:'Check Box 4',currentYearNoTax:'Check Box 400',effectiveYear:'Text Field 15',line3:'Text Field 14',domicile:'Check Box 6',line4:'Text Field 16',line5:'Text Field 18',line6:'Text Field 19',line7:'Text Field 20',militaryState:'Text Field 22',line8:'Text Field 21',signedOn:'Text Field 23',employerEin:'Text Field 24',employerNameAddress:'Text Field 25',a:'Text Field 26',b:'Text Field 27',c:'Text Field 28',d:'Text Field 29',e:'Text Field 30',f:'Text Field 31'}
