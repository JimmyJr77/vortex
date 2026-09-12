import {leaveYearOpening,leaveYearClosePlan,applyLeaveYearPlan} from './leaveYearClose.js'
export function registerLeaveYearPolicyRoutes(app,pool){
 app.get('/api/admin/payroll/leave-year/history',async(req,res)=>{
  try{
   const facility=req.canonicalAccess.facilityId
   const [policy,history]=await Promise.all([pool.query('SELECT * FROM payroll_leave_year_policy WHERE facility_id=$1',[facility]),pool.query('SELECT * FROM payroll_leave_year_close WHERE facility_id=$1 ORDER BY opening_year DESC',[facility])])
   res.json({success:true,data:{policy:policy.rows[0]||null,history:history.rows}})
  }catch{res.status(500).json({success:false,message:'Unable to load annual leave history.'})}
 })
 app.post('/api/admin/payroll/leave-year/policy',async(req,res)=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId,b=req.body||{}
  try{
   await db.query('BEGIN')
   const settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   if(!settings)throw Object.assign(new Error('Employer settings not found.'),{status:404})
   const currentYear=Number(new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric'}).format(new Date()))
   if(typeof b.enabled!=='boolean'||!Number.isInteger(b.firstYear)||b.firstYear<currentYear+1||b.firstYear>2200||b.confirmed!==true||String(b.source||'').trim().length<12)throw Object.assign(new Error('Confirm the published policy, select a future first year, and provide its reference.'),{status:400})
   leaveYearOpening({balance:0,policy:'ACCRUAL',carryCapMinutes:b.carryCapMinutes,frontloadMinutes:b.frontloadMinutes})
   const before=(await db.query('SELECT * FROM payroll_leave_year_policy WHERE facility_id=$1',[facility])).rows[0]||null
   const saved=(await db.query(`INSERT INTO payroll_leave_year_policy(facility_id,enabled,first_year,carry_cap_minutes,frontload_minutes,source,verified_by) VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(facility_id) DO UPDATE SET enabled=EXCLUDED.enabled,first_year=EXCLUDED.first_year,carry_cap_minutes=EXCLUDED.carry_cap_minutes,frontload_minutes=EXCLUDED.frontload_minutes,source=EXCLUDED.source,verified_by=EXCLUDED.verified_by,verified_at=now() RETURNING *`,[facility,b.enabled,b.firstYear,b.carryCapMinutes,b.frontloadMinutes,String(b.source).trim().slice(0,2000),req.adminId])).rows[0]
   await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'LEAVE_YEAR_POLICY_UPDATED','leave_year_policy',$3,$4,$5)`,[facility,req.adminId,String(facility),before,saved])
   if(!saved.enabled)await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key='leave-year-automation' AND status='OPEN'",[facility])
   await db.query('COMMIT');res.json({success:true,data:saved})
  }catch(e){await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to save annual leave policy.'})}finally{db.release()}
 })
}
export async function automateLeaveYearOpening(pool,facility,now=new Date()){
 const db=await pool.connect()
 try{
  await db.query('BEGIN')
  const settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
  const policy=(await db.query('SELECT * FROM payroll_leave_year_policy WHERE facility_id=$1 AND enabled=true',[facility])).rows[0]
  if(!settings||!policy){await db.query('COMMIT');return {opened:null}}
  const year=Number(new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric'}).format(now))
  const pending=(await db.query('SELECT y FROM generate_series($2::int,$3::int) y WHERE NOT EXISTS(SELECT 1 FROM payroll_leave_year_close c WHERE c.facility_id=$1 AND c.opening_year=y) ORDER BY y LIMIT 1',[facility,policy.first_year,year])).rows[0]
  if(!pending){await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key='leave-year-automation' AND status='OPEN'",[facility]);await db.query('COMMIT');return {opened:null}}
  const plan=await leaveYearClosePlan(db,facility,settings,{year:pending.y,carryCapMinutes:policy.carry_cap_minutes,frontloadMinutes:policy.frontload_minutes},now)
  await applyLeaveYearPlan(db,facility,plan,policy.source)
  await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key='leave-year-automation' AND status='OPEN'",[facility])
  await db.query('COMMIT');return {opened:plan.year}
 }catch(e){
  await db.query('ROLLBACK')
  await db.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,'leave-year-automation','CRITICAL','Annual leave opening needs review',$2)
   ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facility,e.status?e.message:'Annual leave opening failed. Review the saved policy and payroll records before retrying.'])
  return {opened:null,reviewRequired:true}
 }finally{db.release()}
}
