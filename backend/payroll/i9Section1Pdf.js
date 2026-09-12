import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {PDFDocument,PDFName} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {i9Section1Input} from './i9Section1.js'
const fail=message=>Object.assign(new Error(message),{status:400})
const usDate=value=>value==='N/A'?value:`${value.slice(5,7)}/${value.slice(8,10)}/${value.slice(0,4)}`
// Unsigned preview only. No attestation signature, employer examination or
// preparer certification is created by rendering this document.
export async function renderI9Section1Preview({answers,context}){
 const input=i9Section1Input(answers,context),template=await readFile(new URL('./forms/uscis-i9-012025.pdf',import.meta.url))
 if(createHash('sha256').update(template).digest('hex')!=='780f348c34df694bb0b4dbbfaf9f22b99b9757b80d16a37ba89aadf069597281')throw new Error('Review the changed I-9 template before use.')
 const pdf=await PDFDocument.load(template),form=pdf.getForm(),bytes=await readFile(new URL('./forms/fonts/NotoSans-Regular.ttf',import.meta.url))
 if(createHash('sha256').update(bytes).digest('hex')!=='b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5')throw new Error('Review the changed payroll form font before use.')
 pdf.registerFontkit(fontkit);const font=await pdf.embedFont(bytes,{subset:true}),characters=new Set(font.getCharacterSet()),expected=new Map()
 const fill=(name,value)=>{
  const field=form.getTextField(name),text=String(value??''),rect=field.acroField.getWidgets()[0].getRectangle()
  if([...text].some(c=>!characters.has(c.codePointAt(0))))throw fail('An I-9 entry needs additional font support to retain its exact characters.')
  const width=font.widthOfTextAtSize(text,9),size=Math.min(9,rect.height-2,width?9*(rect.width-4)/width:9)
  if(size<6)throw fail('An I-9 entry is too long to print legibly.')
  field.setFontSize(size);field.setText(text);expected.set(name,text)
 }
 const names={lastName:'Last Name (Family Name)',firstName:'First Name Given Name',middleInitial:'Employee Middle Initial (if any)',otherLastNames:'Employee Other Last Names Used (if any)',address:'Address Street Number and Name',apartment:'Apt Number (if any)',city:'City or Town',postalCode:'ZIP Code',ssn:'US Social Security Number',email:'Employees E-mail Address',phone:'Telephone Number'}
 for(const [key,name] of Object.entries(names))fill(name,input.personal[key])
 fill('Date of Birth mmddyyyy',usDate(input.personal.dateOfBirth))
 const state=form.getDropdown('State');if(!state.getOptions().includes(input.personal.state))throw fail('Select an address state available on the official I-9 form.');state.select(input.personal.state)
 const kind=input.attestation.kind,selected=['CITIZEN','NONCITIZEN_NATIONAL','PERMANENT_RESIDENT','AUTHORIZED_WORKER'].indexOf(kind)+1
 for(let n=1;n<=4;n++){const field=form.getCheckBox(`CB_${n}`);if(n===selected)field.check();else field.uncheck();field.updateAppearances()}
 fill('3 A lawful permanent resident Enter USCIS or ANumber',kind==='PERMANENT_RESIDENT'?input.attestation.aNumber:'')
 const authorized=kind==='AUTHORIZED_WORKER',id=input.attestation.identifier
 fill('Exp Date mmddyyyy',authorized?usDate(input.attestation.authorizationExpiresOn):'')
 fill('USCIS ANumber',authorized&&id.kind==='A_NUMBER'?id.number:'')
 fill('Form I94 Admission Number',authorized&&id.kind==='I94'?id.number:'')
 fill('Foreign Passport Number and Country of IssuanceRow1',authorized&&id.kind==='PASSPORT'?`${id.number}, ${id.country}`:'')
 fill('Signature of Employee','');fill("Today's Date mmddyyy",'')
 for(const field of form.getFields()){field.enableReadOnly();field.acroField.dict.delete(PDFName.of('AA'));for(const widget of field.acroField.getWidgets())widget.dict.delete(PDFName.of('AA'))}
 form.updateFieldAppearances(font);pdf.setTitle('I-9 Section 1 - unsigned preview');pdf.setProducer('Vortex payroll')
 const output=Buffer.from(await pdf.save()),saved=await PDFDocument.load(output)
 if(saved.getPageCount()!==4)throw new Error('I-9 supplements were not retained.')
 for(const [name,value] of expected)if((saved.getForm().getTextField(name).getText()??'')!==value)throw new Error('I-9 canonical fields did not preserve entries.')
 return output
}
