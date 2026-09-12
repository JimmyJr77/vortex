import { taxReconciliation } from './taxReconciliation.js'
const day=v=>v instanceof Date?v.toISOString().slice(0,10):String(v||'').slice(0,10)
// 2026 standard Maryland UI dates, including weekend moves for Q3 and Q4.
const dates2026=['2026-04-30','2026-07-31','2026-11-02','2027-02-01']
export function calculateMarylandUiCalendar(taxes,config,today) {
 if(taxes.year!==2026||!config)return []
 return taxes.quarters.filter(q=>q.quarter>=config.first_quarter&&q.quarter<=config.last_quarter).map(q=>{
  const dueOn=dates2026[q.quarter-1],tax=q.agencies.find(a=>a.agency==='MD_UI').liabilityCents
  let remaining=tax,coveredCents=0,lateCoveredCents=0
  const receipts=taxes.deposits.filter(d=>d.agency==='MD_UI'&&Number(d.tax_quarter)===q.quarter&&d.status==='RECORDED'&&day(d.paid_on)<=today).sort((a,b)=>day(a.paid_on).localeCompare(day(b.paid_on))||Number(a.id)-Number(b.id))
  for(const d of receipts){const amount=Math.min(remaining,Number(d.amount_cents));coveredCents+=amount;remaining-=amount;if(day(d.paid_on)>dueOn)lateCoveredCents+=amount}
  const filing=taxes.filings.find(f=>f.form_type==='MD_UI'&&day(f.period_start)===q.start&&day(f.period_end)===q.end&&!['SUPERSEDED','VOID'].includes(f.status)&&day(f.filed_on)<=today)
  const deadlineStatus=dueOn<today?'OVERDUE':dueOn===today?'DUE_TODAY':'UPCOMING'
  const filingStatus=filing?(filing.status==='MATCHED'?(day(filing.filed_on)>dueOn?'RECORDED_LATE':'RECORDED'):'REVIEW_REQUIRED'):deadlineStatus
  return {quarter:q.quarter,start:q.start,end:q.end,dueOn,projected:q.end>today,grossCents:q.grossCents,liabilityCents:tax,coveredCents,lateCoveredCents,balanceCents:remaining,paymentStatus:tax===0?'NO_TAX_DUE':remaining===0?(lateCoveredCents?'COVERED_LATE':'COVERED'):deadlineStatus,filingStatus,filingReference:filing?.reference||null}
 })
}
export async function marylandUiCalendar(db,facility,year) {
 const [taxes,configuration,settings]=await Promise.all([taxReconciliation(db,facility,year),db.query('SELECT * FROM payroll_md_ui_reporting_config WHERE facility_id=$1 AND tax_year=$2',[facility,year]),db.query('SELECT employer_tax_config,md_ui_status,(now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[facility])])
 const config=configuration.rows[0]||null,setting=settings.rows[0],issues=[]
 if(year!==2026)issues.push('Maryland unemployment deadlines are currently verified for 2026 only.')
 if(!config)issues.push('Verify the quarters when this Maryland unemployment account requires reports and the standard payment schedule.')
 if(setting?.employer_tax_config?.verified!==true||setting.employer_tax_config.year!==year)issues.push('Verify the assigned Maryland contributory-employer rate in Employer setup.')
 if(taxes.legacyPayments)issues.push('Historical payments require complete unemployment wage and tax reconciliation before relying on this calendar.')
 if(config&&taxes.quarters.some(q=>(q.quarter<config.first_quarter||q.quarter>config.last_quarter)&&(q.grossCents>0||q.agencies.find(a=>a.agency==='MD_UI').liabilityCents>0)))issues.push('Finalized payroll exists outside the verified reporting quarters. Review the account reporting range.')
 return {year,today:setting?.today,config,issues,reliable:issues.length===0,accountActive:setting?.md_ui_status==='ACTIVE',quarters:calculateMarylandUiCalendar(taxes,config,setting?.today)}
}
export function registerMarylandUiCalendarRoutes(app,pool) {
 app.get('/api/admin/payroll/maryland-ui-calendar',async(req,res)=>{
  const year=Number(req.query.year);if(!Number.isInteger(year)||year<2000||year>2200)return res.status(400).json({success:false,message:'Choose a valid tax year.'})
  try{res.json({success:true,data:await marylandUiCalendar(pool,req.canonicalAccess.facilityId,year)})}catch{res.status(500).json({success:false,message:'Unable to load Maryland unemployment calendar.'})}
 })
 app.post('/api/admin/payroll/maryland-ui-reporting',async(req,res)=>{
  const b=req.body||{}
  if(b.year!==2026||!Number.isInteger(b.firstQuarter)||!Number.isInteger(b.lastQuarter)||b.firstQuarter<1||b.lastQuarter>4||b.firstQuarter>b.lastQuarter||b.confirmed!==true||b.standardScheduleConfirmed!==true||String(b.source||'').trim().length<12)return res.status(400).json({success:false,message:'Verify 2026 reporting quarters, complete wage history, standard contributory-employer deadlines, and the account source.'})
  const db=await pool.connect()
  try {
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
   const before=(await db.query('SELECT * FROM payroll_md_ui_reporting_config WHERE facility_id=$1 AND tax_year=$2',[req.canonicalAccess.facilityId,b.year])).rows[0]||null
   const row=(await db.query(`INSERT INTO payroll_md_ui_reporting_config(facility_id,tax_year,first_quarter,last_quarter,source,verified_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(facility_id,tax_year) DO UPDATE SET first_quarter=EXCLUDED.first_quarter,last_quarter=EXCLUDED.last_quarter,source=EXCLUDED.source,verified_by=EXCLUDED.verified_by,verified_at=now() RETURNING *`,[req.canonicalAccess.facilityId,b.year,b.firstQuarter,b.lastQuarter,String(b.source).trim().slice(0,2000),req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'MD_UI_REPORTING_VERIFIED','md_ui_reporting',$3,$4,$5)",[req.canonicalAccess.facilityId,req.adminId,String(b.year),before,row])
   await db.query('COMMIT');res.json({success:true,data:row})
  }catch{await db.query('ROLLBACK').catch(()=>{});res.status(500).json({success:false,message:'Unable to save Maryland unemployment reporting setup.'})}finally{db.release()}
 })
}
