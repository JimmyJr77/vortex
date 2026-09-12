import {createHash} from 'node:crypto'
import {marylandElectionFingerprint} from './marylandElectionFingerprint.js'
import {effectiveScheduleSettings} from './payCalendar.js'
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const fail=message=>Object.assign(new Error(message),{status:409})
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const present=row=>row?{id:String(row.id),revision:row.revision,status:row.status,agreement:row.agreement,effectiveOn:row.effective_on instanceof Date?row.effective_on.toISOString().slice(0,10):String(row.effective_on).slice(0,10),fingerprint:row.fingerprint,sourceReference:row.source_reference,createdAt:row.created_at}:null

export function registerMarylandAdditionalAgreementRoutes(app,pool){
 const path='/api/admin/payroll/employees/:id/maryland-additional-agreements'
 app.get(path,async(req,res)=>{
  try{
   const facility=req.canonicalAccess.facilityId
   const employee=(await pool.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,req.params.id])).rows[0]
   if(!employee)return res.status(404).json({success:false,message:'Employee not found.'})
   const election=(await pool.query('SELECT elections FROM payroll_tax_election WHERE facility_id=$1 AND employee_id=$2 AND tax_year=2026',[facility,employee.id])).rows[0]?.elections?.maryland
   const rows=(await pool.query('SELECT * FROM payroll_maryland_additional_agreement WHERE facility_id=$1 AND employee_id=$2 ORDER BY revision DESC',[facility,employee.id])).rows
   const latest=present(rows[0]),currentElectionFingerprint=election?marylandElectionFingerprint(election):null
   res.json({success:true,data:{latest,history:rows.map(present),currentElectionFingerprint,requestedAdditionalCents:election?.extraWithholdingCents??null,electionMatches:!!latest&&latest.agreement.electionFingerprint===currentElectionFingerprint}})
  }catch{res.status(500).json({success:false,message:'Unable to load Maryland additional-withholding agreements.'})}
 })
 app.post(path,async(req,res)=>{
  const b=req.body||{},source=typeof b.sourceReference==='string'?b.sourceReference.trim():''
  if(!['ACTIVE','SUSPENDED'].includes(b.status)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||typeof b.requestKey!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(b.requestKey)||b.confirmed!==true||source.length<20||source.length>2000||/[\u0000-\u001f\u007f]/.test(source)||!day(b.effectiveOn))return res.status(400).json({success:false,message:'Confirm the signed agreement reference, effective date, status and current revision.'})
  const requestHash=digest({status:b.status,expectedRevision:b.expectedRevision,source,effectiveOn:b.effectiveOn,electionFingerprint:b.electionFingerprint??null,amountCents:b.amountCents??null,periodBasis:b.periodBasis??null})
  const db=await pool.connect()
  try{
   await db.query('BEGIN')
   const facility=req.canonicalAccess.facilityId,settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   const employee=(await db.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,req.params.id])).rows[0]
   if(!employee){await db.query('ROLLBACK');return res.status(404).json({success:false,message:'Employee not found.'})}
   const retry=(await db.query('SELECT * FROM payroll_maryland_additional_agreement WHERE facility_id=$1 AND employee_id=$2 AND request_key=$3',[facility,employee.id,b.requestKey])).rows[0]
   if(retry){if(retry.request_hash!==requestHash)throw fail('This agreement request key was already used with different details.');await db.query('COMMIT');return res.json({success:true,data:{...present(retry),reused:true}})}
   const previous=(await db.query('SELECT * FROM payroll_maryland_additional_agreement WHERE facility_id=$1 AND employee_id=$2 ORDER BY revision DESC LIMIT 1',[facility,employee.id])).rows[0]
   if((previous?.revision??0)!==b.expectedRevision)throw fail('The agreement changed. Reload its current revision before saving.')
   if(previous&&b.effectiveOn<String(previous.effective_on instanceof Date?previous.effective_on.toISOString():previous.effective_on).slice(0,10))throw fail('An agreement revision cannot precede its retained effective date.')
   let agreement=previous?.agreement
   if(b.status==='ACTIVE'){
    const election=(await db.query('SELECT elections FROM payroll_tax_election WHERE facility_id=$1 AND employee_id=$2 AND tax_year=2026',[facility,employee.id])).rows[0]?.elections?.maryland
    if(!election||employee.work_state!=='MD'||employee.residence_state!=='MD'||election.exempt||!Number.isSafeInteger(b.amountCents)||b.amountCents<0||b.amountCents!==election.extraWithholdingCents||b.electionFingerprint!==marylandElectionFingerprint(election)||b.periodBasis!=='PAYMENT_DATE'||!b.effectiveOn.startsWith('2026-'))throw fail('Review the current 2026 Maryland-resident nonexempt election and its exact additional amount and payment-date agreement.')
    const schedule=await effectiveScheduleSettings(db,facility,settings,b.effectiveOn)
    if(!['WEEKLY','BIWEEKLY','SEMIMONTHLY','MONTHLY'].includes(schedule.pay_frequency))throw fail('Review a supported pay frequency before this agreement.')
    agreement={version:1,employeeId:String(employee.id),verified:true,amountCents:b.amountCents,payFrequency:schedule.pay_frequency,periodBasis:'PAYMENT_DATE',electionFingerprint:b.electionFingerprint}
   }else if(!previous||previous.status!=='ACTIVE')throw fail('Select an active retained agreement before suspending it.')
   const revision=b.expectedRevision+1,fingerprint=digest({employeeId:String(employee.id),revision,status:b.status,agreement,effectiveOn:b.effectiveOn,source})
   const row=(await db.query('INSERT INTO payroll_maryland_additional_agreement(facility_id,employee_id,revision,status,agreement,effective_on,fingerprint,source_reference,request_key,request_hash,verified_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',[facility,employee.id,revision,b.status,agreement,b.effectiveOn,fingerprint,source,b.requestKey,requestHash,req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'MARYLAND_ADDITIONAL_AGREEMENT_RECORDED','employee',$3,$4)",[facility,req.adminId,String(employee.id),{revision,status:b.status,fingerprint}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{...present(row),reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain Maryland additional-withholding agreement.'})}finally{db.release()}
 })
}
