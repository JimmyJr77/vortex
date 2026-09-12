import {federalRemittanceBankFields} from './federalRemittanceBankFields.js'
import {createHash,randomUUID} from 'node:crypto'
import {federalTaxCalendar} from './federalTaxCalendar.js'
import {nextFederalTaxBusinessDay} from './federalTaxDates.js'
import {taxRows,summarizeTaxRows} from './taxReconciliation.js'
import {readFilingIdentity} from './filingIdentity.js'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {federalRemittanceInstruction} from './federalRemittanceInstruction.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const day=v=>v instanceof Date?v.toISOString().slice(0,10):String(v||'').slice(0,10)
const validDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
async function source(db,facility,year){
 if(year!==2026)throw fail('Federal remittance instructions are verified for 2026. Select that tax year.')
 const rows=await taxRows(db,facility,year),totals=summarizeTaxRows(rows,`${year}-01-01`,`${year}-12-31`),calendar=await federalTaxCalendar(db,facility,year)
 const identity=(await db.query("SELECT id,identifier_last4 FROM payroll_filing_identity WHERE facility_id=$1 AND subject_key='EMPLOYER' ORDER BY id DESC LIMIT 1",[facility])).rows[0]
 const deposits=(await db.query('SELECT id,agency,tax_quarter,paid_on,amount_cents,status FROM payroll_tax_deposit WHERE facility_id=$1 AND tax_year=$2 ORDER BY id',[facility,year])).rows
 const obligations=[...calendar.obligations.map(o=>({...o,agency:'IRS_941',reliable:calendar.reliable,issues:calendar.issues})),...calendar.futa.obligations.map(o=>({...o,key:`${year}:FUTA:Q${o.quarter}:${o.fromQuarter}:${o.dueOn}`,lastPayDate:rows.filter(r=>Math.ceil(Number(day(r.payment_date).slice(5,7))/3)<=o.quarter&&Number(r.futa)>0).map(r=>day(r.payment_date)).sort().at(-1),agency:'IRS_FUTA',reliable:calendar.futa.reliable,issues:calendar.futa.issues}))]
 return {year,calendar,identity,deposits,totals,obligations}
}
async function preview(db,facility,input,loadedSource){
 const year=Number(input.year),s=loadedSource||await source(db,facility,year),o=s.obligations.find(o=>o.agency===input.agency&&o.key===input.obligationKey)
 if(!o)throw fail('Refresh the federal deposit obligations before reviewing remittance.',409)
 const issues=[...o.issues],settlementDate=input.settlementDate
 if(!s.identity)issues.push('Retain the employer filing identity and EIN in Employer setup.')
 if(!validDay(settlementDate))issues.push('Choose a valid planned bank settlement date.')
 else if(settlementDate<nextFederalTaxBusinessDay(s.calendar.today)||nextFederalTaxBusinessDay(settlementDate,true)!==settlementDate||settlementDate<day(o.lastPayDate||`${year}-01-01`))issues.push('Choose a future federal banking day on or after the covered payroll dates.')
 if(!Number.isSafeInteger(o.balanceCents)||o.balanceCents<=0||o.balanceCents>9999999999)issues.push('This obligation has no supported positive outstanding balance.')
 const basis={year,agency:o.agency,key:o.key,quarter:o.quarter,dueOn:o.dueOn,liabilityCents:o.liabilityCents,amountCents:o.balanceCents,settlementDate,identityRevision:s.identity?.id||null,calendar:s.calendar.config,payroll:s.totals.payroll,deposits:s.deposits}
 const fingerprint=hash(basis)
 let instruction=null
 if(!issues.length){const identity=await readFilingIdentity(db,facility,s.identity.id);instruction=federalRemittanceInstruction({agency:o.agency,year,quarter:o.quarter,ein:identity.identifier,amountCents:o.balanceCents,settlementDate})}
 return {basis,instruction,data:{status:issues.length?'BLOCKED':'READY_FOR_REVIEW',issues,fingerprint,agency:o.agency,obligationKey:o.key,quarter:o.quarter,dueOn:o.dueOn,amountCents:o.balanceCents,settlementDate,late:validDay(settlementDate)&&settlementDate>o.dueOn,identifierLast4:s.identity?.identifier_last4||null,taxCode:instruction?.taxCode||null,taxPeriodEnd:instruction?.periodEnd||null,executionStatus:'NOT_CONNECTED'}}
}
export function registerFederalRemittanceReviewRoutes(app,pool){
 const read=work=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const data=await work(db,req);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to review federal remittance.'})}finally{db.release()}}
 app.get('/api/admin/payroll/federal-remittance-review',read(async(db,req)=>{
  const s=await source(db,req.canonicalAccess.facilityId,Number(req.query.year)),records=(await db.query('SELECT id,agency,tax_year,tax_quarter,obligation_key,settlement_date,amount_cents,source_fingerprint,reference,created_at FROM payroll_federal_remittance_review WHERE facility_id=$1 AND tax_year=$2 ORDER BY created_at DESC,id DESC',[req.canonicalAccess.facilityId,s.year])).rows
  const history=[];for(const row of records){let current=false;try{const p=await preview(db,req.canonicalAccess.facilityId,{year:s.year,agency:row.agency,obligationKey:row.obligation_key,settlementDate:day(row.settlement_date)},s);current=p.data.status==='READY_FOR_REVIEW'&&p.data.fingerprint===row.source_fingerprint}catch(e){if(e.status!==409)throw e}history.push({...row,current})}
  return {year:s.year,today:s.calendar.today,earliestSettlementDate:nextFederalTaxBusinessDay(s.calendar.today),issues:[...new Set([...s.calendar.issues,...s.calendar.futa.issues])],obligations:s.obligations.filter(o=>o.balanceCents>0).map(o=>({agency:o.agency,key:o.key,quarter:o.quarter,dueOn:o.dueOn,amountCents:o.balanceCents,reliable:o.reliable})),history}
 }))
 app.get('/api/admin/payroll/federal-remittance-preview',read(async(db,req)=>(await preview(db,req.canonicalAccess.facilityId,req.query)).data))
 app.post('/api/admin/payroll/federal-remittance-reviews/:id/bank-fields',read(async(db,req)=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id))throw fail('Choose a retained remittance review.')
  const row=(await db.query('SELECT * FROM payroll_federal_remittance_review WHERE facility_id=$1 AND id=$2',[req.canonicalAccess.facilityId,req.params.id])).rows[0]
  if(!row)throw fail('Remittance review was not found.',404)
  const current=await preview(db,req.canonicalAccess.facilityId,{year:row.tax_year,agency:row.agency,obligationKey:row.obligation_key,settlementDate:day(row.settlement_date)})
  if(current.data.status!=='READY_FOR_REVIEW'||current.data.fingerprint!==row.source_fingerprint)throw fail('Retain a refreshed remittance review before comparing bank fields.',409)
  const instruction=JSON.parse(decryptDocument(row.encrypted_instruction,`payroll-federal-remittance-review:${req.canonicalAccess.facilityId}:${row.id}`).toString())
  return federalRemittanceBankFields(req.body?.file,instruction)
 }))
 app.post('/api/admin/payroll/federal-remittance-reviews',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId]);const b=req.body||{}
   if(b.confirmed!==true||typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm the federal tax amount, tax period, settlement date and review reference.')
   const p=await preview(db,req.canonicalAccess.facilityId,b);if(p.data.status!=='READY_FOR_REVIEW'||b.fingerprint!==p.data.fingerprint)throw fail('Federal remittance facts changed or need attention. Refresh the preview.',409)
   const old=(await db.query('SELECT id,reference FROM payroll_federal_remittance_review WHERE facility_id=$1 AND source_fingerprint=$2',[req.canonicalAccess.facilityId,p.data.fingerprint])).rows[0]
   if(old){if(old.reference!==b.reference.trim())throw fail('This remittance review is already retained with another reference.',409);await db.query('COMMIT');return res.json({success:true,data:{id:old.id,reused:true}})}
   const id=randomUUID(),encrypted=encryptDocument(Buffer.from(JSON.stringify(p.instruction)),`payroll-federal-remittance-review:${req.canonicalAccess.facilityId}:${id}`)
   await db.query('INSERT INTO payroll_federal_remittance_review(id,facility_id,agency,tax_year,tax_quarter,obligation_key,settlement_date,amount_cents,identity_id,source_fingerprint,source_snapshot,encrypted_instruction,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[id,req.canonicalAccess.facilityId,p.data.agency,Number(b.year),p.data.quarter,p.data.obligationKey,b.settlementDate,p.data.amountCents,p.basis.identityRevision,p.data.fingerprint,p.basis,encrypted,b.reference.trim(),req.adminId])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'FEDERAL_REMITTANCE_REVIEWED','federal_remittance_review',$3,$4)",[req.canonicalAccess.facilityId,req.adminId,id,{agency:p.data.agency,year:Number(b.year),quarter:p.data.quarter,amountCents:p.data.amountCents}]);await db.query('COMMIT');res.status(201).json({success:true,data:{id,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain federal remittance review.'})}finally{db.release()}
 })
}
