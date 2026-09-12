import {createHash} from 'node:crypto'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {downloadPayrollDigitalCheck,readPayrollDigitalCheck} from './modernTreasuryChecks.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
export function checkDocumentDownloadOrigins(raw=process.env.PAYROLL_CHECK_DOCUMENT_DOWNLOAD_ORIGINS||''){
 if(typeof raw!=='string')throw fail('Invalid server check download origins.',503)
 return [...new Set(raw.split(',').map(s=>s.trim()).filter(Boolean).map(value=>{let url;try{url=new URL(value)}catch{throw fail('Configure exact trusted HTTPS check download origins.',503)};if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash)throw fail('Configure exact trusted HTTPS check download origins.',503);return url.origin}))]
}
// Manage-only POST routes deliver negotiable documents. No URLs or PDF bytes
// are recorded in ordinary audit/status data, and no provider POST is allowed.
export async function processCheckDocument(pool,facility,runId,batchId,employeeId,{action,fetcher,actorId=null,automatic=false,now=()=>new Date(),allowedDownloadOrigins=checkDocumentDownloadOrigins()}={}){
 if((automatic&&(action!=='RETAIN'||actorId!==null))||(!automatic&&!Number.isSafeInteger(actorId)))throw fail('Check documents require an admin or automatic retention context.',400)
 if(!['RETAIN','DOWNLOAD'].includes(action)||typeof fetcher!=='function')throw fail('Choose a check document action.',400)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  const row=(await db.query('SELECT * FROM payroll_check_issue WHERE facility_id=$1 AND payroll_run_id=$2 AND batch_id=$3 AND employee_id=$4',[facility,runId,batchId,employeeId])).rows[0]
  if(!row)throw fail('Issued check not found.',404)
  if((await db.query('SELECT payroll_check_cancellation_blocks($1) AS blocked',[row.id])).rows[0].blocked)throw fail('Recover the retained provider cancellation before printing or delivering this check.')
  if((await db.query('SELECT payroll_check_stop_blocks($1) AS blocked',[row.id])).rows[0].blocked)throw fail('A stop request is retained for this check. Recover and review it before any further printing or delivery.')
  const first=(await db.query("SELECT result->>'providerId' AS provider_id FROM payroll_check_issue_observation WHERE issue_id=$1 AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1",[row.id])).rows[0]
  if(!first)throw fail('Recover the issued check before retrieving its document.')
  const intent=JSON.parse(decryptDocument(row.encrypted_intent,`payroll-check-issue:${facility}:${runId}:${employeeId}`).toString()),connection=await readPayrollPaymentConnection(db,facility,row.connection_id)
  if(connection.originatingAccountId!==intent.originatingAccountId||connection.mode!==intent.mode)throw fail('Retained check connection does not match.')
  const existing=(await db.query('SELECT * FROM payroll_check_document WHERE issue_id=$1',[row.id])).rows[0]
  const delivered=action==='DOWNLOAD'&&(await db.query('SELECT issue_id FROM payroll_check_delivery WHERE issue_id=$1',[row.id])).rowCount>0
  if(delivered){await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_DOCUMENT_ACCESS_REJECTED','check_issue',$3,$4)",[facility,actorId,row.id,{reason:'ALREADY_DELIVERED'}]);throw fail('This check has already been handed over. Recover its status instead of printing another copy.')}
  let result=action==='DOWNLOAD'&&!existing?{status:'NOT_RETAINED'}:await downloadPayrollDigitalCheck(intent,{...connection,fetcher},{allowedDownloadOrigins,now})
  if(result.status==='PDF_READY'){
   if(result.providerId!==first.provider_id)result={status:'CHECK_IDENTITY_CHANGED'}
   else{
    const payment=await readPayrollDigitalCheck(intent,{...connection,fetcher})
    if(payment.providerId!==first.provider_id)result={status:'CHECK_IDENTITY_CHANGED'}
    else if(payment.status!=='SENT'||payment.dateMatches!==true||payment.expiryMatches!==true||now().getTime()>=Date.parse(payment.expiresAt))result={status:'CHECK_NOT_PAYABLE'}
    else if(action==='DOWNLOAD'){
     const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].timezone
     const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now())
     if(today<intent.paymentDate)result={status:'CHECK_NOT_DUE'}
    }
   }
  }
  if(result.status==='PDF_READY'&&existing&&(existing.provider_id!==result.providerId||existing.document_id!==result.documentId||existing.sha256!==result.sha256))result={status:'DOCUMENT_CHANGED'}
  let bytes
  if(result.status==='PDF_READY'&&action==='DOWNLOAD'){
   bytes=decryptDocument(existing.encrypted_pdf,`payroll-check-document:${row.id}`)
   if(digest(bytes)!==existing.sha256)result={status:'DOCUMENT_INTEGRITY_FAILURE'}
  }
  await db.query('BEGIN')
  const status=result.status==='PDF_READY'?(action==='DOWNLOAD'?'DOWNLOADED':'RETAINED'):result.status
  const metadata=result.status==='PDF_READY'?{providerId:result.providerId,documentId:result.documentId,sha256:result.sha256}:{}
  const check=(await db.query('INSERT INTO payroll_check_document_check(issue_id,action,status,metadata,created_by,automatic) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[row.id,action,status,metadata,actorId,automatic])).rows[0]
  if(status==='RETAINED'&&!existing)await db.query('INSERT INTO payroll_check_document(issue_id,provider_id,document_id,sha256,encrypted_pdf,source_check_id,created_by,automatic) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[row.id,result.providerId,result.documentId,result.sha256,encryptDocument(result.bytes,`payroll-check-document:${row.id}`),check.id,actorId,automatic])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_DOCUMENT_CHECKED','check_issue',$3,$4)",[facility,actorId,row.id,{checkId:Number(check.id),action,status,automatic}])
  const key=`check-document-${row.id}`
  if(['RETAINED','DOWNLOADED'].includes(status))await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,key])
  else await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Check document needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,key,`Employee ${employeeId}: ${status}. Review the retained check before printing or delivery.`])
  await db.query('COMMIT')
  return {status,reused:!!existing,...(status==='DOWNLOADED'?{bytes}: {})}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerCheckDocumentRoutes(app,pool,dependencies){
 const path='/api/admin/payroll/runs/:id/payment-authorization/:batchId/checks/:employeeId/document'
 const scope=req=>{const [runId,batchId,employeeId]=[req.params.id,req.params.batchId,req.params.employeeId].map(Number);if(![runId,batchId,employeeId].every(n=>Number.isSafeInteger(n)&&n>0))throw fail('Choose an issued payroll check.',400);return {runId,batchId,employeeId,facility:req.canonicalAccess.facilityId}}
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{
  const {runId,batchId,employeeId,facility}=scope(req)
  const row=(await pool.query('SELECT i.id,d.created_at,d.sha256 FROM payroll_check_issue i LEFT JOIN payroll_check_document d ON d.issue_id=i.id WHERE i.facility_id=$1 AND i.payroll_run_id=$2 AND i.batch_id=$3 AND i.employee_id=$4',[facility,runId,batchId,employeeId])).rows[0]
  if(!row)throw fail('Issued check not found.',404)
  res.json({success:true,data:{status:row.created_at?'RETAINED':'NOT_RETAINED',retainedAt:row.created_at||null}})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read check document status.'})}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');try{
  const {runId,batchId,employeeId,facility}=scope(req),result=await processCheckDocument(pool,facility,runId,batchId,employeeId,{...dependencies,action:req.body?.action,actorId:req.adminId})
  if(result.status==='DOWNLOADED'){res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="payroll-check-${runId}-${employeeId}.pdf"`);return res.send(result.bytes)}
  if(result.status!=='RETAINED')return res.status(409).json({success:false,message:`Check document needs review: ${result.status.replaceAll('_',' ')}.`})
  res.json({success:true,data:{status:result.status,reused:result.reused}})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retrieve check document. Recover its status before delivery.'})}})
}
