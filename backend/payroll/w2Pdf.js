import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {PDFDocument,StandardFonts} from 'pdf-lib'
const source=new URL('./assets/fw2-2026.pdf',import.meta.url),manifestUrl=new URL('./assets/fw2-2026.manifest.json',import.meta.url)
const address=a=>[a.line1,a.line2,`${a.city}, ${a.state} ${a.postalCode}`].filter(Boolean).join('\n')
// Approved forms are rendered as static records; source template remains untouched.
export async function renderW2EmployeePacket(snapshot){
 if(snapshot?.version!==1||snapshot.year!==2026||!snapshot.draft?.boxes||snapshot.draft.status!=='DRAFT_REVIEW_REQUIRED')throw new Error('A supported approved W-2 snapshot is required.')
 const {employer,employee,draft}=snapshot,b=draft.boxes
 if(['box1','box2','box3','box4','box5','box6','box16','box17'].some(key=>!/^\d+\.\d{2}$/.test(b[key]))||!Array.isArray(b.box12)||b.box12.some(item=>!['D','AA','DD','TT'].includes(item.code)||!/^\d+\.\d{2}$/.test(item.amount))||new Set(b.box12.map(item=>item.code)).size!==b.box12.length)throw new Error('Unsupported W-2 amounts or reporting codes.')
 if(b.box12.some(item=>['D','AA'].includes(item.code))&&b.box13?.retirementPlan!==true)throw new Error('Unsupported retirement reporting without active participation.')
 if(!b.box13||Object.keys(b.box13).some(key=>!['statutoryEmployee','retirementPlan','thirdPartySickPay'].includes(key))||typeof b.box13.retirementPlan!=='boolean'||['statutoryEmployee','thirdPartySickPay'].some(key=>b.box13[key]!==false)||['box7','box8','box10','box11','box18','box19','box20'].some(key=>b[key]!=null&&b[key]!=='')||['box14a','box14b'].some(key=>b[key]!=null&&(!Array.isArray(b[key])||b[key].length))||(b.box15&&b.box15.state!=='MD'))throw new Error('Unsupported W-2 classification requires additional form mapping.')
 if(!/^\d{9}$/.test(employer?.identifier)||!/^\d{9}$/.test(employee?.identifier)||!/^\d{8}$/.test(employer?.marylandRegistrationNumber))throw new Error('Complete retained filing identifiers are required.')
 const bytes=await readFile(source),manifest=JSON.parse(await readFile(manifestUrl,'utf8'))
 if(createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw new Error('W-2 template checksum mismatch.')
 const doc=await PDFDocument.load(bytes),form=doc.getForm(),font=await doc.embedFont(StandardFonts.Helvetica)
 if(doc.getPageCount()!==manifest.pageCount)throw new Error('W-2 template pages changed.')
 const values={1:employee.identifier,2:employer.identifier,3:`${employer.legalName}\n${address(employer.address)}`,4:String(snapshot.employeeId),5:[employee.firstName,employee.middleName?.slice(0,1)].filter(Boolean).join(' '),6:employee.lastName,7:employee.suffix||'',8:address(employee.address),9:b.box1,10:b.box2,11:b.box3,12:b.box4,13:b.box5,14:b.box6,15:b.box7||'',16:b.box8||'',18:b.box10||'',19:b.box11||'',31:'MD',32:employer.marylandRegistrationNumber,35:b.box16,37:b.box17}
 for(const [index,item] of b.box12.entries()){if(index>3)throw new Error('Additional reporting code pages are required.');values[20+index*2]=item.code;values[21+index*2]=item.amount}
 for(const page of manifest.employeePacket)for(const descriptor of page.fields){
  const field=form.getField(descriptor.name)
  if(descriptor.type==='/Btn'){if(descriptor.name.includes('.Retirement_ReadOrder[')&&b.box13.retirementPlan)field.check();else field.uncheck();continue}
  const match=descriptor.name.match(/\.f2_(\d+)\[0\]$/);if(!match)throw new Error('Unknown W-2 template field.')
  const raw=Number(match[1]),key=raw>44?raw-44:raw,value=String(values[key]??'')
  const width=descriptor.rect[2]-descriptor.rect[0]-4,height=descriptor.rect[3]-descriptor.rect[1]-3
  if(key===3||key===8)field.enableMultiline()
  let size=9
  while(size>=6&&(value.split('\n').some(line=>font.widthOfTextAtSize(line,size)>width)||value.split('\n').length*size*1.2>height))size-=0.25
  if(size<6)throw new Error(`Filing text exceeds readable W-2 field capacity (${key}).`)
  field.setFontSize(size);field.setText(value)
 }
 form.updateFieldAppearances(font);form.flatten()
 const packet=await PDFDocument.create(),pages=await packet.copyPages(doc,manifest.employeePacket.flatMap(p=>[p.pageIndex,p.instructionsPageIndex]))
 for(const page of pages)packet.addPage(page)
 packet.setTitle('2026 W-2 Employee Copies B, C and 2');packet.setSubject('Retained approved wage and tax statement');packet.setProducer('Vortex Payroll')
 return Buffer.from(await packet.save())
}
