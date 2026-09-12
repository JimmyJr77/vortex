import {sendReplacementReceipt} from './replacementReceiptDownload.js'
import {checkReplacementAchReceipts} from './checkReplacementAchReceipt.js'
import {payrollEmployeeAuth} from './employeeAuth.js'

// Called inside the observation transaction. A receipt records bank evidence,
// not another wage statement or confirmation of the employee's account balance.
export async function retainReplacementReceipt(db,authorizationId,observationId){
 return (await db.query(`INSERT INTO payroll_payment_replacement_receipt(authorization_id,observation_id,snapshot)
  SELECT a.id,o.id,jsonb_build_object('amountCents',a.amount_cents,'paymentDate',a.intent->>'paymentDate','originalPaymentDate',i.payment_date::text,'account',a.account_summary,'providerId',o.result->>'providerId','settlementEvidence',o.result->'settlementEvidence')
  FROM payroll_payment_replacement_authorization a JOIN payroll_payment_instruction i ON i.id=a.instruction_id
  JOIN payroll_payment_replacement_observation o ON o.authorization_id=a.id AND o.id=$2
  WHERE a.id=$1 AND o.source='RECOVERY' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED' AND o.result->>'dateMatches'='true' AND o.result->>'liveMode'='true'
  ON CONFLICT(authorization_id) DO NOTHING RETURNING authorization_id`,[authorizationId,observationId])).rowCount===1
}
export async function replacementReceipts(db,facility,{employeeId,runId}={}){
 const rows=(await db.query(`SELECT r.*,a.employee_id,a.payroll_run_id,e.legal_first_name||' '||e.legal_last_name AS employee_name,o.result,o.source
  FROM payroll_payment_replacement_receipt r JOIN payroll_payment_replacement_authorization a ON a.id=r.authorization_id
  JOIN payroll_employee e ON e.id=a.employee_id AND e.facility_id=a.facility_id
  LEFT JOIN LATERAL(SELECT result,source FROM payroll_payment_replacement_observation WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1)o ON true
  WHERE a.facility_id=$1 AND ($2::bigint IS NULL OR a.employee_id=$2) AND ($3::bigint IS NULL OR a.payroll_run_id=$3)
  ORDER BY r.created_at DESC,r.authorization_id`,[facility,employeeId??null,runId??null])).rows
 const receipts=rows.map(row=>({id:row.authorization_id,runId:Number(row.payroll_run_id),employeeName:row.employee_name,amountCents:Number(row.snapshot.amountCents),paymentDate:row.snapshot.paymentDate,originalPaymentDate:row.snapshot.originalPaymentDate,account:row.snapshot.account,bankPostedDates:row.snapshot.settlementEvidence.map(e=>e.postedDate),createdAt:row.created_at,status:row.source==='RECOVERY'&&row.result?.status==='COMPLETED'&&row.result?.settlementStatus==='BANK_POSTED'&&row.result?.dateMatches===true&&row.result?.liveMode===true&&row.result?.providerId===row.snapshot.providerId&&JSON.stringify(row.result.settlementEvidence)===JSON.stringify(row.snapshot.settlementEvidence)?'BANK_CONFIRMED':'NEEDS_REVIEW'}))
 return [...receipts,...await checkReplacementAchReceipts(db,facility,{employeeId,runId})].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)||a.id.localeCompare(b.id))
}
export function registerEmployeeReplacementReceiptRoutes(app,pool){
 app.get('/api/payroll/employee/payment-replacement-receipts/:receiptId/download',payrollEmployeeAuth(pool),async(req,res)=>{
  res.setHeader('Cache-Control','no-store');try{const receipt=(await replacementReceipts(pool,req.payrollEmployee.facility_id,{employeeId:req.payrollEmployee.employee_id})).find(r=>r.id===req.params.receiptId);if(!receipt)return res.status(404).json({success:false,message:'Replacement receipt not found.'});sendReplacementReceipt(res,{...receipt,employerName:(await pool.query('SELECT legal_business_name FROM payroll_settings WHERE facility_id=$1',[req.payrollEmployee.facility_id])).rows[0]?.legal_business_name})}catch{res.status(500).json({success:false,message:'Unable to download replacement receipt.'})}
 })

 app.get('/api/payroll/employee/payment-replacement-receipts',payrollEmployeeAuth(pool),async(req,res)=>{
  res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await replacementReceipts(pool,req.payrollEmployee.facility_id,{employeeId:req.payrollEmployee.employee_id})})}catch{res.status(500).json({success:false,message:'Unable to load replacement payment receipts.'})}
 })
}
export function registerReplacementReceiptRoutes(app,pool){
 app.get('/api/admin/payroll/runs/:id/payment-replacement-receipts/:receiptId/download',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');try{const runId=Number(req.params.id);if(!Number.isSafeInteger(runId)||runId<=0)return res.status(400).json({success:false,message:'Choose a payroll run.'});const receipt=(await replacementReceipts(pool,req.canonicalAccess.facilityId,{runId})).find(r=>r.id===req.params.receiptId);if(!receipt)return res.status(404).json({success:false,message:'Replacement receipt not found.'});sendReplacementReceipt(res,{...receipt,employerName:(await pool.query('SELECT legal_business_name FROM payroll_settings WHERE facility_id=$1',[req.canonicalAccess.facilityId])).rows[0]?.legal_business_name})}catch{res.status(500).json({success:false,message:'Unable to download replacement receipt.'})}
 })

 app.get('/api/admin/payroll/runs/:id/payment-replacement-receipts',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');try{const runId=Number(req.params.id);if(!Number.isSafeInteger(runId)||runId<=0)return res.status(400).json({success:false,message:'Choose a payroll run.'});if(!(await pool.query('SELECT 1 FROM payroll_run WHERE id=$1 AND facility_id=$2',[runId,req.canonicalAccess.facilityId])).rowCount)return res.status(404).json({success:false,message:'Payroll run not found.'});res.json({success:true,data:await replacementReceipts(pool,req.canonicalAccess.facilityId,{runId})})}catch{res.status(500).json({success:false,message:'Unable to load replacement payment receipts.'})}
 })
}
