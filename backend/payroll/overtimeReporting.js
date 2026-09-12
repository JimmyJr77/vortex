import {registerOvertimeQualificationRoutes,overtimeQualificationState} from './overtimeQualification.js'
export {paidOvertimeReview} from './overtimeSource.js'
export function registerOvertimeReportingRoutes(app,pool){
 registerOvertimeQualificationRoutes(app,pool)
 app.get('/api/admin/payroll/reports/overtime-review',async(req,res)=>{try{
  if(String(req.query.year)!=='2026')return res.status(400).json({success:false,message:'Overtime source review currently supports payment year 2026.'})
  const records=await overtimeReportingRecords(pool,req.canonicalAccess.facilityId)
  res.setHeader('Cache-Control','no-store');res.json({success:true,data:{year:2026,records,notice:'Paid premium source review only. FLSA applicability and qualified overtime reporting require separate review. Imported payments are not included.'}})
 }catch{res.status(500).json({success:false,message:'Unable to review overtime payment sources.'})}})
}

export async function overtimeReportingRecords(db,facility){
 const rows=(await db.query(`SELECT re.*,r.facility_id,r.run_kind,r.calculation_snapshot,r.id AS run_id,(SELECT to_jsonb(q) FROM payroll_overtime_qualification q WHERE q.facility_id=r.facility_id AND q.run_employee_id=re.id ORDER BY q.id DESC LIMIT 1) AS qualification_review,(SELECT jsonb_agg(to_jsonb(h) ORDER BY h.id DESC) FROM payroll_overtime_qualification h WHERE h.facility_id=r.facility_id AND h.run_employee_id=re.id) AS qualification_history,COALESCE(r.payment_date,p.pay_date) AS payment_date,e.employee_number
   FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_employee e ON e.id=re.employee_id AND e.facility_id=r.facility_id
   WHERE r.facility_id=$1 AND r.status='FINALIZED' AND COALESCE(r.payment_date,p.pay_date)>='2026-01-01' AND COALESCE(r.payment_date,p.pay_date)<'2027-01-01' ORDER BY e.id,r.id`,[facility])).rows
 return rows.map(row=>({runId:Number(row.run_id),employeeId:Number(row.employee_id),employeeNumber:row.employee_number,paymentDate:new Date(row.payment_date).toISOString().slice(0,10),...overtimeQualificationState(row)}))
}
