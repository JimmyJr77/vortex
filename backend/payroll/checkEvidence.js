const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const categories=['ORIGINAL','STOP','CANCELLATION']
const state=value=>typeof value==='string'&&/^[A-Z_]{1,50}$/.test(value)?value:null
const truth=value=>typeof value==='boolean'?value:null
function decodeCursor(value,issueId){
 if(value===undefined)return null
 try{
  if(typeof value!=='string'||value.length>600||!/^[A-Za-z0-9_-]+$/.test(value))throw Error()
  const c=JSON.parse(Buffer.from(value,'base64url').toString())
  if(c.issueId!==issueId||!categories.includes(c.kind)||typeof c.id!=='string'||!/^\d{1,19}$/.test(c.id)||(BigInt(c.id)<1n||BigInt(c.id)>9223372036854775807n)||typeof c.at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(c.at)||Number(c.at.slice(0,4))<1||!Number.isFinite(Date.parse(c.at))||new Date(c.at).toISOString().slice(0,23)!==c.at.slice(0,23))throw Error()
  return c
 }catch{throw fail('Refresh check evidence before loading older observations.')}
}
function project(row,providerId){
 const result=row.result||{},payment=row.kind==='CANCELLATION'?(result.payment||{}):result,stop=row.kind==='STOP'
 const checkStatus=state(stop?result.checkStatus:payment.status),reconciliationStatus=stop?result.checkReconciliationStatus:payment.reconciliationStatus
 return {key:`${row.kind}:${row.id}`,category:row.kind,source:row.source,observedAt:row.at,status:state(result.status),checkStatus,attempt:Number(row.attempt),
  paidObserved:result.checkPaidObserved===true||checkStatus==='COMPLETED'||reconciliationStatus==='reconciled',
  identityMismatch:Boolean(providerId)&&[payment.providerId,payment.finalProviderId].some(id=>typeof id==='string'&&id!==providerId),conflictingEvidence:result.checkConflictObserved===true,
  dateMatches:truth(stop?result.checkDateMatches:payment.dateMatches),expiryMatches:truth(stop?result.checkExpiryMatches:payment.expiryMatches),liveMode:truth(stop?result.checkLiveMode:payment.liveMode),
  reconciliationStatus:['reconciled','unreconciled'].includes(reconciliationStatus)?reconciliationStatus:null,settlementStatus:state(payment.settlementStatus),requestSent:truth(result.requestSent)}
}
export async function readCheckEvidence(pool,facility,runId,batchId,employeeId,cursor){
 const issue=(await pool.query("SELECT i.id,to_char(i.payment_date,'YYYY-MM-DD') AS payment_date,i.amount_cents,(SELECT result->>'providerId' FROM payroll_check_issue_observation WHERE issue_id=i.id AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1) AS provider_id FROM payroll_check_issue i WHERE i.facility_id=$1 AND i.payroll_run_id=$2 AND i.batch_id=$3 AND i.employee_id=$4",[facility,runId,batchId,employeeId])).rows[0]
 if(!issue)throw fail('Issued check not found.',404)
 const c=decodeCursor(cursor,issue.id)
 const rows=(await pool.query(`WITH observations AS (
 SELECT 'ORIGINAL'::text AS kind,o.id,o.created_at,o.source,o.result,1::bigint AS attempt FROM payroll_check_issue_observation o WHERE o.issue_id=$1
 UNION ALL
 SELECT 'STOP',o.id,o.created_at,o.source,o.result,CASE WHEN o.retry_id IS NULL THEN 1 ELSE 1+(SELECT count(*) FROM payroll_check_stop_retry r WHERE r.stop_id=s.id AND r.sequence<=(SELECT sequence FROM payroll_check_stop_retry WHERE id=o.retry_id)) END FROM payroll_check_stop_observation o JOIN payroll_check_stop s ON s.id=o.stop_id WHERE s.issue_id=$1
 UNION ALL
 SELECT 'CANCELLATION',o.id,o.created_at,o.source,o.result,CASE WHEN o.retry_id IS NULL THEN 1 ELSE 1+(SELECT count(*) FROM payroll_check_cancellation_retry r WHERE r.cancellation_id=c.id AND (r.created_at,r.id)<=(SELECT created_at,id FROM payroll_check_cancellation_retry WHERE id=o.retry_id)) END FROM payroll_check_cancellation_observation o JOIN payroll_check_cancellation c ON c.id=o.cancellation_id WHERE c.issue_id=$1
 ) SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at FROM observations WHERE $2::timestamptz IS NULL OR (created_at,kind,id)<($2::timestamptz,$3::text,$4::bigint) ORDER BY created_at DESC,kind DESC,id DESC LIMIT 21`,[issue.id,c?.at||null,c?.kind||null,c?.id||null])).rows
 const page=rows.slice(0,20),last=page.at(-1)
 return {paymentDate:issue.payment_date,amountCents:Number(issue.amount_cents),entries:page.map(row=>project(row,issue.provider_id)),nextCursor:rows.length>20?Buffer.from(JSON.stringify({issueId:issue.id,at:last.at,kind:last.kind,id:last.id})).toString('base64url'):null}
}
export function registerCheckEvidenceRoutes(app,pool){
 app.get('/api/admin/payroll/runs/:id/payment-authorization/:batchId/checks/:employeeId/evidence',async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{const ids=[req.params.id,req.params.batchId,req.params.employeeId].map(Number);if(!ids.every(id=>Number.isSafeInteger(id)&&id>0))throw fail('Choose an issued payroll check.');res.json({success:true,data:await readCheckEvidence(pool,req.canonicalAccess.facilityId,...ids,req.query.cursor)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read retained check evidence.'})}
 })
}
