import {effectiveScheduleSettings} from './payCalendar.js'
import { payrollEmployeeAuth,lockPayrollEmployeeSession } from './employeeAuth.js'

const day = value => value instanceof Date ? value.toISOString().slice(0,10) : String(value || '').slice(0,10)
const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value
const fail = (message,status=400) => Object.assign(new Error(message),{status})

export function validatePayChange(body, settings, employee, latest, today) {
 const effective=body.effectiveOn, notice=body.noticeDeliveredOn
 if(!validDay(effective)||!validDay(notice))throw fail('Use valid effective and written-notice dates.')
 if(!Number.isSafeInteger(body.hourlyRateCents)||body.hourlyRateCents<=0)throw fail('Use a positive hourly rate in cents.')
 if(!['ACTIVE','LEAVE'].includes(employee.employment_status)||employee.pay_type!=='HOURLY')throw fail('Dated pay changes are available for active hourly employees and employees on leave.',409)
 if(effective<=today||effective<=day(latest.effective_on)||effective<day(employee.hire_date))throw fail('Append a future pay change after the last recorded rate. Past compensation remains unchanged.',409)
 if(body.hourlyRateCents===Number(latest.hourly_rate_cents))throw fail('The new rate must differ from the preceding rate.')
 if(notice>today||notice>effective||body.noticeConfirmed!==true||String(body.noticeReference||'').trim().length<12)throw fail('Confirm when written notice was delivered and record its delivery reference.')
 const noticeDays={WEEKLY:7,BIWEEKLY:14,SEMIMONTHLY:16,MONTHLY:31}[settings.pay_frequency]
 if(!noticeDays)throw fail('Configure a supported pay frequency before scheduling compensation.',409)
 if(body.hourlyRateCents<Number(latest.hourly_rate_cents)&&(Date.parse(effective)-Date.parse(notice))/86400000<noticeDays)throw fail(`Pay decreases require at least ${noticeDays} days of advance written notice for this pay frequency.`)
 if(String(body.reason||'').trim().length<12)throw fail('Describe the compensation change in at least 12 characters.')
}

