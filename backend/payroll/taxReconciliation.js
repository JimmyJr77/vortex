const agencies=['IRS_941','IRS_FUTA','MD_WITHHOLDING','MD_UI']
const formAgency={IRS_941:'IRS_941',IRS_940:'IRS_FUTA',MD_MW506:'MD_WITHHOLDING',MD_MW506M:'MD_WITHHOLDING',MD_MW508:'MD_WITHHOLDING',MD_UI:'MD_UI',W2_W3:'EMPLOYEE_FEDERAL'}
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value||'').slice(0,10)
const validDay=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const cents=value=>Number.isSafeInteger(value)&&value>=0
export function summarizeTaxRows(rows,start,end) {
 const fields=['gross','federal_income','social_security','medicare','additional_medicare','futa','maryland','md_ui']
 for(const row of rows)if(fields.some(key=>!(typeof row[key]==='number'||typeof row[key]==='string'&&/^\d+$/.test(row[key]))||!Number.isSafeInteger(Number(row[key]))||Number(row[key])<0))throw fail('Finalized payroll tax amounts are incomplete or invalid. Reconcile the payroll records before reviewing or recording tax filings.',409)
 const eligible=rows.filter(row=>day(row.payment_date)>=start&&day(row.payment_date)<=end)
 const total={grossCents:0,EMPLOYEE_FEDERAL:0,IRS_941:0,IRS_FUTA:0,MD_WITHHOLDING:0,MD_UI:0,employeeCount:new Set(eligible.map(r=>Number(r.employee_id))).size,payroll:[]}
 for(const row of eligible){
  const gross=Number(row.gross),federal=Number(row.federal_income)+2*Number(row.social_security)+2*Number(row.medicare)+Number(row.additional_medicare)
  total.EMPLOYEE_FEDERAL+=Number(row.federal_income)+Number(row.social_security)+Number(row.medicare)+Number(row.additional_medicare);total.grossCents+=gross;total.IRS_941+=federal;total.IRS_FUTA+=Number(row.futa);total.MD_WITHHOLDING+=Number(row.maryland);total.MD_UI+=Number(row.md_ui)
  total.payroll.push([Number(row.run_id),Number(row.employee_id),day(row.payment_date),gross,federal,Number(row.futa),Number(row.maryland),Number(row.md_ui)])
 }
 if(['grossCents','EMPLOYEE_FEDERAL','IRS_941','IRS_FUTA','MD_WITHHOLDING','MD_UI'].some(key=>!Number.isSafeInteger(total[key])))throw fail('Tax reconciliation totals exceed supported precision. Review the payroll records.',409)
 total.payroll.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);return total
}
export async function taxRows(db,facility,year) {
 return (await db.query(`SELECT r.id AS run_id,re.employee_id,COALESCE(r.payment_date,p.pay_date) AS payment_date,
 re.regular_pay_cents+re.overtime_pay_cents+re.other_taxable_pay_cents AS gross,
 re.federal_income_tax_cents AS federal_income,re.social_security_tax_cents AS social_security,
 re.medicare_tax_cents AS medicare,re.additional_medicare_tax_cents AS additional_medicare,
 re.futa_tax_cents AS futa,re.state_income_tax_cents AS maryland,re.md_ui_tax_cents AS md_ui
 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id
 WHERE r.facility_id=$1 AND r.status='FINALIZED' AND EXTRACT(YEAR FROM COALESCE(r.payment_date,p.pay_date))=$2`,[facility,year])).rows
}
export async function taxReconciliation(db,facility,year) {
 const [rows,deposits,filings,legacy]=await Promise.all([
  taxRows(db,facility,year),
  db.query('SELECT * FROM payroll_tax_deposit WHERE facility_id=$1 AND tax_year=$2 ORDER BY paid_on DESC,id DESC',[facility,year]),
  db.query('SELECT * FROM payroll_tax_filing WHERE facility_id=$1 AND EXTRACT(YEAR FROM period_start)=$2 ORDER BY created_at DESC,id DESC',[facility,year]),
  db.query('SELECT COUNT(*)::int AS count FROM payroll_historical_payment WHERE facility_id=$1 AND EXTRACT(YEAR FROM payment_date)=$2',[facility,year]),
 ])
 const quarters=[1,2,3,4].map(quarter=>{
  const start=`${year}-${String(quarter*3-2).padStart(2,'0')}-01`,end=new Date(Date.UTC(year,quarter*3,0)).toISOString().slice(0,10)
  const totals=summarizeTaxRows(rows,start,end)
  return {quarter,start,end,grossCents:totals.grossCents,employeeCount:totals.employeeCount,agencies:agencies.map(agency=>{
   const depositedCents=deposits.rows.filter(d=>d.status==='RECORDED'&&d.agency===agency&&d.tax_quarter===quarter).reduce((n,d)=>n+Number(d.amount_cents),0)
   return {agency,liabilityCents:totals[agency],depositedCents,balanceCents:totals[agency]-depositedCents}
  })}
 })
 const seen=new Set()
 const filingData=filings.rows.map(f=>{
  const current=summarizeTaxRows(rows,day(f.period_start),day(f.period_end)),key=`${f.form_type}:${day(f.period_start)}:${day(f.period_end)}`
  const superseded=seen.has(key);if(!f.voided_at)seen.add(key)
  const changed=JSON.stringify(current.payroll)!==JSON.stringify(f.payroll_snapshot.payroll)
  const mismatch=Number(f.reported_wages_cents)!==current.grossCents||Number(f.reported_tax_cents)!==current[formAgency[f.form_type]]
  return {...f,status:f.voided_at?'VOID':superseded?'SUPERSEDED':changed?'PAYROLL_CHANGED':mismatch?'TOTALS_DIFFER':legacy.rows[0].count?'LEGACY_REVIEW_REQUIRED':'MATCHED',currentWagesCents:current.grossCents,currentTaxCents:current[formAgency[f.form_type]]}
 })
 return {year,quarters,deposits:deposits.rows,filings:filingData,legacyPayments:legacy.rows[0].count,annual:summarizeTaxRows(rows,`${year}-01-01`,`${year}-12-31`)}
}
export function registerTaxReconciliationRoutes(app,pool,{now=()=>new Date()}={}) {
 const today=settings=>new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now())
 const write=async(req,res,work)=>{
  const db=await pool.connect()
  try{await db.query('BEGIN');const settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])).rows[0];if(!settings)throw fail('Employer not found.',404)
   const result=await work(db,settings);await db.query('COMMIT');res.status(201).json({success:true,data:result})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||(e.code==='23505'?409:500)).json({success:false,message:e.status?e.message:e.code==='23505'?'This agency confirmation reference is already recorded.':'Unable to save tax reconciliation.'})}finally{db.release()}
 }
 const audit=(db,req,action,type,row)=>db.query(`INSERT INTO payroll_audit_log (facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES ($1,$2,$3,$4,$5,$6)`,[req.canonicalAccess.facilityId,req.adminId,action,type,String(row.id),row])
 app.get('/api/admin/payroll/tax-reconciliation',async(req,res)=>{
  const year=Number(req.query.year)
  if(!Number.isInteger(year)||year<2000||year>2200)return res.status(400).json({success:false,message:'Choose a valid tax year.'})
  try{res.json({success:true,data:await taxReconciliation(pool,req.canonicalAccess.facilityId,year)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load tax reconciliation.'})}
 })
 app.post('/api/admin/payroll/tax-deposits',(req,res)=>write(req,res,async(db,settings)=>{
  const b=req.body||{},reference=String(b.reference||'').trim()
  if(!agencies.includes(b.agency)||!Number.isInteger(b.year)||b.year<2000||b.year>2200||!Number.isInteger(b.quarter)||b.quarter<1||b.quarter>4||!cents(b.amountCents)||b.amountCents===0||!validDay(b.paidOn)||b.paidOn>today(settings)||reference.length<4||reference.length>500||b.confirmed!==true)throw fail('Record the agency, tax quarter, positive amount, actual payment date, and confirmed agency/bank receipt.')
  const row=(await db.query(`INSERT INTO payroll_tax_deposit (facility_id,agency,tax_year,tax_quarter,paid_on,amount_cents,reference,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[req.canonicalAccess.facilityId,b.agency,b.year,b.quarter,b.paidOn,b.amountCents,reference,String(b.notes||'').slice(0,2000),req.adminId])).rows[0]
  await audit(db,req,'TAX_DEPOSIT_RECORDED','tax_deposit',row);return row
 }))
 app.post('/api/admin/payroll/tax-deposits/:id/void',(req,res)=>write(req,res,async db=>{
  const reason=String(req.body?.reason||'').trim();if(reason.length<12)throw fail('Explain why the recorded deposit is being voided in at least 12 characters.')
  const row=(await db.query("UPDATE payroll_tax_deposit SET status='VOID',void_reason=$1 WHERE id=$2 AND facility_id=$3 AND status='RECORDED' RETURNING *",[reason.slice(0,2000),req.params.id,req.canonicalAccess.facilityId])).rows[0]
  if(!row)throw fail('Active deposit not found.',404)
  await audit(db,req,'TAX_DEPOSIT_VOIDED','tax_deposit',row);return row
 }))
 app.post('/api/admin/payroll/tax-filings/:id/void',(req,res)=>write(req,res,async db=>{
  const reason=String(req.body?.reason||'').trim()
  if(reason.length<12||req.body?.localRecordOnlyConfirmed!==true)throw fail('Explain the receipt correction in at least 12 characters and confirm this voids only the local record, not an agency return.')
  const row=(await db.query("UPDATE payroll_tax_filing SET voided_at=now(),void_reason=$1 WHERE id=$2 AND facility_id=$3 AND voided_at IS NULL RETURNING *",[reason.slice(0,2000),req.params.id,req.canonicalAccess.facilityId])).rows[0]
  if(!row)throw fail('Active filing receipt not found.',404)
  await audit(db,req,'TAX_FILING_RECEIPT_VOIDED','tax_filing',row);return row
 }))
 app.post('/api/admin/payroll/tax-filings',(req,res)=>write(req,res,async(db,settings)=>{
  const b=req.body||{},reference=String(b.reference||'').trim()
  if(!Object.hasOwn(formAgency,b.formType)||!validDay(b.periodStart)||!validDay(b.periodEnd)||b.periodEnd<b.periodStart||b.periodStart.slice(0,4)!==b.periodEnd.slice(0,4)||!validDay(b.filedOn)||b.filedOn>today(settings)||b.filedOn<b.periodEnd||!cents(b.reportedWagesCents)||!cents(b.reportedTaxCents)||reference.length<4||reference.length>500||b.confirmed!==true)throw fail('Record the form, reporting period, actual filing date, reported totals, and agency acceptance reference.')
  const year=Number(b.periodStart.slice(0,4)),month=Number(b.periodStart.slice(5,7))
  const annual=b.periodStart===`${year}-01-01`&&b.periodEnd===`${year}-12-31`
  const quarterly=[1,4,7,10].includes(month)&&b.periodStart.endsWith('-01')&&b.periodEnd===new Date(Date.UTC(year,month+2,0)).toISOString().slice(0,10)
  if(['IRS_940','MD_MW508','W2_W3'].includes(b.formType)&&!annual)throw fail('This form requires a full calendar-year reporting period.')
  if(['IRS_941','MD_UI'].includes(b.formType)&&!quarterly)throw fail('This form requires a full calendar-quarter reporting period.')
  const snapshot=summarizeTaxRows(await taxRows(db,req.canonicalAccess.facilityId,Number(b.periodStart.slice(0,4))),b.periodStart,b.periodEnd)
  const row=(await db.query(`INSERT INTO payroll_tax_filing (facility_id,form_type,period_start,period_end,filed_on,reference,reported_wages_cents,reported_tax_cents,payroll_snapshot,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[req.canonicalAccess.facilityId,b.formType,b.periodStart,b.periodEnd,b.filedOn,reference,b.reportedWagesCents,b.reportedTaxCents,snapshot,String(b.notes||'').slice(0,2000),req.adminId])).rows[0]
  await audit(db,req,'TAX_FILING_RECORDED','tax_filing',row);return row
 }))
}
