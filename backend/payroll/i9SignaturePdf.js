import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {PDFDocument,PDFName} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
const fail=message=>Object.assign(new Error(message),{status:400})
// Sign the retained reviewed bytes, preserving every other canonical field.
export function signI9Section1Pdf(preview,values){return signRetainedPayrollForm(preview,{...values,signatureField:'Signature of Employee',dateField:"Today's Date mmddyyy",pageCount:4,title:'I-9 Section 1 - employee signed'})}
export async function signRetainedPayrollForm(preview,{signature,signedOn,signatureField,dateField,pageCount,title}){
 if(typeof signature!=='string'||!signature.trim()||signature.length>200||/[\u0000-\u001f\u007f]/.test(signature))throw fail('Enter your name as your electronic signature.')
 if(!/^\d{4}-\d{2}-\d{2}$/.test(signedOn)||!Number.isFinite(Date.parse(signedOn))||new Date(signedOn).toISOString().slice(0,10)!==signedOn)throw fail('A valid signing date is required.')
 const pdf=await PDFDocument.load(preview),form=pdf.getForm(),names=[signatureField,dateField]
 if(pdf.getPageCount()!==pageCount)throw fail('Review the complete form before signing.')
 for(const name of names)if(form.getTextField(name).getText())throw fail('This I-9 preview already contains a signature or signing date.')
 const before=new Map(form.getFields().filter(f=>!names.includes(f.getName())).map(f=>[f.getName(),f.acroField.dict.get(PDFName.of('V'))?.toString()]))
 const bytes=await readFile(new URL('./forms/fonts/NotoSans-Regular.ttf',import.meta.url))
 if(createHash('sha256').update(bytes).digest('hex')!=='b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5')throw new Error('Review the changed signature font.')
 pdf.registerFontkit(fontkit);const font=await pdf.embedFont(bytes,{subset:true}),chars=new Set(font.getCharacterSet()),normalized=signature.trim().normalize('NFC')
 const values=[normalized,`${signedOn.slice(5,7)}/${signedOn.slice(8,10)}/${signedOn.slice(0,4)}`]
 for(const [index,name] of names.entries()){
  const field=form.getTextField(name),text=values[index],rect=field.acroField.getWidgets()[0].getRectangle()
  if([...text].some(c=>!chars.has(c.codePointAt(0))))throw fail('Your signature needs additional font support to preserve its exact characters.')
  const width=font.widthOfTextAtSize(text,9),size=Math.min(9,rect.height-2,width?9*(rect.width-4)/width:9)
  if(size<6)throw fail('Your signature is too long to print legibly.')
  field.setFontSize(size);field.setText(text);field.enableReadOnly();field.updateAppearances(font)
 }
 pdf.setTitle(title)
 const output=Buffer.from(await pdf.save()),verified=await PDFDocument.load(output),saved=verified.getForm()
 for(const [name,value] of before)if(saved.getField(name).acroField.dict.get(PDFName.of('V'))?.toString()!==value)throw new Error('Signing changed an I-9 entry outside the employee signature fields.')
 for(const [index,name] of names.entries())if(saved.getTextField(name).getText()!==values[index])throw new Error('I-9 signature fields failed verification.')
 if(verified.getPageCount()!==pageCount)throw new Error('I-9 signing lost a supplement page.')
 return output
}
