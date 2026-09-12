import {syncFilingIdentityAlert} from './filingIdentityAlerts.js'
import {payrollEmployeeAuth,lockPayrollEmployeeSession} from './employeeAuth.js'
import {readFilingIdentity} from './filingIdentity.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export function registerEmployeeFilingIdentityRoutes(app,pool){
 const auth=payrollEmployeeAuth(pool),path='/api/payroll/employee/filing-identity'
 const latest=async(db,s)=>(await db.query('SELECT id,identifier_last4 FROM payroll_filing_identity WHERE facility_id=$1 AND employee_id=$2 ORDER BY id DESC LIMIT 1',[s.facility_id,s.employee_id])).rows[0]
 app.get(path,auth,async(req,res)=>{try{
  const s=req.payrollEmployee,row=await latest(pool,s);res.setHeader('Cache-Control','no-store')
  if(!row)return res.json({success:true,data:null})
  const identity=await readFilingIdentity(pool,s.facility_id,row.id)
  const review=(await pool.query('SELECT decision,created_at FROM payroll_filing_identity_employee_review WHERE facility_id=$1 AND employee_id=$2 AND identity_id=$3 ORDER BY id DESC LIMIT 1',[s.facility_id,s.employee_id,row.id])).rows[0]||null
  res.json({success:true,data:{revision:Number(row.id),identifierLast4:row.identifier_last4,firstName:identity.firstName,middleName:identity.middleName,lastName:identity.lastName,suffix:identity.suffix,address:identity.address,review}})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load your filing identity. Contact payroll.'})}})
 app.post(`${path}/review`,auth,async(req,res)=>{
  const db=await pool.connect()
  try{
   await db.query('BEGIN');const s=req.payrollEmployee;await lockPayrollEmployeeSession(db,s,req)
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-filing-identity:${s.facility_id}:EMPLOYEE:${s.employee_id}`])
   const row=await latest(db,s),body=req.body||{}
   if(!row||Number(row.id)!==body.revision)throw fail('Your filing identity changed. Refresh the details before reviewing.',409)
   if(body.confirmed!==true||!['CONFIRMED','CORRECTION_REQUESTED'].includes(body.decision))throw fail('Confirm that you reviewed the displayed filing details.')
   const previous=(await db.query('SELECT id,decision FROM payroll_filing_identity_employee_review WHERE facility_id=$1 AND employee_id=$2 AND identity_id=$3 ORDER BY id DESC LIMIT 1',[s.facility_id,s.employee_id,row.id])).rows[0]
   if(previous?.decision===body.decision){await syncFilingIdentityAlert(db,s.facility_id,s.employee_id);await db.query('COMMIT');return res.json({success:true,data:{id:Number(previous.id),reused:true}})}
   const saved=(await db.query('INSERT INTO payroll_filing_identity_employee_review(facility_id,employee_id,identity_id,decision) VALUES($1,$2,$3,$4) RETURNING id',[s.facility_id,s.employee_id,row.id,body.decision])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'EMPLOYEE_FILING_IDENTITY_REVIEWED','filing_identity',$3,$4)",[s.facility_id,null,String(row.id),{employeeId:Number(s.employee_id),decision:body.decision,reviewId:Number(saved.id)}])
   await syncFilingIdentityAlert(db,s.facility_id,s.employee_id)
   await db.query('COMMIT');res.setHeader('Cache-Control','no-store');res.status(201).json({success:true,data:{id:Number(saved.id),reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to save your filing identity review.'})}finally{db.release()}
 })
}
