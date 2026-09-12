import {processCheckReplacementDocument} from './checkReplacementDocument.js'
import {checkReplacementPlan} from './checkReplacementReview.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function retainCheckReplacementDelivery(pool,facility,runId,batchId,employeeId,authorizationId,body,{fetcher,now=()=>new Date(),actorId}={}){
 if(body?.confirmed!==true||body.deliveredInPerson!==true||!Number.isSafeInteger(body.amountCents)||body.amountCents<=0||typeof body.paymentDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.paymentDate)||typeof body.reference!=='string'||body.reference.trim().length<12||body.reference.length>200||/[\u0000-\u001f\u007f]/.test(body.reference))throw fail('Confirm the exact printed check amount, payment date and in-person delivery reference.',400)
 const read=async db=>(await db.query(`SELECT a.id,a.amount_cents,a.payment_date::text,d.reference,d.delivery_date::text FROM payroll_check_replacement_authorization a JOIN payroll_check_issue i ON i.id=a.issue_id LEFT JOIN payroll_check_replacement_delivery d ON d.authorization_id=a.id WHERE i.facility_id=$1 AND i.payroll_run_id=$2 AND i.batch_id=$3 AND i.employee_id=$4 AND a.id=$5 AND a.method='CHECK'`,[facility,runId,batchId,employeeId,authorizationId])).rows[0]
 const check=row=>{if(!row)throw fail('Issued check not found.',404);if(Number(row.amount_cents)!==body.amountCents||row.payment_date!==body.paymentDate)throw fail('Delivery must match the retained check amount and approved payment date.');if(row.reference&&row.reference!==body.reference.trim())throw fail('A different check delivery is already retained.');return !!row.reference}
 const initial=await read(pool);if(check(initial))return {status:'DELIVERY_RETAINED',reused:true,reference:initial.reference}
 const verified=await processCheckReplacementDocument(pool,facility,runId,batchId,employeeId,authorizationId,{action:'RETAIN',fetcher,now,actorId})
 if(verified.status!=='RETAINED')throw fail(`Check delivery requires current document evidence: ${verified.status.replaceAll('_',' ')}.`)
 const db=await pool.connect()
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
  const run=(await db.query('SELECT status FROM payroll_run WHERE id=$1 AND facility_id=$2 FOR UPDATE',[runId,facility])).rows[0],row=await read(db)
  if(check(row)){await db.query('COMMIT');return {status:'DELIVERY_RETAINED',reused:true,reference:row.reference}}
  if(!['APPROVED','FINALIZED'].includes(run?.status))throw fail('Only an approved payroll check can receive a new delivery record.')
  if((await checkReplacementPlan(db,facility,runId,batchId,employeeId,{requireFresh:false})).issues.length)throw fail('Recover and review the original stopped check before replacement handoff.')
  const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].timezone
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now())
  if(body.paymentDate!==today)throw fail('Record handoff on the approved payment date. Late or changed delivery dates require payroll review.')
  const proof=(await db.query("SELECT id FROM payroll_check_replacement_document_check WHERE authorization_id=$1 ORDER BY id DESC LIMIT 1",[row.id])).rows[0]
  const download=(await db.query("SELECT id FROM payroll_check_replacement_document_check WHERE authorization_id=$1 AND action='DOWNLOAD' AND status='DOWNLOADED' AND created_by=$2 AND created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp() ORDER BY id DESC LIMIT 1",[row.id,actorId])).rows[0]
  if(!download)throw fail('Download and print this retained check before confirming handoff.')
  await db.query('INSERT INTO payroll_check_replacement_delivery(authorization_id,document_check_id,download_check_id,delivery_date,amount_cents,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[row.id,proof?.id,download.id,body.paymentDate,body.amountCents,body.reference.trim(),actorId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_REPLACEMENT_DELIVERY_RETAINED','check_replacement',$3,$4)",[facility,actorId,row.id,{employeeId,amountCents:body.amountCents,paymentDate:body.paymentDate,method:'ADMIN_PRINT_HANDOFF'}])
  await db.query('COMMIT');return {status:'DELIVERY_RETAINED',reused:false,reference:body.reference.trim()}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
export function registerCheckReplacementDeliveryRoutes(app,pool,dependencies){
 const path='/api/admin/payroll/runs/:id/payment-authorization/:batchId/checks/:employeeId/replacement-authorization/:authorizationId/delivery'
 const scope=req=>{const ids=[req.params.id,req.params.batchId,req.params.employeeId].map(Number),id=req.params.authorizationId;if(!ids.every(n=>Number.isSafeInteger(n)&&n>0)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw fail('Choose an issued replacement check.',400);return [req.canonicalAccess.facilityId,...ids,id]}
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await retainCheckReplacementDelivery(pool,...scope(req),req.body,{...dependencies,actorId:req.adminId})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain replacement handoff.'})}})
}
