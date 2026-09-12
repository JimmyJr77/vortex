import {assertEmploymentRange} from './employmentPeriods.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export async function createShiftSeries(db,{facilityId,employeeId,adminId,body}) {
 const start=new Date(body.scheduledStart),end=new Date(body.scheduledEnd),weeks=Number(body.repeatWeeks||1)
 if(!Number.isFinite(start.valueOf())||!Number.isFinite(end.valueOf())||end<=start||!Number.isInteger(weeks)||weeks<1||weeks>26)throw fail('Enter valid shift times and 1 to 26 weekly occurrences.')
 const employee=(await db.query(`SELECT e.id,s.timezone FROM payroll_employee e JOIN payroll_settings s ON s.facility_id=e.facility_id WHERE e.id=$1 AND e.facility_id=$2 AND e.employment_status IN ('ONBOARDING','ACTIVE','LEAVE') FOR UPDATE OF e`,[employeeId,facilityId])).rows[0]
 if(!employee)throw fail('Eligible employee not found.',404)
 const periods=(await db.query(`SELECT (($1::timestamptz AT TIME ZONE $3)+n*interval '1 week') AT TIME ZONE $3 AS start,(($2::timestamptz AT TIME ZONE $3)+n*interval '1 week') AT TIME ZONE $3 AS finish FROM generate_series(0,$4::int-1) n`,[start.toISOString(),end.toISOString(),employee.timezone,weeks])).rows
 const activity=['INSTRUCTION','PLANNING','SETUP','MEETING','ADMIN','OTHER'].includes(body.activityType)?body.activityType:'INSTRUCTION'
 const shifts=[]
 for(const period of periods) {
  await assertShiftAvailable(db,facilityId,employeeId,period.start,period.finish,employee.timezone)
  const inserted=await db.query(`INSERT INTO payroll_shift (facility_id,employee_id,scheduled_start,scheduled_end,activity_type,location,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[facilityId,employeeId,period.start,period.finish,activity,String(body.location||'').slice(0,500),String(body.notes||'').slice(0,2000),adminId])
  shifts.push(inserted.rows[0])
 }
 return shifts
}
export async function assertShiftAvailable(db,facility,employee,start,end,timezone,exceptId=null) {
 await assertEmploymentRange(db,facility,employee,start,end)
 const overlap=await db.query(`SELECT id FROM payroll_shift WHERE facility_id=$1 AND employee_id=$2 AND status='SCHEDULED' AND scheduled_start<$4 AND scheduled_end>$3 AND ($5::bigint IS NULL OR id<>$5) LIMIT 1`,[facility,employee,start,end,exceptId])
 if(overlap.rows.length)throw fail('This shift overlaps another scheduled shift.',409)
 const leave=await db.query(`SELECT id FROM payroll_employee_request WHERE facility_id=$1 AND employee_id=$2 AND kind='LEAVE' AND status='APPROVED' AND (payload->>'startDate')::date <= (($4::timestamptz-interval '1 microsecond') AT TIME ZONE $5)::date AND (payload->>'endDate')::date >= ($3::timestamptz AT TIME ZONE $5)::date LIMIT 1`,[facility,employee,start,end,timezone])
 if(leave.rows.length)throw fail('This shift conflicts with approved time off. Resolve the leave request before scheduling.',409)
}
