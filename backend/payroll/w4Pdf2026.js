import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {PDFDocument,PDFDict,PDFName,StandardFonts,rgb} from 'pdf-lib'
import {W4_2026,W4_2026_FIELDS,w4FormInput2026} from './w4Form2026.js'
const fail=message=>Object.assign(new Error(message),{status:400})
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const clean=(value,label,max=200)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u001f\u007f]/.test(value))throw fail(`Use valid ${label}.`);return value.trim().normalize('NFC')}
const dollars=value=>value==null?'':`${Math.floor(value/100)}.${String(value%100).padStart(2,'0')}`
// Only callers that verify the signing intent/session may supply a signature.
// This pure renderer does not establish authentication or activate tax elections.
export async function renderW4Pdf2026({answers,signature=null,signedOn=null,employer={}}){
 const input=w4FormInput2026(answers),template=await readFile(new URL('./forms/irs-w4-2026.pdf',import.meta.url))
 if(createHash('sha256').update(template).digest('hex')!==W4_2026.templateSha256)throw Object.assign(new Error('The W-4 template changed. Review and pin its new version before rendering.'),{status:409})
 if(signature!==null){signature=clean(signature,'employee signature');if(!validDate(signedOn)||!signedOn.startsWith('2026-'))throw fail('Use a valid 2026 signing date.')}
 else if(signedOn!==null)throw fail('An unsigned preview cannot have a signing date.')
 const pdf=await PDFDocument.load(template)
 // Remove the alternative XFA representation so it cannot retain blank/stale
 // answers independently of the canonical AcroForm fields updated below.
 pdf.catalog.lookup(PDFName.of('AcroForm'),PDFDict).delete(PDFName.of('XFA'))
 const form=pdf.getForm(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.getPage(0)
 const fill=(name,value)=>{
  const field=form.getTextField(name),text=String(value)
  const rect=field.acroField.getWidgets()[0].getRectangle()
  let width
  try{width=font.widthOfTextAtSize(text,10)}catch{throw fail('This form contains characters that need an embedded Unicode font before PDF rendering.')}
  const size=width?Math.min(10,10*(rect.width-5)/width):10
  if(size<6)throw fail('An entry is too long to print legibly in its W-4 field. Review the entry before signing.')
  field.setFontSize(size);field.setText(text)
 }
 for(const [key,value] of Object.entries(input.personal))fill(W4_2026_FIELDS[key],key==='ssn'?value.replace(/^(\d{3})(\d{2})(\d{4})$/,'$1-$2-$3'):value)
 for(const key of ['qualifyingChildrenCents','otherDependentsCents','creditsCents','otherIncomeCents','deductionsCents','extraWithholdingCents'])fill(W4_2026_FIELDS[key],dollars(input[key]))
 for(const key of ['SINGLE','MARRIED','HEAD_OF_HOUSEHOLD','twoJobs','exempt']){
  const checked=['twoJobs','exempt'].includes(key)?input[key]:input.filingStatus===key
  const field=form.getCheckBox(W4_2026_FIELDS[key]);if(checked)field.check();else field.uncheck();field.updateAppearances()
 }
 // These new canonical fields occupy the paper form's blank signing lines and
 // the free line below Step 4(c); no required printed instruction is replaced.
 const add=(name,text,rect)=>{const field=form.createTextField(name);field.addToPage(page,{...rect,borderWidth:0,textColor:rgb(0,0,0),backgroundColor:undefined});fill(name,text)}
 add('vortex.w4.nonresidentAlien',input.nonresidentAlien?'Nonresident Alien':'',{x:98,y:153,width:375,height:14})
 add('vortex.w4.employeeSignature',signature||'',{x:100,y:92,width:340,height:19})
 add('vortex.w4.signedOn',signature?signedOn:'',{x:462,y:92,width:110,height:19})
 if(employer.nameAddress)fill(W4_2026_FIELDS.employerNameAddress,clean(employer.nameAddress,'employer name and address',300))
 if(employer.firstEmploymentDate){if(!validDate(employer.firstEmploymentDate))throw fail('Use a valid first employment date.');fill(W4_2026_FIELDS.firstEmploymentDate,employer.firstEmploymentDate)}
 if(employer.ein){if(!/^\d{2}-\d{7}$/.test(employer.ein))throw fail('Use a valid-format employer EIN.');fill(W4_2026_FIELDS.employerEin,employer.ein)}
 if(signature)page.drawText('Electronically signed; retained submission record identifies the signer and exact submitted form.',{x:36,y:773,size:7,font,color:rgb(0,0,0)})
 else page.drawText('UNSIGNED PREVIEW - Review all entries before signing',{x:36,y:773,size:9,font,color:rgb(0.6,0,0)})
 for(const field of form.getFields())field.enableReadOnly()
 form.updateFieldAppearances(font)
 pdf.setTitle(signature?'2026 Form W-4 - electronically signed':'2026 Form W-4 - unsigned preview');pdf.setSubject('Employee withholding certificate');pdf.setProducer('Vortex payroll')
 const bytes=Buffer.from(await pdf.save())
 // Reopen before returning so stale or missing canonical field data is fatal.
 const saved=await PDFDocument.load(bytes),savedForm=saved.getForm()
 if(saved.getPageCount()!==5||(savedForm.getTextField('vortex.w4.employeeSignature').getText()??'')!==(signature||''))throw new Error('W-4 PDF did not preserve its complete signed form.')
 return bytes
}