export async function payRateData(db,facility,employee) {
 const settings=(await db.query(`SELECT *,(now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1`,[facility])).rows[0]
 Object.assign(settings,await effectiveScheduleSettings(db,facility,settings,settings.today))
 const rates=(await db.query('SELECT * FROM payroll_pay_rate WHERE facility_id=$1 AND employee_id=$2 ORDER BY effective_on DESC,id DESC',[facility,employee])).rows
 return {rates,workweekStartsOn:settings.workweek_starts_on,payFrequency:settings.pay_frequency,today:settings.today,currentRateCents:rates.find(r=>!r.cancelled_at&&day(r.effective_on)<=settings.today)?.hourly_rate_cents??null}
}
export async function assertCompensationUnlocked(db,facility,employeeId,effectiveOn) {
 const result=(await db.query(`SELECT EXISTS(SELECT 1 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
   WHERE r.facility_id=$1 AND r.run_kind='REGULAR' AND r.status IN ('APPROVED','FINALIZED') AND p.period_end >= $3::date)
   OR payroll_weighted_time_locked($1,$2,$3::date::timestamp AT TIME ZONE s.timezone,'infinity'::timestamptz,s.timezone) AS locked
   FROM payroll_settings s WHERE s.facility_id=$1`,[facility,employeeId,effectiveOn])).rows[0]
 if(result?.locked)throw fail('Approved or finalized payroll depends on this rate, including its complete weighted workweek. Resolve that payroll before changing compensation.',409)
}
export function registerCompensationAdminRoutes(app,pool) {
 app.get('/api/admin/payroll/employees/:id/pay-rates',async(req,res)=>{
  try {
   const e=(await pool.query('SELECT id FROM payroll_employee WHERE id=$1 AND facility_id=$2',[req.params.id,req.canonicalAccess.facilityId])).rows[0]
   if(!e)return res.status(404).json({success:false,message:'Employee not found.'})
   res.json({success:true,data:await payRateData(pool,req.canonicalAccess.facilityId,e.id)})
  }catch{res.status(500).json({success:false,message:'Unable to load compensation history.'})}
 })
 app.post('/api/admin/payroll/employees/:id/pay-rates',async(req,res)=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId,b=req.body||{}
  try {
   await db.query('BEGIN')
   const settings=(await db.query(`SELECT *,(now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1 FOR UPDATE`,[facility])).rows[0]
   const employee=(await db.query('SELECT * FROM payroll_employee WHERE id=$1 AND facility_id=$2 FOR UPDATE',[req.params.id,facility])).rows[0]
   if(!employee)throw fail('Employee not found.',404)
   const latest=(await db.query('SELECT * FROM payroll_pay_rate WHERE employee_id=$1 AND facility_id=$2 AND cancelled_at IS NULL ORDER BY effective_on DESC LIMIT 1',[employee.id,facility])).rows[0]
   if(!latest)throw fail('An opening compensation record is required.',409)
   Object.assign(settings,await effectiveScheduleSettings(db,facility,settings,settings.today))
   validatePayChange(b,settings,employee,latest,settings.today)
   await assertCompensationUnlocked(db,facility,employee.id,b.effectiveOn)
   const record=(await db.query(`INSERT INTO payroll_pay_rate (facility_id,employee_id,effective_on,hourly_rate_cents,reason,notice_delivered_on,notice_reference,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[facility,employee.id,b.effectiveOn,b.hourlyRateCents,String(b.reason).trim().slice(0,2000),b.noticeDeliveredOn,String(b.noticeReference).trim().slice(0,2000),req.adminId])).rows[0]
   await db.query(`INSERT INTO payroll_audit_log (facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES ($1,$2,'PAY_CHANGE_SCHEDULED','pay_rate',$3,$4,$5)`,[facility,req.adminId,String(record.id),latest,record])
   await db.query('COMMIT');res.status(201).json({success:true,data:record})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||(e.code==='23505'?409:500)).json({success:false,message:e.status?e.message:e.code==='23505'?'A pay change already exists on that date.':'Unable to schedule compensation.'})}finally{db.release()}
 })
 app.post('/api/admin/payroll/employees/:id/pay-rates/:rateId/cancel',async(req,res)=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId,b=req.body||{}
  try {
   await db.query('BEGIN')
   const settings=(await db.query(`SELECT *,(now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1 FOR UPDATE`,[facility])).rows[0]
   const employee=(await db.query('SELECT * FROM payroll_employee WHERE id=$1 AND facility_id=$2 FOR UPDATE',[req.params.id,facility])).rows[0]
   if(!employee)throw fail('Employee not found.',404)
   const rates=(await db.query('SELECT * FROM payroll_pay_rate WHERE employee_id=$1 AND facility_id=$2 AND cancelled_at IS NULL ORDER BY effective_on DESC,id DESC FOR UPDATE',[employee.id,facility])).rows
   const rate=rates.find(r=>String(r.id)===req.params.rateId)
   if(!rate)throw fail('Active pay change not found.',404)
   if(rate!==rates[0]||rates.length<2||day(rate.effective_on)<=settings.today)throw fail('Only the latest future pay change can be cancelled. Effective and opening rates remain unchanged.',409)
   const previous=rates[1]
   if(!validDay(b.noticeDeliveredOn)||b.noticeDeliveredOn>settings.today||b.noticeDeliveredOn<day(rate.notice_delivered_on)||b.noticeConfirmed!==true||String(b.noticeReference||'').trim().length<12)throw fail('Confirm delivery of the cancellation notice and record its date and reference.')
   if(String(b.reason||'').trim().length<12)throw fail('Describe the cancellation in at least 12 characters.')
   Object.assign(settings,await effectiveScheduleSettings(db,facility,settings,settings.today))
   const noticeDays={WEEKLY:7,BIWEEKLY:14,SEMIMONTHLY:16,MONTHLY:31}[settings.pay_frequency]
   if(!noticeDays)throw fail('Configure a supported pay frequency before changing compensation.',409)
   if(Number(previous.hourly_rate_cents)<Number(rate.hourly_rate_cents)&&(Date.parse(day(rate.effective_on))-Date.parse(b.noticeDeliveredOn))/86400000<noticeDays)throw fail(`Cancelling this increase requires at least ${noticeDays} days of advance written notice because the preceding rate is lower.`)
   await assertCompensationUnlocked(db,facility,employee.id,day(rate.effective_on))
   const record=(await db.query(`UPDATE payroll_pay_rate SET cancelled_at=now(),cancelled_by=$1,cancellation_reason=$2,cancellation_notice_delivered_on=$3,cancellation_notice_reference=$4 WHERE id=$5 RETURNING *`,[req.adminId,String(b.reason).trim().slice(0,2000),b.noticeDeliveredOn,String(b.noticeReference).trim().slice(0,2000),rate.id])).rows[0]
   await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'PAY_CHANGE_CANCELLED','pay_rate',$3,$4,$5)`,[facility,req.adminId,String(rate.id),rate,record])
   await db.query('COMMIT');res.json({success:true,data:record})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to cancel pay change.'})}finally{db.release()}
 })
}
export function registerCompensationEmployeeRoutes(app,pool) {
 app.get('/api/payroll/employee/pay-rates',payrollEmployeeAuth(pool),async(req,res)=>{
  try{res.json({success:true,data:await payRateData(pool,req.payrollEmployee.facility_id,req.payrollEmployee.employee_id)})}catch{res.status(500).json({success:false,message:'Unable to load pay notices.'})}
 })
 app.post('/api/payroll/employee/pay-rates/:id/acknowledge',payrollEmployeeAuth(pool),async(req,res)=>{
  if(req.body?.acknowledged!==true)return res.status(400).json({success:false,message:'Confirm receipt of the pay notice.'})
  const db=await pool.connect()
  try {
   await db.query('BEGIN');await lockPayrollEmployeeSession(db,req.payrollEmployee,req)
   const cancellation=req.body.cancellation===true
   const row=(await db.query(cancellation
    ? 'UPDATE payroll_pay_rate SET cancellation_acknowledged_at=COALESCE(cancellation_acknowledged_at,now()) WHERE id=$1 AND employee_id=$2 AND facility_id=$3 AND cancelled_at IS NOT NULL RETURNING *'
    : 'UPDATE payroll_pay_rate SET acknowledged_at=COALESCE(acknowledged_at,now()) WHERE id=$1 AND employee_id=$2 AND facility_id=$3 AND notice_delivered_on IS NOT NULL AND cancelled_at IS NULL RETURNING *',[req.params.id,req.payrollEmployee.employee_id,req.payrollEmployee.facility_id])).rows[0]
   if(!row)throw fail('Pay notice not found.',404)
   await db.query(`INSERT INTO payroll_audit_log (facility_id,action,entity_type,entity_id,after_data) VALUES ($1,'PAY_NOTICE_ACKNOWLEDGED','pay_rate',$2,$3)`,[req.payrollEmployee.facility_id,String(row.id),{employeeId:req.payrollEmployee.employee_id,cancellation,acknowledgedAt:cancellation?row.cancellation_acknowledged_at:row.acknowledged_at}])
   await db.query('COMMIT');res.json({success:true,data:row})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to acknowledge pay notice.'})}finally{db.release()}
 })
}
