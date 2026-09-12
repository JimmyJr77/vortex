import {registerMarylandAdditionalAgreementRoutes} from './marylandAdditionalAgreementRoutes.js'
import {nativeW4Election} from './nativeW4Election.js'
import {effectiveScheduleSettings} from './payCalendar.js'
import { calculateWithholding2026, withholdingVersionFor, WITHHOLDING_SOURCES } from './withholding2026.js'
const clean=v=>String(v||'').trim().slice(0,2000)
export function registerTaxElectionRoutes(app,pool) {
 registerMarylandAdditionalAgreementRoutes(app,pool)
 app.get('/api/admin/payroll/employees/:id/tax-elections',async(req,res)=>{
  try {
   const employee=(await pool.query('SELECT s.*,e.id FROM payroll_employee e JOIN payroll_settings s ON s.facility_id=e.facility_id WHERE e.id=$1 AND e.facility_id=$2',[req.params.id,req.canonicalAccess.facilityId])).rows[0]
   if(!employee)return res.status(404).json({success:false,message:'Employee not found.'})
   const election=(await pool.query('SELECT tax_year,elections,source_note,verified_at FROM payroll_tax_election WHERE employee_id=$1 AND facility_id=$2',[req.params.id,req.canonicalAccess.facilityId])).rows[0]
   const nativeW4=await nativeW4Election(pool,req.canonicalAccess.facilityId,req.params.id)
   res.json({success:true,data:{election:election||null,nativeW4,version:withholdingVersionFor((await effectiveScheduleSettings(pool,req.canonicalAccess.facilityId,employee)).pay_frequency),sources:WITHHOLDING_SOURCES}})
  }catch{res.status(500).json({success:false,message:'Unable to load tax elections.'})}
 })
 app.patch('/api/admin/payroll/employees/:id/tax-elections',async(req,res)=>{
  const b=req.body||{},f=b.federal||{},m=b.maryland||{},source=clean(b.sourceNote)
  if(b.confirmed!==true||source.length<12)return res.status(400).json({success:false,message:'Confirm the signed forms, local rate, and election values, with a detailed source note.'})
  const dollarFields=['creditsCents','otherIncomeCents','deductionsCents','extraWithholdingCents']
  const federal={filingStatus:f.filingStatus,multipleJobs:f.multipleJobs===true,exempt:f.exempt===true,nonresidentAlien:f.nonresidentAlien===true,lockInLetter:f.lockInLetter===true}
  for(const key of dollarFields)federal[key]=f[key]??0
  const maryland={filingStatus:m.filingStatus,exemptions:m.exemptions,localRate:Number(m.localRate),extraWithholdingCents:m.extraWithholdingCents??0,exempt:m.exempt===true}
  const db=await pool.connect()
  try {
   await db.query('BEGIN')
   const settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])).rows[0]
   Object.assign(settings,await effectiveScheduleSettings(db,req.canonicalAccess.facilityId,settings))
   const version=withholdingVersionFor(settings.pay_frequency)
   const employee=(await db.query('SELECT * FROM payroll_employee WHERE id=$1 AND facility_id=$2 FOR UPDATE',[req.params.id,req.canonicalAccess.facilityId])).rows[0]
   if(!employee){await db.query('ROLLBACK');return res.status(404).json({success:false,message:'Employee not found.'})}
   if(employee.w4_status!=='COMPLETE'||employee.state_withholding_status!=='COMPLETE'){await db.query('ROLLBACK');return res.status(409).json({success:false,message:'Review and complete W-4 and state withholding onboarding before enabling automatic calculations.'})}
   const nativeW4=await nativeW4Election(db,req.canonicalAccess.facilityId,employee.id)
   if(nativeW4){
    if(!nativeW4.reviewed||b.w4Fingerprint!==nativeW4.fingerprint||String(b.w4SubmissionId)!==String(nativeW4.submissionId))throw Object.assign(new Error('Review the current signed W-4 and reload its tax-election values before saving.'),{status:409})
    if(Object.keys(nativeW4.federal).some(key=>federal[key]!==nativeW4.federal[key]))throw Object.assign(new Error('Federal values must match the signed W-4. Ask the employee to submit an amendment to change them.'),{status:409})
    const previous=(await db.query('SELECT elections FROM payroll_tax_election WHERE facility_id=$1 AND employee_id=$2',[req.canonicalAccess.facilityId,employee.id])).rows[0]
    if(previous?.elections?.federal?.lockInLetter)throw Object.assign(new Error('Resolve the existing IRS lock-in review before applying an employee W-4.'),{status:409})
   }else if(b.w4SubmissionId||b.w4Fingerprint)throw Object.assign(new Error('The signed W-4 source changed. Reload the current onboarding submission.'),{status:409})
   const elections={federal,maryland,...(nativeW4?{w4Source:{submissionId:nativeW4.submissionId,documentId:nativeW4.documentId,fingerprint:nativeW4.fingerprint,effectiveOn:nativeW4.effectiveOn}}:{})}
   try {calculateWithholding2026({grossPayCents:200000,paymentDate:nativeW4?.effectiveOn,election:{...elections,verified:true},payFrequency:settings.pay_frequency,year:2026,workState:employee.work_state,residenceState:employee.residence_state})}
   catch(e){await db.query('ROLLBACK');return res.status(400).json({success:false,message:e.message})}
   await db.query(`INSERT INTO payroll_tax_election (facility_id,employee_id,tax_year,elections,source_note,verified_by) VALUES ($1,$2,2026,$3,$4,$5) ON CONFLICT (employee_id) DO UPDATE SET tax_year=2026,elections=EXCLUDED.elections,source_note=EXCLUDED.source_note,verified_by=EXCLUDED.verified_by,verified_at=now()`,[req.canonicalAccess.facilityId,req.params.id,elections,source,req.adminId])
   await db.query(`INSERT INTO payroll_audit_log (facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES ($1,$2,'TAX_ELECTIONS_VERIFIED','employee',$3,$4)`,[req.canonicalAccess.facilityId,req.adminId,String(req.params.id),{elections,source,version}])
   await db.query('COMMIT');res.json({success:true,data:{saved:true,version}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to save tax elections.'})}finally{db.release()}
 })
}
