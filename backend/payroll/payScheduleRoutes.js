import {registerAdminScheduleNoticeRoutes} from './scheduleNotices.js'
import {registerPayScheduleTransitionRoutes} from './payScheduleTransition.js'
import {generatePayPeriods,persistPayPeriods} from './payCalendar.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
function proposal(body,current){
 if(!['WEEKLY','BIWEEKLY','SEMIMONTHLY'].includes(body.frequency))throw fail('Select weekly, biweekly or semimonthly payroll.')
 const settings={...current,pay_frequency:body.frequency,pay_period_anchor_start:body.anchorStart||null,pay_period_payment_lag_days:body.paymentLagDays}
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:current.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const periods=[]
 for(let offset=0;offset<3;offset++){
  const month=new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7))-1+offset,1))
  periods.push(...generatePayPeriods(month.getUTCFullYear(),month.getUTCMonth()+1,settings))
 }
 return {settings,periods}
}
export function registerPayScheduleRoutes(app,pool){
 registerPayScheduleTransitionRoutes(app,pool)
 registerAdminScheduleNoticeRoutes(app,pool)
 for(const [path,save] of [['preview',false],['configure',true]])app.post(`/api/admin/payroll/pay-schedule/${path}`,async(req,res)=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId
  try{
   await db.query('BEGIN')
   const current=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   if(!current)throw fail('Employer settings not found.',404)
   const {settings,periods}=proposal(req.body||{},current)
   if(save){
    if(req.body.confirmed!==true||String(req.body.source||'').trim().length<12)throw fail('Confirm the published pay schedule and provide its policy or notice reference.')
    const used=(await db.query(`SELECT EXISTS(SELECT 1 FROM payroll_schedule_version WHERE facility_id=$1) OR EXISTS(SELECT 1 FROM payroll_run WHERE facility_id=$1) OR EXISTS(SELECT 1 FROM payroll_employee_request WHERE facility_id=$1 AND payload ? 'reimbursementPeriod') AS used`,[facility])).rows[0].used
    if(used)throw fail('Existing payroll or assigned reimbursements require a dated schedule transition. Initial schedule replacement is unavailable for this employer.',409)
    const before=(await db.query('SELECT * FROM payroll_pay_period WHERE facility_id=$1 ORDER BY period_start',[facility])).rows
    await db.query('DELETE FROM payroll_pay_period WHERE facility_id=$1',[facility])
    await db.query('UPDATE payroll_settings SET pay_frequency=$2,pay_period_anchor_start=$3,pay_period_payment_lag_days=$4,updated_at=now() WHERE facility_id=$1',[facility,settings.pay_frequency,settings.pay_period_anchor_start,settings.pay_frequency==='SEMIMONTHLY'?null:settings.pay_period_payment_lag_days])
    await persistPayPeriods(db,facility,periods)
    await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'PAY_SCHEDULE_CONFIGURED','pay_schedule',$5,$3,$4)`,[facility,req.adminId,{frequency:current.pay_frequency,periods:before},{frequency:settings.pay_frequency,periods,source:String(req.body.source).trim().slice(0,2000)},String(facility)])
   }
   await db.query('COMMIT');res.json({success:true,data:{periods,saved:save}})
  }catch(error){await db.query('ROLLBACK');res.status(error.status||500).json({success:false,message:error.status?error.message:'Unable to configure pay schedule.'})}finally{db.release()}
 })
}
