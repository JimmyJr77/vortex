import {payrollEmployeeAuth,lockPayrollEmployeeSession} from './employeeAuth.js'
const day=v=>v instanceof Date?v.toISOString().slice(0,10):v?String(v).slice(0,10):null
const notice=v=>({id:Number(v.id),effectiveOn:day(v.effective_on),schedule:v.schedule_settings,noticeDeliveredOn:day(v.notice_delivered_on),cancelledAt:v.cancelled_at,cancellationNoticeDeliveredOn:day(v.cancellation_notice_delivered_on)})
export function registerEmployeeScheduleNoticeRoutes(app,pool){
 app.get('/api/payroll/employee/pay-schedule-notices',payrollEmployeeAuth(pool),async(req,res)=>{
  try{
   const {facility_id:facility,employee_id:employee}=req.payrollEmployee
   const rows=(await pool.query(`SELECT v.*,a.acknowledged_at,c.acknowledged_at AS cancellation_acknowledged_at FROM payroll_schedule_version v
    LEFT JOIN payroll_schedule_acknowledgment a ON a.schedule_version_id=v.id AND a.employee_id=$2 AND a.facility_id=v.facility_id AND a.notice_kind='CHANGE'
    LEFT JOIN payroll_schedule_acknowledgment c ON c.schedule_version_id=v.id AND c.employee_id=$2 AND c.facility_id=v.facility_id AND c.notice_kind='CANCELLATION'
    WHERE v.facility_id=$1 AND v.notice_delivered_on IS NOT NULL ORDER BY v.effective_on DESC,v.id DESC`,[facility,employee])).rows
   res.json({success:true,data:rows.map(v=>({...notice(v),acknowledgedAt:v.acknowledged_at,cancellationAcknowledgedAt:v.cancellation_acknowledged_at}))})
  }catch{res.status(500).json({success:false,message:'Unable to load pay schedule notices.'})}
 })
 app.post('/api/payroll/employee/pay-schedule-notices/:id/acknowledge',payrollEmployeeAuth(pool),async(req,res)=>{
  if(req.body?.acknowledged!==true)return res.status(400).json({success:false,message:'Confirm receipt of the schedule notice.'})
  const db=await pool.connect(),{facility_id:facility,employee_id:employee}=req.payrollEmployee,kind=req.body.cancellation===true?'CANCELLATION':'CHANGE'
  try{
   await db.query('BEGIN');await lockPayrollEmployeeSession(db,req.payrollEmployee,req)
   await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const version=(await db.query(`SELECT * FROM payroll_schedule_version WHERE facility_id=$1 AND id=$2 AND notice_delivered_on IS NOT NULL
    AND (($3='CHANGE' AND cancelled_at IS NULL) OR ($3='CANCELLATION' AND cancelled_at IS NOT NULL AND cancellation_notice_delivered_on IS NOT NULL))`,[facility,req.params.id,kind])).rows[0]
   if(!version){await db.query('ROLLBACK');return res.status(404).json({success:false,message:'Current schedule notice not found. Refresh the notice list.'})}
   const inserted=(await db.query(`INSERT INTO payroll_schedule_acknowledgment(facility_id,employee_id,schedule_version_id,notice_kind,notice_snapshot) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(employee_id,schedule_version_id,notice_kind) DO NOTHING RETURNING *`,[facility,employee,version.id,kind,notice(version)])).rows[0]
   if(inserted)await db.query(`INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'PAY_SCHEDULE_NOTICE_ACKNOWLEDGED','schedule_acknowledgment',$2,$3)`,[facility,String(inserted.id),{employeeId:employee,scheduleVersionId:version.id,kind,acknowledgedAt:inserted.acknowledged_at}])
   const saved=inserted||(await db.query('SELECT * FROM payroll_schedule_acknowledgment WHERE facility_id=$1 AND employee_id=$2 AND schedule_version_id=$3 AND notice_kind=$4',[facility,employee,version.id,kind])).rows[0]
   await db.query('COMMIT');res.json({success:true,data:{acknowledgedAt:saved.acknowledged_at}})
  }catch(e){await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to acknowledge schedule notice.'})}finally{db.release()}
 })
}
export function registerAdminScheduleNoticeRoutes(app,pool){
 app.get('/api/admin/payroll/pay-schedule/:id/acknowledgments',async(req,res)=>{
  try{
   const facility=req.canonicalAccess.facilityId
   const version=(await pool.query('SELECT id FROM payroll_schedule_version WHERE facility_id=$1 AND id=$2',[facility,req.params.id])).rows[0]
   if(!version)return res.status(404).json({success:false,message:'Schedule version not found.'})
   const rows=(await pool.query(`SELECT e.id AS employee_id,e.legal_first_name,e.legal_last_name,e.employment_status,k.notice_kind,a.acknowledged_at FROM payroll_employee e
    JOIN payroll_schedule_version v ON v.id=$2 AND v.facility_id=e.facility_id
    CROSS JOIN (VALUES ('CHANGE'),('CANCELLATION')) k(notice_kind)
    LEFT JOIN payroll_schedule_acknowledgment a ON a.employee_id=e.id AND a.facility_id=e.facility_id AND a.schedule_version_id=$2 AND a.notice_kind=k.notice_kind
    WHERE e.facility_id=$1 AND (k.notice_kind='CHANGE' OR v.cancelled_at IS NOT NULL) ORDER BY e.legal_last_name,e.legal_first_name,e.id,a.notice_kind`,[facility,version.id])).rows
   res.json({success:true,data:rows})
  }catch{res.status(500).json({success:false,message:'Unable to load schedule acknowledgments.'})}
 })
}
