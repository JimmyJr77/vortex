const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function payrollEmploymentOverlaps(db,facility,employee,start,end){
 const row=(await db.query(`SELECT EXISTS(SELECT 1 FROM payroll_employment_period ep JOIN payroll_employee e ON e.id=ep.employee_id AND e.facility_id=ep.facility_id
  WHERE ep.facility_id=$1 AND ep.employee_id=$2 AND ep.started_on<=$4::date AND (ep.ended_on IS NULL OR ep.ended_on>=$3::date)
  AND (e.employment_status IN ('ACTIVE','LEAVE','TERMINATED') OR (e.employment_status='ONBOARDING' AND ep.started_on<e.hire_date AND ep.ended_on IS NOT NULL))) AS eligible`,[facility,employee,start,end])).rows[0]
 return row?.eligible===true
}
export async function assertEmploymentPaymentDate(db,facility,employee,paymentDate){
 if(typeof paymentDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)||!Number.isFinite(Date.parse(paymentDate))||new Date(paymentDate).toISOString().slice(0,10)!==paymentDate)throw fail('Use a valid payment date.',400)
 const row=(await db.query('SELECT MIN(started_on)::text AS first_hire FROM payroll_employment_period WHERE facility_id=$1 AND employee_id=$2',[facility,employee])).rows[0]
 if(!row?.first_hire)throw fail('Reconcile recorded employment history before making a supplemental payment.')
 if(paymentDate<row.first_hire)throw fail('A supplemental payment cannot precede the first recorded employment date.')
}
export async function assertEmploymentDateRange(db,facility,employee,start,end=start){
 const valid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
 if(!valid(start)||!valid(end)||end<start)throw fail('Use valid leave dates.',400)
 const rows=(await db.query(`SELECT id FROM payroll_employment_period WHERE facility_id=$1 AND employee_id=$2
  AND started_on<=$3::date AND (ended_on IS NULL OR ended_on>=$4::date)`,[facility,employee,start,end])).rows
 if(rows.length!==1)throw fail('Leave dates must fall within one recorded employment period. Review the hire or separation dates before submitting or approving leave.')
 return Number(rows[0].id)
}
export async function assertEmploymentRange(db,facility,employee,start,end=start){
 if(!Number.isFinite(new Date(start).valueOf())||!Number.isFinite(new Date(end).valueOf())||new Date(end)<new Date(start))throw fail('Use a valid employment time range.',400)
 const rows=(await db.query(`SELECT ep.id FROM payroll_employment_period ep JOIN payroll_settings s ON s.facility_id=ep.facility_id
 WHERE ep.facility_id=$1 AND ep.employee_id=$2
 AND ($3::timestamptz AT TIME ZONE s.timezone)::date>=ep.started_on
 AND (ep.ended_on IS NULL OR ((CASE WHEN $4::timestamptz>$3::timestamptz THEN $4::timestamptz-interval '1 microsecond' ELSE $4::timestamptz END) AT TIME ZONE s.timezone)::date<=ep.ended_on)`,[facility,employee,start,end])).rows
 if(!rows.length&&!(await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employee])).rows.length)throw fail('Employee not found.',404)
 if(rows.length!==1)throw fail('Work must fall within one recorded employment period. Review the hire or separation dates before scheduling or recording time.')
 return Number(rows[0].id)
}
export function registerEmploymentPeriodRoutes(app,pool){
 app.get('/api/admin/payroll/employees/:id/employment-periods',async(req,res)=>{try{
 const facility=req.canonicalAccess.facilityId
 if(!(await pool.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,req.params.id])).rows.length)throw fail('Employee not found.',404)
 const rows=(await pool.query('SELECT id,started_on,ended_on,source,pay_type FROM payroll_employment_period WHERE facility_id=$1 AND employee_id=$2 ORDER BY started_on',[facility,req.params.id])).rows
 res.json({success:true,data:rows})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load employment history.'})}})
}
