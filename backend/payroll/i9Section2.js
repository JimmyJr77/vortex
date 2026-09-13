// Structural form input only. Acceptance, examination, timing and alternative-
// procedure qualification must be established by the employer workflow.
import {I9_EDITION} from './i9Section1.js'
const fail=message=>Object.assign(new Error(message),{status:400})
const object=(value,keys,label)=>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw fail(`Review the ${label} fields.`)
 return value
}
const text=(value,label,required=true,max=200)=>{
 if(value==null||value===''){if(required)throw fail(`Complete ${label}.`);return ''}
 if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u001f\u007f]/.test(value))throw fail(`Review ${label}.`)
 return value.trim().normalize('NFC')
}
const date=(value,label)=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw fail(`Use a valid date for ${label}.`)
 return value
}
const document=(value,label)=>{
 const b=object(value,['title','issuingAuthority','number','expiresOn'],label)
 return {title:text(b.title,`${label} title`),issuingAuthority:text(b.issuingAuthority,`${label} issuing authority`),number:text(b.number,`${label} number`,false),expiresOn:b.expiresOn==null||b.expiresOn===''?'':date(b.expiresOn,`${label} expiration`)}
}
export function i9Section2Input(body){
 const b=object(body,['edition','documentChoice','listA','listB','listC','additionalInformation','examinationMethod','firstDayEmployed','representativeNameAndTitle','businessName','businessAddress'],'Section 2')
 if(b.edition!==I9_EDITION)throw fail('Use the retained I-9 edition 01/20/25.')
 let documents
 if(b.documentChoice==='LIST_A'){
  if(!Array.isArray(b.listA)||b.listA.length<1||b.listA.length>3||b.listB!=null||b.listC!=null)throw fail('Record the employee-chosen List A combination without List B or C entries.')
  documents={listA:b.listA.map((row,i)=>document(row,`List A document ${i+1}`)),listB:null,listC:null}
 }else if(b.documentChoice==='LIST_B_C'){
  if(b.listA!=null)throw fail('Record List B and List C without List A entries.')
  documents={listA:[],listB:document(b.listB,'List B document'),listC:document(b.listC,'List C document')}
 }else throw fail('Record the employee’s choice of List A or List B plus List C.')
 if(!['PHYSICAL','ALTERNATIVE'].includes(b.examinationMethod))throw fail('Record the examination method explicitly.')
 return {edition:I9_EDITION,documentChoice:b.documentChoice,...documents,additionalInformation:text(b.additionalInformation,'additional information',false,1000),examinationMethod:b.examinationMethod,firstDayEmployed:date(b.firstDayEmployed,'first day of employment'),representativeNameAndTitle:text(b.representativeNameAndTitle,'representative name and title'),businessName:text(b.businessName,'employer business name'),businessAddress:text(b.businessAddress,'employer business address')}
}
