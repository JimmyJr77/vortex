import {checkReplacementPlan} from './checkReplacementReview.js'
import {decryptDocument} from './onboarding.js'
import {createHash} from 'node:crypto'
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const amount=value=>Number.isSafeInteger(value)&&value>0
const canonical=events=>JSON.stringify(events.map(({observationId,...event})=>event).sort((a,b)=>a.key.localeCompare(b.key)))
// These are bank movements for reconciliation, not new wages, payroll taxes or
// permission to transmit a replacement. Every event retains its source evidence.
export function paymentAccountingEvidence(instruction,observations){
 const check=instruction.payment_rail==='CHECK',id=instruction.id,net=Number(instruction.amount_cents),issues=[],groups={WITHDRAWAL:[],RETURN:[]}
 if(!uuid(id)||!uuid(instruction.originating_account_id)||!amount(net)||instruction.mode!=='LIVE')return {events:[],issues:['A retained live payment instruction is required.']}
 for(const observation of observations){
  const result=observation.result||{},withdrawal=result.settlementStatus==='BANK_POSTED',returned=result.returnEvidenceStatus==='BANK_CREDIT_POSTED'
  if(!withdrawal&&!returned)continue
  try{
   if(observation.source!=='RECOVERY'||result.liveMode!==true||!uuid(result.providerId)||result.externalId!==`vortex_payroll_${check?'check_':''}${id}`||result.dateMatches!==true||(check&&(result.expiryMatches!==true||returned)))throw new Error()
   const kind=withdrawal?'WITHDRAWAL':'RETURN'
   if(withdrawal&&(returned||result.status!=='COMPLETED'||result.reconciliationStatus!=='reconciled'))throw new Error()
   if(returned&&result.status!=='RETURNED')throw new Error()
   const parts=withdrawal?result.settlementEvidence:[result.returnEvidence]
   if(!Array.isArray(parts)||!parts.length||parts.length>10)throw new Error()
   const seen=new Set(),transactions=new Set();let total=0
   const events=parts.map(part=>{
    if(!part||!uuid(part.transactionId)||transactions.has(part.transactionId)||!date(part.postedDate)||!amount(part.amountCents))throw new Error()
    transactions.add(part.transactionId)
    const lines=withdrawal?part.lineItems:[{id:part.lineItemId,amountCents:part.amountCents}]
    if(!Array.isArray(lines)||!lines.length||lines.some(line=>!uuid(line.id)||seen.has(line.id)||!amount(line.amountCents)||!seen.add(line.id))||lines.reduce((n,line)=>n+line.amountCents,0)!==part.amountCents)throw new Error()
    if(returned&&!uuid(part.returnId))throw new Error()
    total+=part.amountCents;if(!Number.isSafeInteger(total))throw new Error()
    return {key:`${id}:${kind}:${part.transactionId}`,instructionId:id,fundingAccountId:instruction.originating_account_id,mode:'LIVE',providerId:result.providerId,kind,transactionId:part.transactionId,postedDate:part.postedDate,amountCents:part.amountCents,lineItemIds:lines.map(line=>line.id).sort(),returnId:returned?part.returnId:null,observationId:Number(observation.id)}
   })
   if(total!==net)throw new Error()
   groups[kind].push(events)
  }catch{issues.push('Bank evidence is incomplete or conflicts with the retained payment. Recover and review it before accounting.')}
 }
 const latest=observations.at(-1)?.result
 if(latest?.status==='RETURNED'&&latest.returnEvidenceStatus!=='BANK_CREDIT_POSTED')issues.push('The returned payment still needs posted-credit evidence.')
 else if(observations.length&&(!['COMPLETED','RETURNED'].includes(latest?.status)||(latest.status==='COMPLETED'&&latest.settlementStatus!=='BANK_POSTED')))issues.push('Current provider status still needs bank reconciliation.')
 const events=[]
 for(const candidates of Object.values(groups)){
  if(!candidates.length)continue
  if(new Set(candidates.map(canonical)).size!==1){issues.push('Retained bank evidence changed. Reconcile the conflicting transactions before accounting.');continue}
  events.push(...candidates.at(-1))
 }
 if(new Set(events.map(event=>event.providerId)).size>1)issues.push('Bank movements identify different provider payments.')
 if(events.some(event=>event.kind==='RETURN')&&!events.some(event=>event.kind==='WITHDRAWAL'))issues.push('Returned funds have evidence, but the original bank withdrawal still needs reconciliation.')
 return {events:events.sort((a,b)=>a.postedDate.localeCompare(b.postedDate)||a.key.localeCompare(b.key)),issues:[...new Set(issues)]}
}
export function registerPaymentAccountingRoutes(app,pool){
 app.get('/api/admin/payroll/runs/:id/payment-accounting',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const runId=Number(req.params.id),facility=req.canonicalAccess.facilityId
   if(!Number.isSafeInteger(runId)||runId<=0)return res.status(400).json({success:false,message:'Choose a payroll run.'})
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
   const data=await payrollBankAccounting(db,facility,runId)
   await db.query('COMMIT');res.json({success:true,data})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to reconcile payroll bank movements.'})}finally{db.release()}
 })
}

