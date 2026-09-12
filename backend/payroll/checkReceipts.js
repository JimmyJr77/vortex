import {sendReplacementReceipt} from './replacementReceiptDownload.js'
import {replacementCheckReceipts} from './checkReplacementReceipts.js'
import {payrollEmployeeAuth,lockPayrollEmployeeSession} from './employeeAuth.js'
import {decryptDocument} from './onboarding.js'
import {paymentAccountingEvidence} from './paymentAccounting.js'

export async function checkReceipts(db,facility,{employeeId,runId,now=()=>new Date()}={}){
 const rows=(await db.query(`SELECT i.*,payroll_check_stop_blocks(i.id) AS stop_blocked,a.acknowledged_at,d.delivery_date::text,d.created_at AS delivered_at,p.provider_id,e.legal_first_name||' '||e.legal_last_name AS employee_name
  FROM payroll_check_delivery d JOIN payroll_check_issue i ON i.id=d.issue_id
  JOIN payroll_check_document p ON p.issue_id=i.id JOIN payroll_employee e ON e.id=i.employee_id AND e.facility_id=i.facility_id
  LEFT JOIN payroll_check_stop s ON s.issue_id=i.id
  LEFT JOIN payroll_check_receipt_acknowledgment a ON a.issue_id=i.id
  WHERE i.facility_id=$1 AND ($2::bigint IS NULL OR i.employee_id=$2) AND ($3::bigint IS NULL OR i.payroll_run_id=$3)
  ORDER BY d.created_at DESC,i.id`,[facility,employeeId??null,runId??null])).rows
 const receipts=[]
 for(const row of rows){
  const observations=(await db.query('SELECT id,source,result,created_at FROM payroll_check_issue_observation WHERE issue_id=$1 ORDER BY id',[row.id])).rows
  const latest=observations.at(-1),result=latest?.result;let status='NEEDS_REVIEW',bankPostedDates=[]
  if(!row.stop_blocked&&result?.providerId===row.provider_id&&result.dateMatches===true&&result.expiryMatches===true&&result.liveMode===true){
   if(result.status==='SENT'&&Date.parse(result.expiresAt)>now().getTime())status='OUTSTANDING'
   if(result.status==='COMPLETED')try{
    const intent=JSON.parse(decryptDocument(row.encrypted_intent,`payroll-check-issue:${facility}:${row.payroll_run_id}:${row.employee_id}`).toString())
    const evidence=paymentAccountingEvidence({id:row.id,amount_cents:row.amount_cents,mode:intent.mode,originating_account_id:intent.originatingAccountId,payment_rail:'CHECK'},observations)
    if(!evidence.issues.length&&evidence.events.length&&evidence.events.every(e=>e.providerId===row.provider_id)){
     status='BANK_CONFIRMED';bankPostedDates=[...new Set(evidence.events.map(e=>e.postedDate))]
    }
   }catch{/* Preserve delivery history when current bank evidence cannot be verified. */}
  }
  receipts.push({id:row.id,runId:Number(row.payroll_run_id),employeeName:row.employee_name,amountCents:Number(row.amount_cents),paymentDate:row.delivery_date,deliveredAt:row.delivered_at,acknowledgedAt:row.acknowledged_at,status,bankPostedDates,observedAt:latest?.created_at||null})
 }
 return [...receipts,...await replacementCheckReceipts(db,facility,{employeeId,runId,now})].sort((a,b)=>new Date(b.deliveredAt)-new Date(a.deliveredAt)||a.id.localeCompare(b.id))
}
export function registerEmployeeCheckReceiptRoutes(app,pool){
 app.get('/api/payroll/employee/check-receipts/:receiptId/download',payrollEmployeeAuth(pool),async(req,res)=>{
  res.setHeader('Cache-Control','no-store');try{const receipt=(await checkReceipts(pool,req.payrollEmployee.facility_id,{employeeId:req.payrollEmployee.employee_id})).find(r=>r.id===req.params.receiptId);if(!receipt)return res.status(404).json({success:false,message:'Check receipt not found.'});const employer=(await pool.query('SELECT legal_business_name FROM payroll_settings WHERE facility_id=$1',[req.payrollEmployee.facility_id])).rows[0];sendReplacementReceipt(res,{...receipt,employerName:employer?.legal_business_name},{check:true})}catch{res.status(500).json({success:false,message:'Unable to download check receipt.'})}
 })

 app.post('/api/payroll/employee/check-receipts/:id/acknowledge',payrollEmployeeAuth(pool),async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  if(req.body?.acknowledged!==true||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.params.id))return res.status(400).json({success:false,message:'Confirm you received this check.'})
  const db=await pool.connect(),session=req.payrollEmployee
  try{
   await db.query('BEGIN');await lockPayrollEmployeeSession(db,session,req)
   const original=(await db.query('SELECT 1 FROM payroll_check_delivery d JOIN payroll_check_issue i ON i.id=d.issue_id WHERE i.id=$1 AND i.facility_id=$2 AND i.employee_id=$3',[req.params.id,session.facility_id,session.employee_id])).rowCount>0
   const replacement=!original&&(await db.query('SELECT 1 FROM payroll_check_replacement_delivery d JOIN payroll_check_replacement_authorization a ON a.id=d.authorization_id JOIN payroll_check_issue i ON i.id=a.issue_id WHERE a.id=$1 AND i.facility_id=$2 AND i.employee_id=$3',[req.params.id,session.facility_id,session.employee_id])).rowCount>0
   if(!original&&!replacement){await db.query('ROLLBACK');return res.status(404).json({success:false,message:'Check receipt not found.'})}
   const table=replacement?'payroll_check_replacement_receipt_acknowledgment':'payroll_check_receipt_acknowledgment',column=replacement?'authorization_id':'issue_id'
   const inserted=(await db.query(`INSERT INTO ${table}(${column},employee_id,session_id) VALUES($1,$2,$3) ON CONFLICT(${column}) DO NOTHING RETURNING acknowledged_at`,[req.params.id,session.employee_id,session.session_id])).rows[0]
   const saved=inserted||(await db.query(`SELECT acknowledged_at FROM ${table} WHERE ${column}=$1`,[req.params.id])).rows[0]
   if(inserted)await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,$2,$3,$4,$5)",[session.facility_id,replacement?'CHECK_REPLACEMENT_RECEIPT_ACKNOWLEDGED':'CHECK_RECEIPT_ACKNOWLEDGED',replacement?'check_replacement':'check_issue',req.params.id,{employeeId:Number(session.employee_id),acknowledgedAt:saved.acknowledged_at}])
   await db.query('COMMIT');res.json({success:true,data:{acknowledgedAt:saved.acknowledged_at,reused:!inserted}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to acknowledge this check.'})}finally{db.release()}
 })

 app.get('/api/payroll/employee/check-receipts',payrollEmployeeAuth(pool),async(req,res)=>{
  res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await checkReceipts(pool,req.payrollEmployee.facility_id,{employeeId:req.payrollEmployee.employee_id})})}catch{res.status(500).json({success:false,message:'Unable to load check receipts.'})}
 })
}
export function registerCheckReceiptRoutes(app,pool){
 app.get('/api/admin/payroll/runs/:id/check-receipts/:receiptId/download',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');try{const runId=Number(req.params.id);if(!Number.isSafeInteger(runId)||runId<=0)return res.status(400).json({success:false,message:'Choose a payroll run.'});const receipt=(await checkReceipts(pool,req.canonicalAccess.facilityId,{runId})).find(r=>r.id===req.params.receiptId);if(!receipt)return res.status(404).json({success:false,message:'Check receipt not found.'});const employer=(await pool.query('SELECT legal_business_name FROM payroll_settings WHERE facility_id=$1',[req.canonicalAccess.facilityId])).rows[0];sendReplacementReceipt(res,{...receipt,employerName:employer?.legal_business_name},{check:true})}catch{res.status(500).json({success:false,message:'Unable to download check receipt.'})}
 })

 app.get('/api/admin/payroll/runs/:id/check-receipts',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');try{
   const runId=Number(req.params.id),facility=req.canonicalAccess.facilityId
   if(!Number.isSafeInteger(runId)||runId<=0)return res.status(400).json({success:false,message:'Choose a payroll run.'})
   if(!(await pool.query('SELECT id FROM payroll_run WHERE facility_id=$1 AND id=$2',[facility,runId])).rowCount)return res.status(404).json({success:false,message:'Payroll run not found.'})
   res.json({success:true,data:await checkReceipts(pool,facility,{runId})})
  }catch{res.status(500).json({success:false,message:'Unable to load check receipts.'})}
 })
}
