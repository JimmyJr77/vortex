import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {PDFDocument,PDFName,rgb,drawLine,defaultTextFieldAppearanceProvider,layoutSinglelineText} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {I9_SECTION2_TITLE_FIELD} from './i9Section2Pdf.js'
import {signRetainedPayrollForm} from './i9SignaturePdf.js'
const fail=message=>Object.assign(new Error(message),{status:400})
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const object=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw fail('Use the supported receipt-replacement fields.');return v}
const text=(v,label,max,required=true)=>{if(v==null&&!required)return '';if(typeof v!=='string'||v.length>max||/[\u0000-\u001f\u007f]/.test(v)||required&&!v.trim())throw fail(`Review ${label}.`);return v.trim().normalize('NFC')}
const date=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw fail('Enter a real receipt-replacement date.');return v}
const usDate=v=>v?`${v.slice(5,7)}/${v.slice(8,10)}/${v.slice(0,4)}`:''
export const RECEIPT_SIGNATURE_FIELD='vortex.i9.receipt.signature'
export const RECEIPT_DATE_FIELD='vortex.i9.receipt.signatureDate'
export function i9ReceiptReplacementInput(raw){
 const b=object(raw,['sourceKind','rowKey','replacementKind','replacement','examinerName','initials','amendedOn','explanation'])
 if(!['SECTION2','SUPPLEMENT_B'].includes(b.sourceKind)||b.replacementKind!=='ACTUAL_REPLACEMENT')throw fail('Use this amendment for the actual document replacing the receipt; different documentation requires its new-section workflow.')
 if(b.sourceKind==='SECTION2'&&!['A1','A2','A3','B','C'].includes(b.rowKey)||b.sourceKind==='SUPPLEMENT_B'&&b.rowKey!=='SUPPLEMENT')throw fail('Choose the source receipt document row.')
 const d=object(b.replacement,['title','issuingAuthority','number','expiresOn'])
 return {sourceKind:b.sourceKind,rowKey:b.rowKey,replacementKind:b.replacementKind,replacement:{title:text(d.title,'replacement title',150),issuingAuthority:text(d.issuingAuthority,'issuing authority',200),number:text(d.number,'replacement number',100,false),expiresOn:d.expiresOn==null||d.expiresOn===''?'':date(d.expiresOn)},examinerName:text(b.examinerName,'examiner name',200),initials:text(b.initials,'examiner initials',20),amendedOn:date(b.amendedOn),explanation:text(b.explanation,'receipt-match explanation',2000)}
}
const rows={A1:[I9_SECTION2_TITLE_FIELD,'Document Number 0 (if any)'],A2:['Document Title 2 If any','Document Number If any_2'],A3:['List A.   Document Title 3.  If any','List A.  Document 3 Number.  If any'],B:['List B Document 1 Title','List B Document Number 1'],C:['List C Document Title 1','List C Document Number 1'],SUPPLEMENT:['Document Title 0','Document Number 0']}
// Render an amendment for review; the workflow must retain the original bytes,
// verify the actual replacement/examination and obtain the examiner's signature.
export async function renderI9ReceiptReplacementPreview(sourceBytes,raw){
 const input=i9ReceiptReplacementInput(raw),pdf=await PDFDocument.load(sourceBytes),form=pdf.getForm(),originalPages=input.sourceKind==='SECTION2'?4:1
 if(pdf.getPageCount()!==originalPages||form.getFields().some(f=>f.getName()===RECEIPT_SIGNATURE_FIELD))throw fail('Use the original retained signed form for this receipt.')
 const names=input.sourceKind==='SECTION2'?['Signature of Employee',"Today's Date mmddyyy",'Signature of Employer or AR','S2 Todays Date mmddyyyy']:['Signature of Emp Rep 0','Todays Date 0']
 if(names.some(name=>!form.getTextField(name).getText()))throw fail('The source receipt form must be signed and dated.')
 const before=new Map(form.getFields().map(f=>[f.getName(),f.acroField.dict.get(PDFName.of('V'))?.toString()]))
 const fontBytes=await readFile(new URL('./forms/fonts/NotoSans-Regular.ttf',import.meta.url))
 if(hash(fontBytes)!=='b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5')throw new Error('Review the changed payroll form font.')
 pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fontBytes,{subset:true}),characters=new Set(font.getCharacterSet())
 const supported=value=>{if([...value].some(c=>c!=='\n'&&c!=='\r'&&!characters.has(c.codePointAt(0))))throw fail('A receipt amendment entry needs additional font support.')}
 let marked=0
 for(const name of rows[input.rowKey]){
  const field=form.getTextField(name),value=field.getText()||'',matches=[...value.matchAll(/\breceipt\b/gi)]
  if(!matches.length)continue
  supported(value);const widgets=field.acroField.getWidgets()
  if(widgets.length!==1||widgets[0].dict.get(PDFName.of('P'))?.toString()!==pdf.getPage(0).ref.toString())throw fail('Review the source receipt field binding.')
  const rect=widgets[0].getRectangle(),size=Math.min(9,9*(rect.width-4)/font.widthOfTextAtSize(value,9))
  if(size<6||widgets[0].getAppearanceCharacteristics()?.getRotation())throw fail('The source receipt entry needs a legible correction layout.')
  // Some official fields merge the widget and field dictionary. Removing the
  // widget appearance then also removes the field appearance; restore it first.
  widgets[0].dict.delete(PDFName.of('DA'));field.acroField.setDefaultAppearance(`0 g /${font.name} ${size} Tf`);field.setFontSize(size);field.enableReadOnly()
  field.updateAppearances(font,(f,w,face)=>{
   const border=w.getBorderStyle()?.getWidth()||0,r=w.getRectangle(),padding=border+1
   const {line}=layoutSinglelineText(value,{alignment:f.getAlignment(),fontSize:size,font:face,bounds:{x:padding,y:padding,width:r.width-padding*2,height:r.height-padding*2}})
   return [...defaultTextFieldAppearanceProvider(f,w,face),...matches.flatMap(match=>{
    const start=line.x+face.widthOfTextAtSize(value.slice(0,match.index),size),end=start+face.widthOfTextAtSize(match[0],size),y=line.y+face.heightAtSize(size)*0.35
    return drawLine({start:{x:start,y},end:{x:end,y},thickness:0.8,color:rgb(0,0,0)})
   })]
  });marked+=matches.length
 }
 if(!marked)throw fail('The selected row has no receipt marker. Correct its original receipt record before using this amendment.')
 const infoName=input.sourceKind==='SECTION2'?'Additional Information':'Addtl Info 0',oldInformation=form.getTextField(infoName).getText()||''
 const pointer=`${input.initials} ${usDate(input.amendedOn)}: Receipt replaced. See attached receipt-replacement continuation starting on page ${originalPages+1}. Previous additional information is retained there.`
 supported(pointer)
 const info=form.getTextField(infoName),r=info.acroField.getWidgets()[0].getRectangle()
 // The shorter Supplement B box uses a compact pointer; full facts remain on
 // the continuation, alongside the original notes and exact source hash.
 const note=input.sourceKind==='SUPPLEMENT_B'?`${input.initials} ${usDate(input.amendedOn)}: Receipt replaced; see attached continuation.`:pointer
 const wrap=(value,size,width)=>{
  supported(value);const lines=[]
  for(const paragraph of value.replaceAll('\r\n','\n').split('\n')){
   let line=''
   for(const char of paragraph){
    if(line&&font.widthOfTextAtSize(line+char,size)>width){
     const boundary=line.lastIndexOf(' ')
     if(boundary>0){lines.push(line.slice(0,boundary));line=line.slice(boundary+1)+char}
     else{lines.push(line);line=char}
    }else line+=char
   }
   lines.push(line)
  }
  return lines
 }
 const noteLines=wrap(note,8,r.width-4)
 if(noteLines.length*10>r.height-2)throw fail('The source additional-information box cannot retain the amendment pointer legibly.')
 info.enableMultiline();info.setFontSize(8);info.setText(note);info.enableReadOnly();info.updateAppearances(font)
 let page,y
 const next=()=>{page=pdf.addPage([612,792]);y=730;page.drawText('I-9 receipt replacement - continuation',{x:48,y,font,size:14});y-=28;page.drawText(`Retain with the original ${input.sourceKind==='SECTION2'?'Form I-9':'Supplement B'}.`,{x:48,y,font,size:9});y-=26}
 const paragraph=(label,value)=>{for(const line of wrap(`${label}: ${value}`,10,516)){if(!page||y<125)next();page.drawText(line,{x:48,y,font,size:10});y-=14}y-=10}
 paragraph('Source SHA-256',hash(sourceBytes))
 paragraph('Receipt row',input.rowKey)
 paragraph('Previous additional information',oldInformation||'(blank)')
 paragraph('Actual replacement document',input.replacement.title)
 paragraph('Issuing authority',input.replacement.issuingAuthority)
 paragraph('Document number',input.replacement.number||'(none)')
 paragraph('Document expiration',usDate(input.replacement.expiresOn)||'(none)')
 paragraph('Receipt-match explanation',input.explanation)
 paragraph('Amendment initials and date',`${input.initials} ${usDate(input.amendedOn)}`)
 paragraph('Named examiner',input.examinerName)
 if(y<200)next()
 paragraph('Examiner confirmation','I recorded the actual replacement document for the identified receipt. The original certification remains retained; this amendment records the replacement and its examination evidence.')
 if(y<112)next()
 page.drawText('Examiner signature',{x:48,y,font,size:9});page.drawText('Signing date',{x:430,y,font,size:9});y-=28
 for(const [name,x,width] of [[RECEIPT_SIGNATURE_FIELD,48,365],[RECEIPT_DATE_FIELD,430,130]]){const f=form.createTextField(name);f.addToPage(page,{x,y,width,height:22,font,borderWidth:1});f.setFontSize(9);f.updateAppearances(font)}
 for(let index=originalPages;index<pdf.getPageCount();index++)pdf.getPage(index).drawText(`Receipt replacement continuation ${index-originalPages+1} - page ${index+1} of ${pdf.getPageCount()}`,{x:48,y:35,font,size:8})
 pdf.setTitle('I-9 receipt replacement - unsigned amendment')
 const output=Buffer.from(await pdf.save()),saved=await PDFDocument.load(output),result=saved.getForm()
 for(const [name,prior] of before)if(name!==infoName&&result.getField(name).acroField.dict.get(PDFName.of('V'))?.toString()!==prior)throw new Error('Receipt replacement changed an unrelated canonical source field.')
 if(result.getTextField(infoName).getText()!==note)throw new Error('Receipt amendment pointer was not retained.')
 return {pdf:output,pageCount:saved.getPageCount(),sourceSha256:hash(sourceBytes),markedReceiptWords:marked}
}
export async function signI9ReceiptReplacementPdf(preview,{signature,signedOn,pageCount}){
 return signRetainedPayrollForm(preview,{signature,signedOn,pageCount,signatureField:RECEIPT_SIGNATURE_FIELD,dateField:RECEIPT_DATE_FIELD,title:'I-9 receipt replacement - signed amendment'})
}