export async function payrollBankAccounting(db,facility,runId,{allowApproved=false}={}){
   const run=(await db.query('SELECT id,status FROM payroll_run WHERE facility_id=$1 AND id=$2',[facility,runId])).rows[0]
   if(!run)throw Object.assign(new Error('Payroll run not found.'),{status:404})
   const rows=(await db.query(`SELECT i.*,b.plan,a.id AS attempt_id FROM payroll_payment_batch b JOIN payroll_payment_batch_instruction l ON l.batch_id=b.id JOIN payroll_payment_instruction i ON i.id=l.instruction_id LEFT JOIN payroll_payment_dispatch_attempt a ON a.instruction_id=i.id AND a.batch_id=b.id WHERE b.facility_id=$1 AND b.payroll_run_id=$2`,[facility,runId])).rows
   const events=[],issues=[],seen=new Set()
   if(run.status!=='FINALIZED'&&!(allowApproved&&run.status==='APPROVED'))issues.push('Finalize reconciled payroll before recording its accounting.')
   for(const row of rows){
    const observations=row.attempt_id?(await db.query('SELECT id,source,result FROM payroll_payment_observation WHERE attempt_id=$1 ORDER BY id',[row.attempt_id])).rows:[]
    const evidence=paymentAccountingEvidence(row,observations),employeeName=row.plan.payments.find(p=>p.employeeId===Number(row.employee_id))?.employeeName||`Employee ${row.employee_id}`
    if(!evidence.events.length&&!evidence.issues.length)evidence.issues.push('Bank movement evidence is not yet available.')
    issues.push(...evidence.issues.map(issue=>`${employeeName}: ${issue}`))
    for(const event of evidence.events){for(const line of event.lineItemIds){if(seen.has(line))issues.push('A bank line item is assigned to more than one payment movement.');seen.add(line)}events.push({...event,employeeId:Number(row.employee_id),employeeName})}
   }
   const blockingIssues=[...new Set(issues)]
   const replacements=(await db.query(`SELECT a.*,e.legal_first_name||' '||e.legal_last_name AS employee_name FROM payroll_payment_replacement_authorization a JOIN payroll_payment_replacement_attempt t ON t.authorization_id=a.id JOIN payroll_employee e ON e.id=a.employee_id AND e.facility_id=a.facility_id WHERE a.facility_id=$1 AND a.payroll_run_id=$2 AND a.method='DIRECT_DEPOSIT'`,[facility,runId])).rows
   for(const row of replacements){
    const observations=(await db.query('SELECT id,source,result FROM payroll_payment_replacement_observation WHERE authorization_id=$1 ORDER BY id',[row.id])).rows
    const evidence=paymentAccountingEvidence({id:row.id,amount_cents:row.amount_cents,mode:row.intent.mode,originating_account_id:row.intent.originatingAccountId},observations)
    if(!evidence.events.length&&!evidence.issues.length)evidence.issues.push('Replacement bank evidence is not yet available.')
    issues.push(...evidence.issues.map(issue=>`${row.employee_name} replacement: ${issue}`))
    for(const event of evidence.events){for(const line of event.lineItemIds){if(seen.has(line)){issues.push('A bank line item is assigned to more than one payment movement.');blockingIssues.push('A bank line item is assigned to more than one payment movement.')}seen.add(line)}events.push({...event,employeeId:Number(row.employee_id),employeeName:row.employee_name,originalInstructionId:row.instruction_id,sourceKind:'REPLACEMENT',...(row.predecessor_id?{predecessorId:row.predecessor_id}:{}),issues:evidence.issues})}
   }
   const checks=(await db.query(`SELECT i.*,e.legal_first_name||' '||e.legal_last_name AS employee_name FROM payroll_check_issue i JOIN payroll_employee e ON e.id=i.employee_id AND e.facility_id=i.facility_id WHERE i.facility_id=$1 AND i.payroll_run_id=$2`,[facility,runId])).rows
   for(const row of checks){
    let intent
    try{intent=JSON.parse(decryptDocument(row.encrypted_intent,`payroll-check-issue:${facility}:${runId}:${row.employee_id}`).toString())}
    catch{issues.push(`${row.employee_name}: retained check funding cannot be read.`);continue}
    const observations=(await db.query('SELECT id,source,result FROM payroll_check_issue_observation WHERE issue_id=$1 ORDER BY id',[row.id])).rows
    const evidence=paymentAccountingEvidence({id:row.id,amount_cents:row.amount_cents,mode:intent.mode,originating_account_id:intent.originatingAccountId,payment_rail:'CHECK'},observations)
    if(!evidence.events.length&&!evidence.issues.length)evidence.issues.push('Check bank withdrawal evidence is not yet available.')
    const first=observations.find(o=>o.result?.providerId)?.result.providerId
    if(evidence.events.some(event=>event.providerId!==first))evidence.issues.push('Check bank evidence identifies a different issued check.')
    issues.push(...evidence.issues.map(issue=>`${row.employee_name} check: ${issue}`))
    for(const event of evidence.events){for(const line of event.lineItemIds){if(seen.has(line)){issues.push('A bank line item is assigned to more than one payment movement.');blockingIssues.push('A bank line item is assigned to more than one payment movement.')}seen.add(line)}events.push({...event,employeeId:Number(row.employee_id),employeeName:row.employee_name,sourceKind:'CHECK',issues:evidence.issues})}
   }
   const checkReplacements=(await db.query(`SELECT a.*,i.employee_id,i.batch_id,e.legal_first_name||' '||e.legal_last_name AS employee_name FROM payroll_check_replacement_authorization a JOIN payroll_check_replacement_claim t ON t.authorization_id=a.id JOIN payroll_check_issue i ON i.id=a.issue_id JOIN payroll_employee e ON e.id=i.employee_id AND e.facility_id=i.facility_id WHERE i.facility_id=$1 AND i.payroll_run_id=$2`,[facility,runId])).rows
   for(const row of checkReplacements){
    let intent
    try{intent=JSON.parse(decryptDocument(row.encrypted_intent,`payroll-check-replacement:${row.id}`).toString())}
    catch{issues.push(`${row.employee_name}: retained replacement funding cannot be read.`);continue}
    const observations=(await db.query('SELECT id,source,result FROM payroll_check_replacement_observation WHERE authorization_id=$1 ORDER BY id',[row.id])).rows
    const evidence=paymentAccountingEvidence({id:row.id,amount_cents:row.amount_cents,mode:intent.mode,originating_account_id:intent.originatingAccountId,payment_rail:row.method==='CHECK'?'CHECK':'ACH'},observations)
    if(Number(row.connection_id)!==intent.connectionId)evidence.issues.push('Retained replacement funding requires mapping remediation before accounting.')
    const original=await checkReplacementPlan(db,facility,runId,Number(row.batch_id),Number(row.employee_id),{requireFresh:false})
    if(original.issues.length)evidence.issues.push('Review the original stopped-check evidence before replacement accounting.')
    const first=observations.find(o=>o.result?.providerId)?.result.providerId
    if(evidence.events.some(event=>event.providerId!==first))evidence.issues.push('Replacement bank evidence identifies a different issued payment.')
    if(!evidence.events.length&&!evidence.issues.length)evidence.issues.push('Replacement bank movement evidence is not yet available.')
    issues.push(...evidence.issues.map(issue=>`${row.employee_name} stopped-check replacement: ${issue}`))
    for(const event of evidence.events){for(const line of event.lineItemIds){if(seen.has(line)){issues.push('A bank line item is assigned to more than one payment movement.');blockingIssues.push('A bank line item is assigned to more than one payment movement.')}seen.add(line)}events.push({...event,employeeId:Number(row.employee_id),employeeName:row.employee_name,originalInstructionId:row.issue_id,sourceKind:'CHECK_REPLACEMENT',paymentRail:row.method,issues:evidence.issues})}
   }
   const withdrawals=events.filter(e=>e.kind==='WITHDRAWAL').reduce((n,e)=>n+e.amountCents,0),returns=events.filter(e=>e.kind==='RETURN').reduce((n,e)=>n+e.amountCents,0)
   if(!Number.isSafeInteger(withdrawals)||!Number.isSafeInteger(returns))throw new Error('Invalid bank totals')
   const data={status:issues.length?'NEEDS_REVIEW':events.length?'EVIDENCE_READY':'AWAITING_BANK_EVIDENCE',events,issues:[...new Set(issues)],blockingIssues,totals:{withdrawalCents:withdrawals,returnedCents:returns,netOutflowCents:withdrawals-returns},postingAvailable:false}
   data.fingerprint=createHash('sha256').update(JSON.stringify({runId,...data})).digest('hex')
   return data
}
