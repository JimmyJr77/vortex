export async function firstShiftReadiness(db,facility,employee,tasks){
 const task=tasks.find(t=>t.task_key==='FIRST_SHIFT')
 const row=(await db.query(`SELECT s.*,p.timezone FROM payroll_shift s JOIN payroll_settings p ON p.facility_id=s.facility_id
  WHERE s.facility_id=$1 AND s.employee_id=$2 AND s.status IN ('SCHEDULED','COMPLETED')
   AND (s.scheduled_start AT TIME ZONE p.timezone)::date >= $3::date ORDER BY s.scheduled_start,s.id LIMIT 1`,[facility,employee.id,employee.hire_date])).rows[0]
 const current=row?{id:Number(row.id),start:new Date(row.scheduled_start).toISOString(),end:new Date(row.scheduled_end).toISOString(),activityType:row.activity_type,location:row.location||'',notes:row.notes||'',timezone:row.timezone}:null
 const saved=task?.response?.firstShift
 const matches=!!current&&!!saved&&Object.entries(current).every(([k,v])=>saved[k]===v)
 const status=task?.status==='NOT_APPLICABLE'?'NOT_REQUIRED':task?.status==='COMPLETE'?(matches?'CURRENT':'NEEDS_REVIEW'):'PENDING'
 return {status,current,reviewed:saved||null}
}
