import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {PDFDocument,PDFName} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {i9Section2Input} from './i9Section2.js'
export const I9_SECTION2_TITLE_FIELD='vortex.i9.section2.listA.documentTitle1'
const listA=[
 [I9_SECTION2_TITLE_FIELD,'Issuing Authority 1','Document Number 0 (if any)','Expiration Date if any'],
 ['Document Title 2 If any','Issuing Authority_2','Document Number If any_2','List A.  Document 2. Expiration Date (if any)'],
 ['List A.   Document Title 3.  If any','List A. Document 3.  Enter Issuing Authority','List A.  Document 3 Number.  If any','Document Number if any_3'],
]
const listB=['List B Document 1 Title','List B Issuing Authority 1','List B Document Number 1','List B Expiration Date 1']
const listC=['List C Document Title 1','List C Issuing Authority 1','List C Document Number 1','List C Expiration Date 1']
const employerFields=['Additional Information','FirstDayEmployed mmddyyyy','Last Name First Name and Title of Employer or Authorized Representative','Employers Business or Org Name','Employers Business or Org Address']
const signatureFields=['Signature of Employer or AR','S2 Todays Date mmddyyyy']
const changed=new Set([...listA.flat(),...listB,...listC,...employerFields,'CB_Alt'])
const value=field=>field.acroField.dict.get(PDFName.of('V'))?.toString()
const usDate=date=>date?`${date.slice(5,7)}/${date.slice(8,10)}/${date.slice(0,4)}`:''
const fail=message=>Object.assign(new Error(message),{status:400})

// Compose on the retained employee-signed form. This does not sign for the
// employer or establish that a physical/alternative examination occurred.
export async function renderI9Section2Preview(employeeSignedPdf,answers){
 const input=i9Section2Input(answers),pdf=await PDFDocument.load(employeeSignedPdf),form=pdf.getForm()
 if(pdf.getPageCount()!==4)throw fail('Use the complete retained employee I-9.')
 if(!form.getTextField('Signature of Employee').getText()||!form.getTextField("Today's Date mmddyyy").getText())throw fail('The employee must sign Section 1 first.')
 for(const name of signatureFields)if(form.getTextField(name).getText())throw fail('A signed employer form requires the correction workflow.')
 // A fresh preview always begins with the immutable Section 1 source, never a
 // partially populated Section 2 or a prior employer certification.
 for(const name of changed){
  if(name===I9_SECTION2_TITLE_FIELD)continue
  if(name==='CB_Alt'){if(form.getCheckBox(name).isChecked())throw fail('Use the original employee-signed source.');continue}
  if(form.getTextField(name).getText())throw fail('Use the original employee-signed source.')
 }
 const before=new Map(form.getFields().filter(f=>!changed.has(f.getName())).map(f=>[f.getName(),value(f)]))
 const shared=form.getTextField('Document Title 1'),widgets=shared.acroField.getWidgets(),kids=shared.acroField.Kids()
 const page1=pdf.getPage(0),page4=pdf.getPage(3)
 if(form.getFields().some(f=>f.getName()===I9_SECTION2_TITLE_FIELD)||widgets.length!==2||!kids||shared.getText())throw new Error('Review the changed I-9 document-title binding.')
 const target=widgets.findIndex(w=>w.dict.get(PDFName.of('P'))?.toString()===page1.ref.toString())
 const other=widgets.findIndex(w=>w.dict.get(PDFName.of('P'))?.toString()===page4.ref.toString())
 if(target<0||other<0||target===other)throw new Error('Review the I-9 title widget pages.')
 const rect=widgets[target].getRectangle(),widgetRef=kids.get(target)
 if(Math.abs(rect.x-126.84)>0.1||Math.abs(rect.y-342.24)>0.1)throw new Error('Review the I-9 Section 2 title position.')
 page1.node.removeAnnot(widgetRef);shared.acroField.removeWidget(target)
 const bytes=await readFile(new URL('./forms/fonts/NotoSans-Regular.ttf',import.meta.url))
 if(createHash('sha256').update(bytes).digest('hex')!=='b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5')throw new Error('Review the changed payroll form font.')
 pdf.registerFontkit(fontkit);const font=await pdf.embedFont(bytes,{subset:true}),characters=new Set(font.getCharacterSet())
 const independent=form.createTextField(I9_SECTION2_TITLE_FIELD)
 independent.addToPage(page1,{...rect,borderWidth:0,font})
 const expected=new Map()
 const fill=(name,text)=>{
  const field=form.getTextField(name),r=field.acroField.getWidgets()[0].getRectangle()
  if([...text].some(c=>!characters.has(c.codePointAt(0))))throw fail('An employer entry needs additional font support to preserve its exact characters.')
  const size=Math.min(9,r.height-2,text?9*(r.width-4)/font.widthOfTextAtSize(text,9):9)
  // Additional information is wrapped separately; other form entries must fit
  // on a single line without hiding characters or shrinking below six points.
  if(name==='Additional Information'){
   field.enableMultiline();field.setFontSize(9)
   const words=text.split(' ');let lines=1,line=''
   for(const word of words){if(font.widthOfTextAtSize(word,9)>r.width-4)throw fail('Additional information contains a word too long to print legibly.');const next=line?`${line} ${word}`:word;if(font.widthOfTextAtSize(next,9)>r.width-4){lines++;line=word}else line=next}
   if(lines*12>r.height-6)throw fail('Additional information needs a continuation sheet to remain legible.')
  }else{if(size<6)throw fail('An employer entry is too long to print legibly.');field.setFontSize(size)}
  field.setText(text);field.enableReadOnly();field.updateAppearances(font);expected.set(name,text)
 }
 const document=(names,row)=>{for(const [index,key] of ['title','issuingAuthority','number','expiresOn'].entries())fill(names[index],key==='expiresOn'?usDate(row?.[key]):row?.[key]||'')}
 listA.forEach((names,index)=>document(names,input.listA[index]));document(listB,input.listB);document(listC,input.listC)
 const values=[input.additionalInformation,usDate(input.firstDayEmployed),input.representativeNameAndTitle,input.businessName,input.businessAddress]
 employerFields.forEach((name,index)=>fill(name,values[index]))
 const alternative=form.getCheckBox('CB_Alt');if(input.examinationMethod==='ALTERNATIVE')alternative.check();else alternative.uncheck();alternative.updateAppearances()
 pdf.setTitle('I-9 Section 2 - unsigned employer preview')
 const output=Buffer.from(await pdf.save()),saved=await PDFDocument.load(output),result=saved.getForm()
 if(saved.getPageCount()!==4)throw new Error('Employer preview lost an I-9 page.')
 for(const [name,prior] of before)if(value(result.getField(name))!==prior)throw new Error('Employer preview changed a retained employee or supplement field.')
 for(const [name,text] of expected)if((result.getTextField(name).getText()||'')!==text)throw new Error('Employer preview did not retain a canonical entry.')
 if(result.getCheckBox('CB_Alt').isChecked()!==(input.examinationMethod==='ALTERNATIVE'))throw new Error('Employer preview lost the examination method.')
 const remaining=result.getTextField('Document Title 1').acroField.getWidgets()
 if(remaining.length!==1||remaining[0].dict.get(PDFName.of('P'))?.toString()!==saved.getPage(3).ref.toString())throw new Error('Supplement B title isolation failed.')
 return output
}
