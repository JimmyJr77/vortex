import {createHash} from 'node:crypto'
import {generateVersionedPayPeriods,loadScheduleVersions,persistPayPeriods,effectiveScheduleSettings} from './payCalendar.js'
const day=v=>v instanceof Date?v.toISOString().slice(0,10):String(v||'').slice(0,10)
const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&day(new Date(v))===v
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const snapshot=s=>Object.fromEntries(['pay_frequency','pay_period_anchor_start','pay_period_payment_lag_days','semimonthly_first_day','semimonthly_second_day'].map(k=>[k,k==='pay_period_anchor_start'?s[k]?day(s[k]):null:s[k]]))
export function validateScheduleNotice(notice,today,deadline){
 if(!valid(String(notice||''))||notice>today||notice>deadline)throw fail(`Record a valid delivered notice date no later than ${deadline}, providing a full pay period before the schedule change.`,400)
}
export async function scheduleTransitionPlan(db,facility,current,body,cancelId=null){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:current.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const effective=String(body.effectiveOn||'')
 if(!valid(effective)||effective<=today||Number(effective.slice(0,4))>2198)throw fail('Choose a future effective date on a complete pay-period boundary.',400)
 if(!['WEEKLY','BIWEEKLY','SEMIMONTHLY'].includes(body.frequency))throw fail('Select weekly, biweekly or semimonthly payroll.',400)
 const versions=(await loadScheduleVersions(db,facility)).filter(v=>String(v.id)!==String(cancelId))
 if(versions.some(v=>day(v.effective_on)>today))throw fail('An upcoming schedule transition already exists. Resolve it before scheduling another change.')
 const before=(await db.query('SELECT * FROM payroll_pay_period WHERE facility_id=$1 ORDER BY period_start',[facility])).rows
 if(before.some(p=>day(p.period_start)<effective&&day(p.period_end)>=effective))throw fail('The effective date splits an existing pay period.')
 const replaced=before.filter(p=>day(p.period_start)>=effective)
 const ids=replaced.map(p=>String(p.id))
 const used=(await db.query(`SELECT EXISTS(SELECT 1 FROM payroll_run WHERE facility_id=$1 AND pay_period_id=ANY($2::bigint[])) OR EXISTS(SELECT 1 FROM payroll_employee_request WHERE facility_id=$1 AND payload->'reimbursementPeriod'->>'id'=ANY($3::text[])) AS used`,[facility,ids,ids])).rows[0].used
 if(used||replaced.some(p=>p.status!=='OPEN'))throw fail('Future periods contain payroll, assigned reimbursements or a locked status. They cannot be replaced by this transition.')
 const settings=snapshot({...current,pay_frequency:body.frequency,pay_period_anchor_start:body.frequency==='SEMIMONTHLY'?null:body.anchorStart,pay_period_payment_lag_days:body.frequency==='SEMIMONTHLY'?null:body.paymentLagDays})
 const baseline=versions.length?versions:[{effective_on:'2000-01-01',schedule_settings:snapshot(current)}]
 const proposed=[...baseline,{effective_on:effective,schedule_settings:settings}]
 const start=new Date(effective+'T00:00:00Z'),last=replaced.at(-1)
 const end=last?new Date(day(last.period_end)+'T00:00:00Z'):start
 const count=Math.max(4,(end.getUTCFullYear()-start.getUTCFullYear())*12+end.getUTCMonth()-start.getUTCMonth()+3)
 if(count>27)throw fail('Generated future periods extend more than two years beyond this transition. Review those periods before changing the schedule.')
 const periods=[]
 for(let offset=-1;offset<count;offset++){
  const month=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+offset,1))
  periods.push(...generateVersionedPayPeriods(month.getUTCFullYear(),month.getUTCMonth()+1,current,proposed))
 }
 periods.sort((a,b)=>a.periodStart.localeCompare(b.periodStart))
 const first=periods.findIndex(p=>p.periodStart>=effective)
 if(first<1||periods[first].periodStart!==effective||Date.parse(effective)-Date.parse(periods[first-1].periodEnd)!==86400000)throw fail('The old and new schedules must meet without a missing or overlapping day.')
 // Retain the preceding period in the preview so administrators can inspect the cutover.
 const preview=periods.slice(first-1),replacement=periods.slice(first)
 const preceding=before.find(p=>day(p.period_end)===preview[0].periodEnd)
 if(preceding){
  if(day(preceding.period_start)!==preview[0].periodStart||preceding.frequency!==preview[0].frequency)throw fail('The preceding recorded period does not match schedule history. Resolve that discrepancy before changing the schedule.')
  preview[0]={...preview[0],payDate:day(preceding.pay_date)}
 }
 const previewToken=createHash('sha256').update(JSON.stringify({effective,proposed,before,preview,cancelId})).digest('hex')
 return {today,noticeDeadline:preview[0].periodStart,effective,settings,baseline,hadVersions:versions.length>0,replaced,replacement,periods:preview,previewToken}
}
export function registerPayScheduleTransitionRoutes(app,pool){
 app.get('/api/admin/payroll/pay-schedule/history',async(req,res)=>{
  try{
   const facility=req.canonicalAccess.facilityId
   const versions=(await pool.query(`SELECT v.*,v.cancelled_at IS NULL AND v.effective_on>(now() AT TIME ZONE s.timezone)::date AS can_cancel FROM payroll_schedule_version v JOIN payroll_settings s USING(facility_id) WHERE v.facility_id=$1 ORDER BY v.effective_on,v.id`,[facility])).rows
   res.json({success:true,data:versions.map(v=>({...v,effective_on:day(v.effective_on)}))})
  }catch{res.status(500).json({success:false,message:'Unable to load schedule history.'})}
 })
 for(const [path,save] of [['cancel-preview',false],['cancel',true]])app.post(`/api/admin/payroll/pay-schedule/:id/${path}`,async(req,res)=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId,body=req.body||{}
  try{
   await db.query('BEGIN')
   const current=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   if(!current)throw fail('Employer settings not found.',404)
   const versions=await loadScheduleVersions(db,facility),target=versions.find(v=>String(v.id)===req.params.id)
   if(!target)throw fail('Active schedule change not found.',404)
   if(target!==versions.at(-1)||versions.length<2)throw fail('Only the latest future schedule change can be cancelled.')
   const previous=versions.at(-2).schedule_settings
   const plan=await scheduleTransitionPlan(db,facility,{...current,...previous},{effectiveOn:day(target.effective_on),frequency:previous.pay_frequency,anchorStart:previous.pay_period_anchor_start,paymentLagDays:previous.pay_period_payment_lag_days},target.id)
   const announcedDays={WEEKLY:7,BIWEEKLY:14,SEMIMONTHLY:16,MONTHLY:31}[target.schedule_settings.pay_frequency]
   const announcedDeadline=day(new Date(Date.parse(plan.effective)-announcedDays*86400000))
   if(announcedDeadline<plan.noticeDeadline)plan.noticeDeadline=announcedDeadline
   if(save){
    validateScheduleNotice(body.noticeDeliveredOn,plan.today,plan.noticeDeadline)
    if(target.notice_delivered_on&&body.noticeDeliveredOn<day(target.notice_delivered_on))throw fail('The cancellation notice cannot precede the original schedule notice.',400)
    if(body.confirmed!==true||String(body.source||'').trim().length<12)throw fail('Confirm the cancellation notice and provide its delivery reference.',400)
    if(body.previewToken!==plan.previewToken)throw fail('The schedule or its periods changed. Preview the cancellation again before saving.')
    await db.query('UPDATE payroll_schedule_version SET cancelled_at=now(),cancelled_by=$3,cancellation_source=$4,cancellation_notice_delivered_on=$5 WHERE facility_id=$1 AND id=$2',[facility,target.id,req.adminId,String(body.source).trim().slice(0,2000),body.noticeDeliveredOn])
    await db.query('DELETE FROM payroll_pay_period WHERE facility_id=$1 AND id=ANY($2::bigint[])',[facility,plan.replaced.map(p=>p.id)])
    await persistPayPeriods(db,facility,plan.replacement)
    await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'PAY_SCHEDULE_TRANSITION_CANCELLED','pay_schedule_version',$3,$4,$5)`,[facility,req.adminId,String(target.id),{version:target,periods:plan.replaced},{periods:plan.replacement,source:String(body.source).trim().slice(0,2000),noticeDeliveredOn:body.noticeDeliveredOn}])
   }
   await db.query('COMMIT');res.json({success:true,data:{noticeDeadline:plan.noticeDeadline,periods:plan.periods,replacedPeriodCount:plan.replaced.length,previewToken:plan.previewToken,saved:save}})
  }catch(error){await db.query('ROLLBACK');res.status(error.status||500).json({success:false,message:error.status?error.message:'Unable to cancel schedule transition.'})}finally{db.release()}
 })
 for(const [path,save] of [['transition-preview',false],['transition',true]])app.post(`/api/admin/payroll/pay-schedule/${path}`,async(req,res)=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId,body=req.body||{}
  try{
   await db.query('BEGIN')
   const current=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   if(!current)throw fail('Employer settings not found.',404)
   const plan=await scheduleTransitionPlan(db,facility,await effectiveScheduleSettings(db,facility,current),body)
   if(save){
    validateScheduleNotice(body.noticeDeliveredOn,plan.today,plan.noticeDeadline)
    if(body.confirmed!==true||String(body.source||'').trim().length<12)throw fail('Verify employee notice and provide the published schedule reference.',400)
    if(body.previewToken!==plan.previewToken)throw fail('The schedule or its periods changed. Preview the transition again before saving.')
    if(!plan.hadVersions)await db.query(`INSERT INTO payroll_schedule_version(facility_id,effective_on,schedule_settings,source,created_by) VALUES($1,$2,$3,'Original schedule preserved at first transition',$4)`,[facility,plan.baseline[0].effective_on,plan.baseline[0].schedule_settings,req.adminId])
    await db.query('INSERT INTO payroll_schedule_version(facility_id,effective_on,schedule_settings,source,created_by,notice_delivered_on) VALUES($1,$2,$3,$4,$5,$6)',[facility,plan.effective,plan.settings,String(body.source).trim().slice(0,2000),req.adminId,body.noticeDeliveredOn])
    await db.query('DELETE FROM payroll_pay_period WHERE facility_id=$1 AND id=ANY($2::bigint[])',[facility,plan.replaced.map(p=>p.id)])
    await persistPayPeriods(db,facility,plan.replacement)
    await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'PAY_SCHEDULE_TRANSITION_SCHEDULED','pay_schedule',$3,$4,$5)`,[facility,req.adminId,String(facility),{periods:plan.replaced},{effectiveOn:plan.effective,settings:plan.settings,periods:plan.replacement,source:String(body.source).trim().slice(0,2000),noticeDeliveredOn:body.noticeDeliveredOn}])
   }
   await db.query('COMMIT');res.json({success:true,data:{noticeDeadline:plan.noticeDeadline,effectiveOn:plan.effective,periods:plan.periods,replacedPeriodCount:plan.replaced.length,previewToken:plan.previewToken,saved:save}})
  }catch(error){await db.query('ROLLBACK');res.status(error.status||500).json({success:false,message:error.status?error.message:'Unable to schedule payroll transition.'})}finally{db.release()}
 })
}
