import {processCheckDocument} from './checkDocument.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function retainCheckDelivery(pool,facility,runId,batchId,employeeId,body,{fetcher,now=()=>new Date(),actorId}={}){
 if(body?.confirmed!==true||body.deliveredInPerson!==true||!Number.isSafeInteger(body.amountCents)||body.amountCents<=0||typeof body.paymentDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.paymentDate)||typeof body.reference!=='string'||body.reference.trim().length<12||body.reference.length>200||/[\u0000-\u001f\u007f]/.test(body.reference))throw fail('Confirm the exact printed check amount, payment date and in-person delivery reference.',400)
 const read=async db=>(await db.query('SELECT i.id,i.amount_cents,i.payment_date::text,d.reference,d.delivery_date::text FROM payroll_check_issue i LEFT JOIN payroll_check_delivery d ON d.issue_id=i.id WHERE i.facility_id=$1 AND i.payroll_run_id=$2 AND i.batch_id=$3 AND i.employee_id=$4',[facility,runId,batchId,employeeId])).rows[0]
 const check=row=>{if(!row)throw fail('Issued check not found.',404);if(Number(row.amount_cents)!==body.amountCents||row.payment_date!==body.paymentDate)throw fail('Delivery must match the retained check amount and approved payment date.');if(row.reference&&row.reference!==body.reference.trim())throw fail('A different check delivery is already retained.');return !!row.reference}
 const initial=await read(pool);if(check(initial))return {status:'DELIVERY_RETAINED',reused:true,reference:initial.reference}
 const verified=await processCheckDocument(pool,facility,runId,batchId,employeeId,{action:'RETAIN',fetcher,now,actorId})
 if(verified.status!=='RETAINED')throw fail(`Check delivery requires current document evidence: ${verified.status.replaceAll('_',' ')}.`)
 const db=await pool.connect()
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
  const run=(await db.query('SELECT status FROM payroll_run WHERE id=$1 AND facility_id=$2 FOR UPDATE',[runId,facility])).rows[0],row=await read(db)
  if(check(row)){await db.query('COMMIT');return {status:'DELIVERY_RETAINED',reused:true,reference:row.reference}}
  if(run?.status!=='APPROVED')throw fail('Only an approved payroll check can receive a new delivery record.')
  const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].timezone
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now())
  if(body.paymentDate!==today)throw fail('Record handoff on the approved payment date. Late or changed delivery dates require payroll review.')
  const proof=(await db.query("SELECT id FROM payroll_check_document_check WHERE issue_id=$1 ORDER BY id DESC LIMIT 1",[row.id])).rows[0]
  const download=(await db.query("SELECT id FROM payroll_check_document_check WHERE issue_id=$1 AND action='DOWNLOAD' AND status='DOWNLOADED' AND created_by=$2 AND created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp() ORDER BY id DESC LIMIT 1",[row.id,actorId])).rows[0]
  if(!download)throw fail('Download and print this retained check before confirming handoff.')
  await db.query('INSERT INTO payroll_check_delivery(issue_id,document_check_id,download_check_id,delivery_date,amount_cents,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[row.id,proof?.id,download.id,body.paymentDate,body.amountCents,body.reference.trim(),actorId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_DELIVERY_RETAINED','check_issue',$3,$4)",[facility,actorId,row.id,{employeeId,amountCents:body.amountCents,paymentDate:body.paymentDate,method:'ADMIN_PRINT_HANDOFF'}])
  await db.query('COMMIT');return {status:'DELIVERY_RETAINED',reused:false,reference:body.reference.trim()}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
export function registerCheckDeliveryRoutes(app,pool,dependencies){
 const path='/api/admin/payroll/runs/:id/payment-authorization/:batchId/checks/:employeeId/delivery'
 const scope=req=>{const [runId,batchId,employeeId]=[req.params.id,req.params.batchId,req.params.employeeId].map(Number);if(![runId,batchId,employeeId].every(n=>Number.isSafeInteger(n)&&n>0))throw fail('Choose an issued check.',400);return {runId,batchId,employeeId,facility:req.canonicalAccess.facilityId}}
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{
  const {runId,batchId,employeeId,facility}=scope(req),row=(await pool.query('SELECT i.id,d.reference,d.delivery_date::text,d.created_at FROM payroll_check_issue i LEFT JOIN payroll_check_delivery d ON d.issue_id=i.id WHERE i.facility_id=$1 AND i.payroll_run_id=$2 AND i.batch_id=$3 AND i.employee_id=$4',[facility,runId,batchId,employeeId])).rows[0]
  if(!row)throw fail('Issued check not found.',404)
  res.json({success:true,data:{status:row.reference?'DELIVERY_RETAINED':'NOT_DELIVERED',reference:row.reference||null,paymentDate:row.delivery_date||null,createdAt:row.created_at||null}})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read check delivery.'})}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const s=scope(req);res.json({success:true,data:await retainCheckDelivery(pool,s.facility,s.runId,s.batchId,s.employeeId,req.body,{...dependencies,actorId:req.adminId})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain check delivery. Review the printed check before closeout.'})}})
}
