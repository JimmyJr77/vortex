import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {PDFDocument,PDFName,rgb} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {MW507_2026,MW507_FIELDS,mw507FormInput2026} from './mw507Form2026.js'
const fail=message=>Object.assign(new Error(message),{status:400})
const clean=(value,label)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>300||/[\u0000-\u001f\u007f]/.test(value))throw fail(`Use valid ${label}.`);return value.trim().normalize('NFC')}
const dollars=value=>value==null?'':`${Math.floor(value/100)}.${String(value%100).padStart(2,'0')}`
const validDate=value=>typeof value==='string'&&/^2026-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
// The caller must establish identity and intent before supplying a signature.
// Rendering never approves exemption eligibility or activates payroll elections.
export async function renderMw507Pdf2026({answers,signature=null,signedOn=null,employer={}}){
 const input=mw507FormInput2026(answers),template=await readFile(new URL('./forms/maryland-mw507-2026.pdf',import.meta.url))
 if(createHash('sha256').update(template).digest('hex')!==MW507_2026.templateSha256)throw new Error('Review and pin the changed Maryland MW507 template before use.')
 if(signature!==null){signature=clean(signature,'employee signature');if(!validDate(signedOn))throw fail('Use a valid 2026 signing date.')}
 else if(signedOn!==null)throw fail('An unsigned MW507 cannot have a signing date.')
 const pdf=await PDFDocument.load(template),form=pdf.getForm(),page=pdf.getPage(0)
 const bytes=await readFile(new URL('./forms/fonts/NotoSans-Regular.ttf',import.meta.url))
 if(createHash('sha256').update(bytes).digest('hex')!=='b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5')throw new Error('Review the changed payroll form font before use.')
 pdf.registerFontkit(fontkit)
 const font=await pdf.embedFont(bytes,{subset:true}),characters=new Set(font.getCharacterSet()),expected=new Map()
 const fill=(name,value)=>{
  const field=form.getTextField(name),text=String(value),rect=field.acroField.getWidgets()[0].getRectangle()
  if([...text].some(character=>!characters.has(character.codePointAt(0))))throw fail('An MW507 entry needs additional font support to preserve its exact characters.')
  const width=font.widthOfTextAtSize(text,9),size=Math.min(9,Math.max(6,rect.height-2),width?9*(rect.width-4)/width:9)
  if(size<6)throw fail('An MW507 entry is too long to print legibly. Review it before signing.')
  field.setFontSize(size);field.setText(text);expected.set(name,text)
 }
 for(const [key,value] of Object.entries(input.personal))fill(MW507_FIELDS[key],value)
 fill(MW507_FIELDS.exemptions,input.exemptions??'');fill(MW507_FIELDS.additionalWithholdingCents,dollars(input.additionalWithholdingCents))
 // The official template uses one checkbox field with three distinct export
 // values. PDFCheckBox.check() selects only the first widget, so set the shared
 // canonical value and each widget state explicitly, retaining the original tree.
 const select=(name,value)=>{
  const field=form.getCheckBox(name),widgets=field.acroField.getWidgets()
  if(value!==null&&!widgets.some(widget=>widget.getOnValue()?.decodeText()===value))throw new Error('The MW507 checkbox choices changed.')
  field.acroField.dict.set(PDFName.of('V'),PDFName.of(value??'Off'))
  for(const widget of widgets)widget.setAppearanceState(PDFName.of(widget.getOnValue()?.decodeText()===value?value:'Off'))
  field.updateAppearances()
 }
 select(MW507_FIELDS.withholdingRate,{SINGLE:'Single',MARRIED:'Married Rate',MARRIED_SINGLE:'Married, but withhold at Single rate'}[input.withholdingRate]??null)
 const claim=input.claim,noTax=claim.kind==='NO_LIABILITY',pa=claim.kind==='PENNSYLVANIA',localPa=pa&&claim.localExemption!=='NONE'
 select(MW507_FIELDS.domicile,claim.kind==='RECIPROCAL'?{DC:'District of Columbia',VA:'Virginia',WV:'West Virginia'}[claim.state]:null)
 for(const key of ['priorYearNoTax','currentYearNoTax']){const field=form.getCheckBox(MW507_FIELDS[key]);if(noTax)field.check();else field.uncheck();field.updateAppearances()}
 fill(MW507_FIELDS.effectiveYear,noTax?'2026':'')
 for(const [line,checked] of Object.entries({line3:noTax,line4:claim.kind==='RECIPROCAL'||localPa,line5:pa,line6:pa&&claim.localExemption==='YORK_ADAMS',line7:pa&&claim.localExemption==='NO_LOCAL_TAX',line8:claim.kind==='MILITARY_SPOUSE'}))fill(MW507_FIELDS[line],checked?'EXEMPT':'')
 fill(MW507_FIELDS.militaryState,claim.kind==='MILITARY_SPOUSE'?claim.state:'')
 if(input.worksheet)for(const [key,value] of Object.entries(input.worksheet.lines))fill(MW507_FIELDS[key],key==='f'?value:dollars(value))
 const signatureField=form.createTextField('vortex.mw507.employeeSignature')
 signatureField.addToPage(page,{x:40.32,y:57.17,width:330,height:11.88,borderWidth:0,textColor:rgb(0,0,0),backgroundColor:undefined})
 fill('vortex.mw507.employeeSignature',signature||'');fill(MW507_FIELDS.signedOn,signature?signedOn:'')
 if(employer.nameAddress)fill(MW507_FIELDS.employerNameAddress,clean(employer.nameAddress,'employer name and address'))
 if(employer.ein){if(!/^\d{2}-\d{7}$/.test(employer.ein))throw fail('Use a valid-format employer EIN.');fill(MW507_FIELDS.employerEin,employer.ein)}
 page.drawText(signature?'Electronically signed; retained submission identifies the signer and exact submitted certificate.':'UNSIGNED PREVIEW - Review both pages and every entry before signing.',{x:40,y:767,size:7,font,color:signature?rgb(0,0,0):rgb(0.6,0,0)})
 for(const field of form.getFields()){
  field.enableReadOnly();field.acroField.dict.delete(PDFName.of('AA'))
  for(const widget of field.acroField.getWidgets())widget.dict.delete(PDFName.of('AA'))
 }
 form.updateFieldAppearances(font)
 pdf.setTitle(signature?'2026 Maryland MW507 - electronically signed':'2026 Maryland MW507 - unsigned preview');pdf.setProducer('Vortex payroll')
 const output=Buffer.from(await pdf.save()),saved=await PDFDocument.load(output)
 if(saved.getPageCount()!==2)throw new Error('MW507 instructions and worksheet were not retained.')
 for(const [name,value] of expected)if((saved.getForm().getTextField(name).getText()??'')!==value)throw new Error('MW507 canonical fields did not preserve the submitted entries.')
 return output
}
