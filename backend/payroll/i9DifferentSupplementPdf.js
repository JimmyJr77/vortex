import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {PDFDocument,PDFName} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {i9SupplementBInput} from './i9SupplementB.js'
import {renderI9SupplementBPreview} from './i9SupplementBPdf.js'
import {signRetainedPayrollForm} from './i9SignaturePdf.js'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const fail=message=>Object.assign(new Error(message),{status:400})
// The calling workflow must establish the scoped, still-open Supplement B receipt.
// This renderer preserves both signed sources and makes a fresh unsigned supplement.
export async function renderI9DifferentSupplementPreview(originalEmployerPdf,receiptSupplementPdf,raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!['supplement','reason','initials','recordedOn'].includes(key)))throw fail('Use the supported replacement Supplement B fields.')
 for(const [key,max] of [['reason',2000],['initials',20]])if(typeof raw[key]!=='string'||raw[key].trim().length<(key==='reason'?12:1)||raw[key].length>max||(key==='reason'?/[\u0000-\u0009\u000b-\u001f\u007f]/:/[\u0000-\u001f\u007f]/).test(raw[key]))throw fail('Retain a meaningful replacement explanation and examiner initials.')
 if(typeof raw.recordedOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(raw.recordedOn)||!Number.isFinite(Date.parse(raw.recordedOn))||new Date(raw.recordedOn).toISOString().slice(0,10)!==raw.recordedOn)throw fail('Record a real replacement date.')
 const input=i9SupplementBInput(raw.supplement),source=await PDFDocument.load(receiptSupplementPdf),original=await PDFDocument.load(originalEmployerPdf),receipt=source.getForm(),root=original.getForm()
 if(source.getPageCount()!==1||!receipt.getTextField('Signature of Emp Rep 0').getText()||!receipt.getTextField('Todays Date 0').getText())throw fail('Use the original signed and dated receipt Supplement B.')
 for(const [name,originalName] of [['Last Name Family Name from Section 1-2','Last Name (Family Name)'],['First Name Given Name from Section 1-2','First Name Given Name'],['Middle initial if any from Section 1-2','Employee Middle Initial (if any)']])if((receipt.getTextField(name).getText()||'')!==(root.getTextField(originalName).getText()||''))throw fail('The receipt supplement does not match the original employee identity.')
 const sourceEmployerSha256=hash(originalEmployerPdf),sourceSupplementSha256=hash(receiptSupplementPdf),stamp=`${raw.recordedOn.slice(5,7)}/${raw.recordedOn.slice(8,10)}/${raw.recordedOn.slice(0,4)}`
 const rendered=await renderI9SupplementBPreview(originalEmployerPdf,{...input,additionalInformation:`${raw.initials.trim()} ${stamp}: Different replacement. See attached explanation.`})
 const pdf=await PDFDocument.load(rendered),form=pdf.getForm(),expected=new Map(form.getFields().map(field=>[field.getName(),field.acroField.dict.get(PDFName.of('V'))?.toString()]))
 const fontBytes=await readFile(new URL('./forms/fonts/NotoSans-Regular.ttf',import.meta.url))
 if(hash(fontBytes)!=='b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5')throw new Error('Review the changed payroll form font.')
 pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fontBytes,{subset:true}),characters=new Set(font.getCharacterSet())
 const wrap=value=>{
  if([...value].some(char=>char!=='\n'&&!characters.has(char.codePointAt(0))))throw fail('A replacement explanation needs additional font support.')
  const lines=[]
  for(const paragraph of value.split('\n')){
   let line=''
   for(const char of paragraph){
    if(line&&font.widthOfTextAtSize(line+char,10)>516){const boundary=line.lastIndexOf(' ');if(boundary>0){lines.push(line.slice(0,boundary));line=line.slice(boundary+1)+char}else{lines.push(line);line=char}}else line+=char
   }
   lines.push(line)
  }
  return lines
 }
 let page,y
 const next=()=>{page=pdf.addPage([612,792]);y=730;page.drawText('I-9 Supplement B - different replacement documents',{x:48,y,font,size:13});y-=30}
 const paragraph=(label,value)=>{for(const line of wrap(`${label}: ${value}`)){if(!page||y<70)next();page.drawText(line,{x:48,y,font,size:10});y-=14}y-=12}
 paragraph('Employee',[receipt.getTextField('First Name Given Name from Section 1-2').getText(),receipt.getTextField('Last Name Family Name from Section 1-2').getText()].filter(Boolean).join(' '))
 paragraph('Original signed employer certification SHA-256',sourceEmployerSha256)
 paragraph('Original signed receipt Supplement B SHA-256',sourceSupplementSha256)
 paragraph('Reason for different replacement documentation',raw.reason.trim().normalize('NFC'))
 paragraph('Examiner initials and date',`${raw.initials.trim().normalize('NFC')} ${stamp}`)
 paragraph('Additional examiner information',input.additionalInformation||'(blank)')
 paragraph('Retention','Retain this complete signed replacement supplement with the original Form I-9 and the prior signed receipt supplement. Prior certifications remain unchanged.')
 const pageCount=pdf.getPageCount()
 for(let n=1;n<pageCount;n++)pdf.getPage(n).drawText(`Replacement Supplement B attachment - page ${n+1} of ${pageCount}`,{x:48,y:35,font,size:8})
 pdf.setTitle('I-9 Supplement B - different-document replacement preview')
 const output=Buffer.from(await pdf.save()),saved=await PDFDocument.load(output),fields=saved.getForm()
 if(hash(originalEmployerPdf)!==sourceEmployerSha256||hash(receiptSupplementPdf)!==sourceSupplementSha256||saved.getPageCount()!==pageCount)throw new Error('Replacement supplement changed its signed source or page count.')
 for(const [name,value] of expected)if(fields.getField(name).acroField.dict.get(PDFName.of('V'))?.toString()!==value)throw new Error('Replacement supplement lost a canonical field value.')
 if(fields.getTextField('Signature of Emp Rep 0').getText()||fields.getTextField('Todays Date 0').getText())throw new Error('Replacement review must not inherit a prior signature or date.')
 return {pdf:output,pageCount,sourceEmployerSha256,sourceSupplementSha256}
}
export async function signI9DifferentSupplementPdf(preview,{signature,signedOn,pageCount}){
 if(!Number.isInteger(pageCount)||pageCount<2||pageCount>100)throw fail('Review every replacement supplement and explanation page before signing.')
 return signRetainedPayrollForm(preview,{signature,signedOn,pageCount,signatureField:'Signature of Emp Rep 0',dateField:'Todays Date 0',title:'I-9 Supplement B - signed different-document replacement'})
}
