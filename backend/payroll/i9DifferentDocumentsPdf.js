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
 const explanation=`${raw.initials.trim()} ${stamp}: Different documentation replaces the prior receipt. ${raw.reason.trim()} Original signed I-9 SHA-256 (join both parts): ${raw.originalEmployerSha256.slice(0,32)} ${raw.originalEmployerSha256.slice(32)}.`
 const section2={...input,...(input.documentChoice==='LIST_B_C'?{listA:undefined}:{}),additionalInformation:[explanation,input.additionalInformation].filter(Boolean).join(' ')}
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
 pdf.setTitle('Form I-9 - new Section 2 for different replacement documents')
 const output=Buffer.from(await pdf.save()),saved=await PDFDocument.load(output),result=saved.getForm()
 if(saved.getPageCount()!==1||hash(employeeSignedSource)!==sourceBefore)throw new Error('Replacement attachment altered its source or page count.')
 for(const [name,value] of expected)if(result.getField(name).acroField.dict.get(PDFName.of('V'))?.toString()!==value)throw new Error('A replacement attachment lost a canonical form value.')
 if(result.getTextField('Signature of Employee').getText()||result.getTextField('Signature of Employer or AR').getText())throw new Error('A new replacement attachment must not inherit signatures.')
 return {pdf:output,pageCount:1,sourceEmployeeSha256:sourceBefore,section2}
}
export async function signI9DifferentDocumentsPdf(preview,{signature,signedOn}){
 return signRetainedPayrollForm(preview,{signature,signedOn,pageCount:1,signatureField:'Signature of Employer or AR',dateField:'S2 Todays Date mmddyyyy',title:'Form I-9 - signed new Section 2 for different replacement documents'})
}
