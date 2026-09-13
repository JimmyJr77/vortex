const fail=message=>Object.assign(new Error(message),{status:400})
const object=(value,keys)=>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw fail('Use the supported Supplement B fields.')
 return value
}
const text=(value,max,required=false)=>{
 if(value==null&&!required)return ''
 if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw fail('Review the Supplement B text.')
 const result=value.trim().normalize('NFC')
 if(required&&!result)throw fail('Complete the required Supplement B fields.')
 return result
}
const date=value=>{
 if(value==null||value==='')return ''
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw fail('Enter a real document expiration date.')
 return value
}
// Form data only. The recording workflow must independently establish whether
// reverification is required and retain actual examination and signing evidence.
export function i9SupplementBInput(raw){
 const value=object(raw,['edition','document','representativeName','newName','additionalInformation','examinationMethod'])
 if(value.edition!=='01/20/25')throw fail('Review the supported I-9 edition.')
 const doc=object(value.document,['list','title','number','expiresOn'])
 if(!['A','C'].includes(doc.list))throw fail('Reverification requires employee-chosen List A or List C documentation.')
 if(!['PHYSICAL','ALTERNATIVE'].includes(value.examinationMethod))throw fail('Select the examination method.')
 const name=value.newName==null?{}:object(value.newName,['lastName','firstName','middleInitial'])
 const newName={lastName:text(name.lastName,100),firstName:text(name.firstName,100),middleInitial:text(name.middleInitial,1)}
 if(Object.values(newName).some(Boolean)&&(!newName.lastName||!newName.firstName))throw fail('Record both first and last name when documenting a name change.')
 return {edition:value.edition,document:{list:doc.list,title:text(doc.title,150,true),number:text(doc.number,100),expiresOn:date(doc.expiresOn)},representativeName:text(value.representativeName,200,true),newName,additionalInformation:text(value.additionalInformation,1000),examinationMethod:value.examinationMethod}
}
