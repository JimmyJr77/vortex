import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {PDFDocument,PDFName} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {i9SupplementBInput} from './i9SupplementB.js'
import {signRetainedPayrollForm} from './i9SignaturePdf.js'
const fail=message=>Object.assign(new Error(message),{status:400})
const value=field=>field.acroField.dict.get(PDFName.of('V'))?.toString()
const usDate=date=>date?`${date.slice(5,7)}/${date.slice(8,10)}/${date.slice(0,4)}`:''

// Each event gets a fresh official supplement retained alongside the original.
// Never overwrite a prior certification, even after all three printed rows fill.
export async function renderI9SupplementBPreview(employerSignedPdf,answers){
 const input=i9SupplementBInput(answers),source=await PDFDocument.load(employerSignedPdf),original=source.getForm()
 if(source.getPageCount()!==4||!original.getTextField('Signature of Employee').getText()||!original.getTextField('Signature of Employer or AR').getText()||!original.getTextField("Today's Date mmddyyy").getText()||!original.getTextField('S2 Todays Date mmddyyyy').getText())throw fail('Use the retained employee- and employer-signed I-9.')
 const template=await readFile(new URL('./forms/uscis-i9-012025.pdf',import.meta.url))
 if(createHash('sha256').update(template).digest('hex')!=='780f348c34df694bb0b4dbbfaf9f22b99b9757b80d16a37ba89aadf069597281')throw new Error('Review the changed I-9 Supplement B template.')
 const pdf=await PDFDocument.load(template),form=pdf.getForm(),supplement=pdf.getPage(3)
 for(const field of [...form.getFields()]){
  const widgets=field.acroField.getWidgets(),keep=widgets.map(w=>w.dict.get(PDFName.of('P'))?.toString()===supplement.ref.toString())
  if(!keep.some(Boolean)){
   // Discard the field tree entry directly: blank USCIS checkboxes have no
   // selected appearance, so pdf-lib's appearance-dependent removal fails.
   form.acroForm.removeField(field.acroField);continue
  }
  // USCIS binds the second Supplement B title to a Section 2 widget too.
  // Remove the discarded page widget while preserving the canonical field.
  if(keep.some(v=>!v)){
   if(field.getName()!=='Document Title 1'||widgets.length!==2)throw new Error('Review the changed shared Supplement B field binding.')
   for(let index=keep.length-1;index>=0;index--)if(!keep[index]){
    const ref=field.acroField.Kids().get(index)
    for(const page of pdf.getPages())page.node.removeAnnot(ref)
    field.acroField.removeWidget(index)
   }
  }
 }
 for(let index=2;index>=0;index--)pdf.removePage(index)
 const before=new Map(form.getFields().map(f=>[f.getName(),value(f)]))
 const fontBytes=await readFile(new URL('./forms/fonts/NotoSans-Regular.ttf',import.meta.url))
 if(createHash('sha256').update(fontBytes).digest('hex')!=='b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5')throw new Error('Review the changed payroll form font.')
 pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fontBytes,{subset:true}),chars=new Set(font.getCharacterSet()),expected=new Map()
 const fill=(name,text)=>{
  const field=form.getTextField(name),rect=field.acroField.getWidgets()[0].getRectangle()
  if([...text].some(c=>!chars.has(c.codePointAt(0))))throw fail('A Supplement B entry needs additional font support.')
  const size=Math.min(9,rect.height-2,text?9*(rect.width-4)/font.widthOfTextAtSize(text,9):9)
  // The two-line notation box must remain readable; never silently truncate.
  if(name==='Addtl Info 0'){
   let line='',lines=1
   for(const word of text.split(' ')){
    if(font.widthOfTextAtSize(word,8)>rect.width-4)throw fail('A Supplement B notation word is too long to print legibly.')
    const next=line?`${line} ${word}`:word
    if(font.widthOfTextAtSize(next,8)>rect.width-4){lines++;line=word}else line=next
   }
   if(lines*10>rect.height-2)throw fail('The Supplement B notation needs a continuation sheet to remain legible.')
   field.enableMultiline();field.setFontSize(8)
  }else{if(size<6)throw fail('A Supplement B entry is too long to print legibly.');field.setFontSize(size)}
  field.setText(text);field.enableReadOnly();field.updateAppearances(font);expected.set(name,text)
 }
 for(const [dest,src] of [['Last Name Family Name from Section 1-2','Last Name (Family Name)'],['First Name Given Name from Section 1-2','First Name Given Name'],['Middle initial if any from Section 1-2','Employee Middle Initial (if any)']])fill(dest,original.getTextField(src).getText()||'')
 for(const [name,text] of [['Document Title 0',input.document.title],['Document Number 0',input.document.number],['Expiration Date 0',usDate(input.document.expiresOn)],['Name of Emp or Auth Rep 0',input.representativeName],['Last Name 0',input.newName.lastName],['First Name 0',input.newName.firstName],['Middle Initial 0',input.newName.middleInitial],['Addtl Info 0',input.additionalInformation]])fill(name,text)
 const alternative=form.getCheckBox('CB_Alt_0');if(input.examinationMethod==='ALTERNATIVE')alternative.check();else alternative.uncheck();alternative.enableReadOnly();alternative.updateAppearances()
 pdf.setTitle('I-9 Supplement B - unsigned reverification preview')
 const output=Buffer.from(await pdf.save()),saved=await PDFDocument.load(output),result=saved.getForm()
 if(saved.getPageCount()!==1)throw new Error('Supplement B must retain exactly one official page.')
 for(const field of result.getFields())for(const widget of field.acroField.getWidgets())if(widget.dict.get(PDFName.of('P'))?.toString()!==saved.getPage(0).ref.toString())throw new Error('Supplement B retained a widget from a discarded page.')
 for(const [name,prior] of before)if(!expected.has(name)&&name!=='CB_Alt_0'&&value(result.getField(name))!==prior)throw new Error('Supplement B changed a field outside the current reverification row.')
 for(const [name,text] of expected)if((result.getTextField(name).getText()||'')!==text)throw new Error('Supplement B lost a canonical form value.')
 return output
}
export function signI9SupplementBPdf(preview,{signature,signedOn}){
 return signRetainedPayrollForm(preview,{signature,signedOn,signatureField:'Signature of Emp Rep 0',dateField:'Todays Date 0',pageCount:1,title:'I-9 Supplement B - signed reverification'})
}
