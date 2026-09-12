import {createHash} from 'node:crypto'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {downloadPayrollDigitalCheck,readPayrollDigitalCheck} from './modernTreasuryChecks.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
import {checkDocumentDownloadOrigins} from './checkDocument.js'
import {checkReplacementContext} from './checkReplacementAuthorization.js'
import {checkReplacementPlan} from './checkReplacementReview.js'
// Manage-only POST routes deliver negotiable documents. No URLs or PDF bytes
// are recorded in ordinary audit/status data, and no provider POST is allowed.
export async function processCheckReplacementDocument(pool,facility,runId,batchId,employeeId,authorizationId,{action,fetcher,actorId=null,automatic=false,now=()=>new Date(),allowedDownloadOrigins=checkDocumentDownloadOrigins()}={}){
 if((automatic&&(action!=='RETAIN'||actorId!==null))||(!automatic&&!Number.isSafeInteger(actorId)))throw fail('Check documents require an admin or automatic retention context.',400)
 if(!['RETAIN','DOWNLOAD'].includes(action)||typeof fetcher!=='function')throw fail('Choose a check document action.',400)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  const row=(await db.query(`SELECT a.* FROM payroll_check_replacement_authorization a JOIN payroll_check_issue i ON i.id=a.issue_id JOIN payroll_check_replacement_claim t ON t.authorization_id=a.id LEFT JOIN payroll_check_replacement_cancellation c ON c.authorization_id=a.id WHERE a.id=$5 AND i.facility_id=$1 AND i.payroll_run_id=$2 AND i.batch_id=$3 AND i.employee_id=$4 AND a.method='CHECK' AND c.authorization_id IS NULL`,[facility,runId,batchId,employeeId,authorizationId])).rows[0]
  if(!row)throw fail('Issued check not found.',404)
  if(action==='DOWNLOAD'&&(await db.query('SELECT 1 FROM payroll_check_replacement_delivery WHERE authorization_id=$1',[row.id])).rowCount){await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_REPLACEMENT_DOCUMENT_ACCESS_REJECTED','check_replacement',$3,$4)",[facility,actorId,row.id,{reason:'ALREADY_DELIVERED'}]);throw fail('This replacement check has already been handed over. Recover its status instead of printing another copy.')}
  const original=await checkReplacementPlan(db,facility,runId,batchId,employeeId,{requireFresh:false})
  if(original.issues.length)throw fail('Recover and resolve the original stopped-check evidence before printing its replacement.')
  const first=(await db.query("SELECT result->>'providerId' AS provider_id FROM payroll_check_replacement_observation WHERE authorization_id=$1 AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1",[row.id])).rows[0]
  if(!first)throw fail('Recover the issued check before retrieving its document.')
  const intent=JSON.parse(decryptDocument(row.encrypted_intent,checkReplacementContext(row.id)).toString()),connection=await readPayrollPaymentConnection(db,facility,intent.connectionId)
  if(connection.originatingAccountId!==intent.originatingAccountId||connection.mode!==intent.mode)throw fail('Retained check connection does not match.')
  const existing=(await db.query('SELECT * FROM payroll_check_replacement_document WHERE authorization_id=$1',[row.id])).rows[0]
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
   bytes=decryptDocument(existing.encrypted_pdf,`payroll-check-replacement-document:${row.id}`)
   if(digest(bytes)!==existing.sha256)result={status:'DOCUMENT_INTEGRITY_FAILURE'}
  }
  await db.query('BEGIN')
  const status=result.status==='PDF_READY'?(action==='DOWNLOAD'?'DOWNLOADED':'RETAINED'):result.status
  const metadata=result.status==='PDF_READY'?{providerId:result.providerId,documentId:result.documentId,sha256:result.sha256}:{}
  const check=(await db.query('INSERT INTO payroll_check_replacement_document_check(authorization_id,action,status,metadata,created_by,automatic) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[row.id,action,status,metadata,actorId,automatic])).rows[0]
  if(status==='RETAINED'&&!existing)await db.query('INSERT INTO payroll_check_replacement_document(authorization_id,provider_id,document_id,sha256,encrypted_pdf,source_check_id,created_by,automatic) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[row.id,result.providerId,result.documentId,result.sha256,encryptDocument(result.bytes,`payroll-check-replacement-document:${row.id}`),check.id,actorId,automatic])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_REPLACEMENT_DOCUMENT_CHECKED','check_replacement',$3,$4)",[facility,actorId,row.id,{checkId:Number(check.id),action,status,automatic}])
  const key=`check-replacement-document-${row.id}`
  if(['RETAINED','DOWNLOADED'].includes(status))await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,key])
  else await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Check document needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,key,`Employee ${employeeId}: ${status}. Review the retained check before printing or delivery.`])
  await db.query('COMMIT')
  return {status,reused:!!existing,...(status==='DOWNLOADED'?{bytes}: {})}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerCheckReplacementDocumentRoutes(app,pool,dependencies){
 const path='/api/admin/payroll/runs/:id/payment-authorization/:batchId/checks/:employeeId/replacement-authorization/:authorizationId/document'
 const scope=req=>{const ids=[req.params.id,req.params.batchId,req.params.employeeId].map(Number),id=req.params.authorizationId;if(!ids.every(n=>Number.isSafeInteger(n)&&n>0)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw fail('Choose an issued replacement check.',400);return [req.canonicalAccess.facilityId,...ids,id]}
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');try{
  const ids=scope(req),result=await processCheckReplacementDocument(pool,...ids,{...dependencies,action:req.body?.action,actorId:req.adminId})
  if(result.status==='DOWNLOADED'){res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="payroll-replacement-check-${ids[4]}.pdf"`);return res.send(result.bytes)}
  if(result.status!=='RETAINED')return res.status(409).json({success:false,message:`Replacement document needs review: ${result.status.replaceAll('_',' ')}.`})
  res.json({success:true,data:{status:result.status,reused:result.reused}})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retrieve replacement check document.'})}})
}
