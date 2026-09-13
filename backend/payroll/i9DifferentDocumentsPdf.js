import {PDFDocument,PDFName,PDFTextField,PDFCheckBox,PDFDropdown} from 'pdf-lib'
import {readFile} from 'node:fs/promises'
import fontkit from '@pdf-lib/fontkit'
import {createHash} from 'node:crypto'
import {renderI9Section2Preview} from './i9Section2Pdf.js'
import {i9Section2Input} from './i9Section2.js'
import {signRetainedPayrollForm} from './i9SignaturePdf.js'
const fail=message=>Object.assign(new Error(message),{status:400})
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const names=new Set(['Last Name (Family Name)','First Name Given Name','Employee Middle Initial (if any)'])
// Produce a new Section 2 attachment from the original employee-signed source.
// The original employee signature remains only in that immutable source.
export async function renderI9DifferentDocumentsPreview(employeeSignedSource,raw){
 if(!raw||Array.isArray(raw)||Object.keys(raw).some(k=>!['section2','reason','initials','recordedOn','originalEmployerSha256'].includes(k)))throw fail('Use the supported different-document replacement fields.')
 for(const [key,max] of [['reason',500],['initials',20]])if(typeof raw[key]!=='string'||raw[key].trim().length<(key==='reason'?12:1)||raw[key].length>max||/[\u0000-\u001f\u007f]/.test(raw[key]))throw fail('Record a meaningful replacement explanation and examiner initials.')
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raw.recordedOn||'')||!Number.isFinite(Date.parse(raw.recordedOn))||new Date(raw.recordedOn).toISOString().slice(0,10)!==raw.recordedOn)throw fail('Record an actual date for the new document explanation.')
 if(!/^[a-f0-9]{64}$/.test(raw.originalEmployerSha256||''))throw fail('Retain the hash of the original signed employer certification.')
 const input=i9Section2Input(raw.section2),stamp=`${raw.recordedOn.slice(5,7)}/${raw.recordedOn.slice(8,10)}/${raw.recordedOn.slice(0,4)}`
 const explanation=`${raw.initials.trim()} ${stamp}: Different documentation replaces the prior receipt. See attached explanation starting on page 2.`
 const section2={...input,...(input.documentChoice==='LIST_B_C'?{listA:undefined}:{}),additionalInformation:explanation}
 const sourceBefore=hash(employeeSignedSource),composed=await renderI9Section2Preview(employeeSignedSource,section2),pdf=await PDFDocument.load(composed),form=pdf.getForm(),page=pdf.getPage(0)
 const fontBytes=await readFile(new URL('./forms/fonts/NotoSans-Regular.ttf',import.meta.url))
 if(hash(fontBytes)!=='b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5')throw new Error('Review the changed payroll form font.')
 pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fontBytes,{subset:true})
 const expected=new Map()
 for(const field of form.getFields()){
  const widgets=field.acroField.getWidgets(),onPage=widgets.filter(w=>w.dict.get(PDFName.of('P'))?.toString()===page.ref.toString())
  if(!onPage.length){form.acroForm.removeField(field.acroField);continue}
  if(onPage.length!==widgets.length)throw new Error('A replacement field unexpectedly spans retained and omitted pages.')
  if(onPage.some(w=>w.getRectangle().y>=410)&&!names.has(field.getName())){
   if(field instanceof PDFTextField){field.setText('');field.updateAppearances(font)}
   else if(field instanceof PDFCheckBox){field.uncheck();field.updateAppearances()}
   else if(field instanceof PDFDropdown){field.clear();field.updateAppearances(font)}
   else throw new Error('Review the changed Section 1 field type.')
  }
  expected.set(field.getName(),field.acroField.dict.get(PDFName.of('V'))?.toString())
 }
 for(let n=pdf.getPageCount()-1;n>0;n--)pdf.removePage(n)
 // Keep all explanation text at a readable size, including unbroken reference
 // identifiers. The retained review must require every continuation page.
 const characters=new Set(font.getCharacterSet())
 const wrap=value=>{
  if([...value].some(c=>c!=='\n'&&!characters.has(c.codePointAt(0))))throw fail('A replacement explanation needs additional font support.')
  const lines=[]
  for(const paragraph of value.split('\n')){
   let line=''
   for(const char of paragraph){
    if(line&&font.widthOfTextAtSize(line+char,10)>516){
     const boundary=line.lastIndexOf(' ')
     if(boundary>0){lines.push(line.slice(0,boundary));line=line.slice(boundary+1)+char}
     else{lines.push(line);line=char}
    }else line+=char
   }
   lines.push(line)
  }
  return lines
 }
 let continuation,y
 const next=()=>{continuation=pdf.addPage([612,792]);y=730;continuation.drawText('I-9 new Section 2 - replacement explanation',{x:48,y,font,size:13});y-=30}
 const paragraph=(label,value)=>{
  for(const line of wrap(`${label}: ${value}`)){
   if(!continuation||y<70)next()
   continuation.drawText(line,{x:48,y,font,size:10});y-=14
  }
  y-=12
 }
 paragraph('Employee',[form.getTextField('First Name Given Name').getText(),form.getTextField('Last Name (Family Name)').getText()].filter(Boolean).join(' '))
 paragraph('Original signed employer certification SHA-256',raw.originalEmployerSha256)
 paragraph('Original employee-signed source SHA-256',sourceBefore)
 paragraph('Reason for different documentation',raw.reason.trim())
 paragraph('Examiner initials and date',`${raw.initials.trim()} ${stamp}`)
 paragraph('Additional employer information',input.additionalInformation||'(blank)')
 paragraph('Retention','Retain this complete new Section 2 attachment with the original signed I-9. The employer signature on page 1 certifies the new Section 2; the original employee signature remains on the retained original.')
 const pageCount=pdf.getPageCount()
 for(let n=1;n<pageCount;n++)pdf.getPage(n).drawText(`New Section 2 attachment - page ${n+1} of ${pageCount}`,{x:48,y:35,font,size:8})
 pdf.setTitle('Form I-9 - new Section 2 for different replacement documents')
 const output=Buffer.from(await pdf.save()),saved=await PDFDocument.load(output),result=saved.getForm()
 if(saved.getPageCount()!==pageCount||hash(employeeSignedSource)!==sourceBefore)throw new Error('Replacement attachment altered its source or page count.')
 for(const [name,value] of expected)if(result.getField(name).acroField.dict.get(PDFName.of('V'))?.toString()!==value)throw new Error('A replacement attachment lost a canonical form value.')
 if(result.getTextField('Signature of Employee').getText()||result.getTextField('Signature of Employer or AR').getText())throw new Error('A new replacement attachment must not inherit signatures.')
 return {pdf:output,pageCount,sourceEmployeeSha256:sourceBefore,section2}
}
export async function signI9DifferentDocumentsPdf(preview,{signature,signedOn,pageCount}){
 if(!Number.isInteger(pageCount)||pageCount<2||pageCount>100)throw fail('Review every page of the new Section 2 attachment before signing.')
 return signRetainedPayrollForm(preview,{signature,signedOn,pageCount,signatureField:'Signature of Employer or AR',dateField:'S2 Todays Date mmddyyyy',title:'Form I-9 - signed new Section 2 for different replacement documents'})
}
