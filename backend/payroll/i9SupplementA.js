import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {PDFDocument,PDFName,PDFCheckBox} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
export const I9_PREPARER_ATTESTATION='I attest, under penalty of perjury, that I have assisted in the completion of Section 1 of this form and that to the best of my knowledge the information is true and correct.'
const fail=message=>Object.assign(new Error(message),{status:400})
export function preparerInput(body){
 const keys=['firstName','lastName','middleInitial','address','city','state','postalCode']
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!keys.includes(k)))throw fail('Use the supported preparer identity and address fields.')
 return Object.fromEntries(keys.map(k=>{
  const v=body[k]??''
  if(typeof v!=='string'||(k!=='middleInitial'&&!v.trim())||v.length>(k==='middleInitial'?1:k==='postalCode'?6:200)||/[\u0000-\u001f\u007f]/.test(v))throw fail(`Review preparer ${k}.`)
  return [k,v.trim().normalize('NFC')]
 }))
}
export async function renderSupplementA({employee,preparer,signature='',signedOn=null}){
 const answers=preparerInput(preparer),template=await readFile(new URL('./forms/uscis-i9-012025.pdf',import.meta.url))
 if(createHash('sha256').update(template).digest('hex')!=='780f348c34df694bb0b4dbbfaf9f22b99b9757b80d16a37ba89aadf069597281')throw new Error('Review the changed I-9 template.')
 const inventory=JSON.parse(await readFile(new URL('./forms/uscis-i9-012025-fields.json',import.meta.url),'utf8'))
 const allowed=new Set(inventory.fields.filter(f=>f.widgets.some(w=>w.page===3)).map(f=>f.name))
 const pdf=await PDFDocument.load(template),form=pdf.getForm()
 // Retain the original Supplement A. Use block zero only: the source's block
 // one has a shared last/first-name field. Additional people get separate sheets.
 for(const field of form.getFields())if(!allowed.has(field.getName())){if(field instanceof PDFCheckBox){field.uncheck();field.updateAppearances()}form.removeField(field)}
 pdf.removePage(3);pdf.removePage(1);pdf.removePage(0)
 const bytes=await readFile(new URL('./forms/fonts/NotoSans-Regular.ttf',import.meta.url))
 if(createHash('sha256').update(bytes).digest('hex')!=='b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5')throw new Error('Review the changed payroll font.')
 pdf.registerFontkit(fontkit);const font=await pdf.embedFont(bytes,{subset:true}),chars=new Set(font.getCharacterSet()),expected=new Map()
 const fill=(name,value)=>{
  const f=form.getTextField(name),text=String(value??''),rect=f.acroField.getWidgets()[0].getRectangle()
  if([...text].some(c=>!chars.has(c.codePointAt(0))))throw fail('A preparer entry needs additional font support to preserve its exact characters.')
  if(f.getMaxLength()!==undefined&&text.length>f.getMaxLength())throw fail(`The supplement field ${name} exceeds its official character limit.`)
  const width=font.widthOfTextAtSize(text,9),size=Math.min(9,rect.height-2,width?9*(rect.width-4)/width:9)
  if(size<6)throw fail('A preparer entry is too long to print legibly.')
  f.setFontSize(size);f.setText(text);expected.set(name,text)
 }
 for(const [key,name] of Object.entries({lastName:'Last Name Family Name from Section 1',firstName:'First Name Given Name from Section 1',middleInitial:'Middle initial if any from Section 1'}))fill(name,employee[key])
 for(const [key,name] of Object.entries({lastName:'Preparer or Translator Last Name (Family Name) 0',firstName:'Preparer or Translator First Name (Given Name) 0',middleInitial:'PT Middle Initial 0',address:'Preparer or Translator Address (Street Number and Name) 0',city:'Preparer or Translator City or Town 0',postalCode:'Zip Code 0'}))fill(name,answers[key])
 const state=form.getDropdown('Preparer State 0');if(!state.getOptions().includes(answers.state))throw fail('Select a preparer address state available on the official supplement.');state.select(answers.state)
 if(signature){if(typeof signature!=='string'||!signature.trim()||signature.length>200||/[\u0000-\u001f\u007f]/.test(signature)||typeof signedOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(signedOn)||!Number.isFinite(Date.parse(signedOn))||new Date(signedOn).toISOString().slice(0,10)!==signedOn)throw fail('Use an explicit preparer signature and valid signing date.')}
 else if(signedOn)throw fail('A signing date requires a preparer signature.')
 fill('Signature of Preparer or Translator 0',signature.trim().normalize('NFC'));fill('Sig Date mmddyyyy 0',signedOn?`${signedOn.slice(5,7)}/${signedOn.slice(8,10)}/${signedOn.slice(0,4)}`:'')
 for(const f of form.getFields()){f.enableReadOnly();f.acroField.dict.delete(PDFName.of('AA'));for(const w of f.acroField.getWidgets())w.dict.delete(PDFName.of('AA'))}
 form.updateFieldAppearances(font);pdf.setTitle(signature?'I-9 Supplement A - preparer signed':'I-9 Supplement A - unsigned preview')
 const output=Buffer.from(await pdf.save()),saved=await PDFDocument.load(output)
 if(saved.getPageCount()!==1)throw new Error('Supplement A must retain exactly its original page.')
 for(const [name,value] of expected)if((saved.getForm().getTextField(name).getText()||'')!==value)throw new Error('Supplement A canonical field verification failed.')
 return output
}
