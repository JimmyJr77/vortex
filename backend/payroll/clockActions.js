import {assertEmploymentRange} from './employmentPeriods.js'
import {lockPayrollEmployeeSession} from './employeeAuth.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function recordPayrollClock(pool,{facilityId,employeeId,action,activityType='INSTRUCTION',adminId=null,isAdmin=false,employeeSession=null}) {
 const db=await pool.connect()
 try {
  await db.query('BEGIN')
  if(!isAdmin)await lockPayrollEmployeeSession(db,employeeSession,{path:'/clock'})
  await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facilityId])
  const employee=(await db.query('SELECT employment_status FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facilityId,employeeId])).rows[0]
  if(!employee)throw fail('Employee not found.',404)
  if(employee.employment_status==='TERMINATED'&&(action==='IN'||!isAdmin))throw fail('Former employees cannot start new work. An admin may close an existing clock for review.')
  if(action==='IN')await assertEmploymentRange(db,facilityId,employeeId,(await db.query('SELECT now() AS timestamp')).rows[0].timestamp)
  let row
  if(action==='IN')row=(await db.query(`INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,activity_type,source,status,evidence_note,created_by) VALUES($1,$2,now(),$3,'EMPLOYEE_CLOCK','UNVERIFIED',$4,$5) RETURNING *`,[facilityId,employeeId,activityType,!isAdmin?'Employee self-service clock':'Recorded by admin clock action',adminId])).rows[0]
  else if(action==='OUT')row=(await db.query(`UPDATE payroll_time_entry SET clock_out=now(),updated_at=now() WHERE id=(SELECT id FROM payroll_time_entry WHERE facility_id=$1 AND employee_id=$2 AND clock_out IS NULL AND status<>'REJECTED' ORDER BY clock_in DESC LIMIT 1) AND clock_out IS NULL AND status<>'REJECTED' RETURNING *`,[facilityId,employeeId])).rows[0]
  else throw fail('IN or OUT action is required.',400)
  if(!row)throw fail('No open clock entry exists.')
  await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,$3,'time_entry',$4,$5)`,[facilityId,adminId,`${!isAdmin?'EMPLOYEE_':''}CLOCK_${action}`,String(row.id),{employeeId,entry:row}])
  await db.query('COMMIT');return row
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error}finally{db.release()}
}
