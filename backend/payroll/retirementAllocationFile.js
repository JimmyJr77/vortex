import {retirementReceiptContractHistory} from './retirementReceiptContract.js'
import {createHmac} from 'node:crypto'
import {retirementRemittancePreview} from './retirementRemittancePreview.js'
import {retirementAllocationFormatHistory,allocationFields,employerAllocationFields} from './retirementAllocationFormat.js'
import {readRetirementParticipantMapping} from './retirementParticipantMapping.js'
import {vaultReady} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const quote=x=>`"${String(x).replaceAll('"','""')}"`
const safeIdentifier=x=>{if(typeof x!=='string'||!x||/[\u0000-\u001f\u007f]/.test(x)||/^[\s]*[=+@-]/.test(x))throw fail('A recordkeeper identifier needs a different verified export format; spreadsheet-active prefixes cannot be exported here.');return x}
export function retirementAllocationCsv(format,rows){
 const fields=format?.columns?.map(c=>c.field)||[]
 if(!['CENTS','DOLLARS'].includes(format?.amountFormat)||!['ISO','US'].includes(format?.dateFormat)||typeof format?.includeHeader!=='boolean'||![allocationFields.length,allocationFields.length+employerAllocationFields.length].includes(fields.length)||new Set(fields).size!==fields.length||allocationFields.some(field=>!fields.includes(field))||fields.some(field=>![...allocationFields,...employerAllocationFields].includes(field)))throw fail('Use complete retained allocation columns and exact amount/date formats.')
 const employerIncluded=employerAllocationFields.every(field=>format.columns.some(c=>c.field===field))
 const categories=['ordinaryPretaxCents','ordinaryRothCents','catchUpPretaxCents','catchUpRothCents',...(employerIncluded?employerAllocationFields:[])]
 const result=[]
 if(format.includeHeader)result.push(format.columns.map(c=>quote(c.header)).join(','))
 for(const row of rows){
  const values={...row,providerPlanId:safeIdentifier(row.providerPlanId),participantId:safeIdentifier(row.participantId)}
  if(!employerIncluded&&employerAllocationFields.some(field=>row[field]!==undefined&&row[field]!==0))throw fail('The reviewed allocation format must include both employer contribution columns.')
  for(const field of [...categories,'totalCents']){
   const cents=row[field];if(!Number.isSafeInteger(cents)||cents<0)throw fail('Allocation amounts must be exact nonnegative cents.')
   values[field]=format.amountFormat==='CENTS'?String(cents):`${Math.floor(cents/100)}.${String(cents%100).padStart(2,'0')}`
  }
  if(!Number.isSafeInteger(categories.reduce((sum,field)=>sum+row[field],0))||categories.reduce((sum,field)=>sum+row[field],0)!==row.totalCents)throw fail('Allocation categories do not reconcile to the employee total.')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(row.withheldDate)||!Number.isFinite(Date.parse(row.withheldDate))||new Date(row.withheldDate).toISOString().slice(0,10)!==row.withheldDate)throw fail('Review the actual withholding date before allocation.')
  if(format.dateFormat==='US')values.withheldDate=`${row.withheldDate.slice(5,7)}/${row.withheldDate.slice(8,10)}/${row.withheldDate.slice(0,4)}`
  result.push(format.columns.map(c=>quote(values[c.field])).join(','))
 }
 return `${result.join('\r\n')}\r\n`
}
export async function retirementAllocationFile(db,facility,runId,input,{fetcher=fetch,now=new Date()}={}){
 if(!vaultReady())throw fail('Configure encrypted document storage before preparing recordkeeper allocations.',503)
 const preview=await retirementRemittancePreview(db,facility,runId,input,{fetcher,now})
 const {history}=await retirementAllocationFormatHistory(db,facility,input.planId),format=history[0]
 if(!format||!format.currentPlan||format.format.disposition!=='VERIFIED')throw fail('Review the current recordkeeper allocation format before preparing a file.')
 const employerColumns=employerAllocationFields.every(field=>format.format.columns.some(c=>c.field===field))
 let employerReceiptContractId=null
 if(employerColumns){
  const receipt=await retirementReceiptContractHistory(db,facility,input.planId)
  if(receipt.status!=='CURRENT'||!receipt.employerContributionsIncluded)throw fail('Review the matching employer provider receipt contract before file preparation.')
  employerReceiptContractId=receipt.history[0].id
 }
 if(!preview.timing?.reviewId||['PLAN_CHANGED','SUSPENDED','REVIEW_REQUIRED','EMPLOYER_TIMING_REVIEW_REQUIRED','CALENDAR_REVIEW_REQUIRED','ADVANCE_SUBMISSION_REVIEW_REQUIRED'].includes(preview.timing.status))throw fail('Review current contribution timing before preparing recordkeeper allocations.')
 const allocations=preview.allocations.map(a=>employerColumns?{...a,employerMatchingCents:a.employerMatchingCents??0,employerNonelectiveCents:a.employerNonelectiveCents??0}:a)
 const rows=[]
 for(const a of allocations){const mapping=await readRetirementParticipantMapping(db,facility,a.employeeId,input.planId);if(mapping.id!==a.participantMapping.mappingId)throw fail('Participant mapping changed. Refresh the contribution review.');rows.push({...a,...mapping.identifiers,withheldDate:preview.withheldDate})}
 const csv=retirementAllocationCsv(format.format,rows)
 const fingerprint=createHmac('sha256',Buffer.from(process.env.PAYROLL_DOCUMENT_KEY,'hex')).update(JSON.stringify({kind:'retirement-allocation-file',previewFingerprint:preview.fingerprint,formatId:format.id,...(employerReceiptContractId?{employerReceiptContractId}:{}),csv})).digest('hex')
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
 const authorizationWindowOpen=today>=preview.withheldDate&&['UPCOMING','SUBMISSION_DUE_TODAY'].includes(preview.timing.status)&&new Date(now)<new Date(preview.timing.submissionAt)
 const summary={authorizationWindowOpen,fingerprint,...(employerReceiptContractId?{employerReceiptContractId}:{}),formatId:format.id,formatRevision:format.revision,runId:preview.runId,planId:preview.planId,planName:preview.planName,planRevisionId:preview.planRevisionId,destinationRevisionId:preview.destinationRevisionId,fundingRevisionId:preview.fundingRevisionId,destination:preview.destination,withheldDate:preview.withheldDate,amountCents:preview.amountCents,rowCount:rows.length,columns:format.format.columns,amountFormat:format.format.amountFormat,dateFormat:format.format.dateFormat,includeHeader:format.format.includeHeader,timing:preview.timing,allocations,status:'PREPARED_NOT_SENT'}
 return {summary,csv}
}
export function registerRetirementAllocationFileRoutes(app,pool,{fetcher=fetch,now=()=>new Date()}={}){
 const base='/api/admin/payroll/runs/:id/retirement-allocation-file'
 const serve=download=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  const input=req.body||{},facility=req.canonicalAccess.facilityId
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  const file=await retirementAllocationFile(db,facility,req.params.id,input,{fetcher,now:now()})
  if(download&&input.fingerprint!==file.summary.fingerprint)throw fail('Allocation evidence changed. Prepare and review a fresh file before downloading.')
  if(download)await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_ALLOCATION_DOWNLOADED','payroll_run',$3,$4)",[facility,req.adminId,String(req.params.id),{planId:input.planId,formatId:file.summary.formatId,fingerprint:file.summary.fingerprint,rowCount:file.summary.rowCount,amountCents:file.summary.amountCents}])
  await db.query('COMMIT')
  if(!download)return res.json({success:true,data:file.summary})
  res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="retirement-allocation-${file.summary.runId}.csv"`);res.setHeader('X-Content-Type-Options','nosniff');res.send(file.csv)
 }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to prepare recordkeeper allocations.'})}finally{db.release()}}
 app.post(base,serve(false));app.post(`${base}/download`,serve(true))
}
