import {createHash,timingSafeEqual} from 'node:crypto'
import {payrollEmployeeAuth,lockPayrollEmployeeSession} from './employeeAuth.js'
import {encryptDocument,decryptDocument} from './onboarding.js'
const hash=value=>createHash('sha256').update(value).digest('hex')
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export function registerW2ElectronicConsent(app,pool,termsFor){
 const path='/api/payroll/employee/w2-electronic/consent',auth=payrollEmployeeAuth(pool)
 app.get(path,auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{
   const s=req.payrollEmployee,disclosure=await termsFor(pool,s.facility_id)
   const rows=(await pool.query('SELECT id,decision,terms_fingerprint,encrypted_receipt,created_at FROM payroll_w2_consent WHERE facility_id=$1 AND employee_id=$2 AND payment_year=2026 ORDER BY id DESC',[s.facility_id,s.employee_id])).rows
   const history=rows.map(row=>{let receipt=null,receiptIssue=null;if(row.encrypted_receipt)try{receipt=JSON.parse(decryptDocument(row.encrypted_receipt,`w2-consent:${s.facility_id}:${s.employee_id}:2026`).toString())}catch{receiptIssue='Saved receipt is temporarily unavailable. Withdrawal remains available.'}return {id:Number(row.id),decision:row.decision,termsFingerprint:row.terms_fingerprint,effectiveAt:row.created_at,receipt,receiptIssue}})
   const latest=history[0],status=latest?.decision==='CONSENT'?(disclosure.available&&latest.termsFingerprint===disclosure.fingerprint?'CONSENTED':'RENEWAL_REQUIRED'):'PAPER'
   res.json({success:true,data:{year:2026,status,disclosure,history}})
  }catch{res.status(500).json({success:false,message:'Unable to read electronic W-2 preferences.'})}
 })
 app.post(path,auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},signature=typeof b.signature==='string'?b.signature.trim():''
   if(!['CONSENT','WITHDRAW'].includes(b.decision)||b.confirmed!==true||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0)throw fail('Confirm your consent choice and current preference revision.')
   if(b.decision==='CONSENT'&&(!/^[a-f0-9]{64}$/.test(b.termsFingerprint||'')||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(b.proofId||'')||!/^[0-9A-F]{10}$/.test(b.code||'')||signature.length<2||signature.length>200||/[\u0000-\u001f\u007f]/.test(signature)))throw fail('Review the terms, enter the PDF access code and sign your consent.')
   await db.query('BEGIN');const s=req.payrollEmployee;await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-consent:${s.facility_id}:${s.employee_id}:2026`]);await lockPayrollEmployeeSession(db,s,req)
   const fingerprint=hash(JSON.stringify(b.decision==='CONSENT'?{decision:b.decision,termsFingerprint:b.termsFingerprint,proofId:b.proofId,code:b.code,signature}:{decision:'WITHDRAW'}))
   const prior=(await db.query('SELECT id,request_fingerprint,created_at FROM payroll_w2_consent WHERE facility_id=$1 AND employee_id=$2 AND payment_year=2026 ORDER BY id DESC',[s.facility_id,s.employee_id])).rows[0]
   if(prior?.request_fingerprint===fingerprint){await db.query('COMMIT');return res.json({success:true,data:{id:Number(prior.id),effectiveAt:prior.created_at,reused:true}})}
   if(Number(prior?.id||0)!==b.expectedRevision)throw fail('Your preference changed. Reload before saving again.',409)
   let receipt=null
   if(b.decision==='CONSENT'){
    const disclosure=await termsFor(db,s.facility_id)
    if(!disclosure.available||disclosure.fingerprint!==b.termsFingerprint)throw fail('The disclosure changed or is unavailable. Reload and repeat the PDF access check.',409)
    const proof=(await db.query('SELECT p.*, (SELECT count(*) FROM payroll_w2_proof_attempt a WHERE a.proof_id=p.id AND NOT a.matched) AS failures FROM payroll_w2_access_proof p WHERE p.id=$1 AND p.facility_id=$2 AND p.employee_id=$3 AND p.session_id=$4 AND p.expires_at>clock_timestamp() AND p.terms_fingerprint=$5 AND NOT EXISTS(SELECT 1 FROM payroll_w2_consent c WHERE c.proof_id=p.id)',[b.proofId,s.facility_id,s.employee_id,s.session_id,b.termsFingerprint])).rows[0]
    if(!proof||Number(proof.failures)>=5)throw fail('The PDF access check expired, was used, or is unavailable. Request a new check.',409)
    const matched=timingSafeEqual(Buffer.from(proof.code_hash,'hex'),Buffer.from(hash(`${b.proofId}:${b.code}`),'hex'))
    await db.query('INSERT INTO payroll_w2_proof_attempt(proof_id,matched) VALUES($1,$2)',[proof.id,matched])
    if(!matched){await db.query('COMMIT');return res.status(400).json({success:false,message:'The access code did not match. Read the code in your PDF; after five unsuccessful attempts, request a new check.'})}
    receipt=encryptDocument(Buffer.from(JSON.stringify({version:1,year:2026,terms:disclosure.terms,termsFingerprint:disclosure.fingerprint,signature})),`w2-consent:${s.facility_id}:${s.employee_id}:2026`)
   }
   const saved=(await db.query('INSERT INTO payroll_w2_consent(facility_id,employee_id,session_id,payment_year,decision,proof_id,terms_fingerprint,encrypted_receipt,request_fingerprint) VALUES($1,$2,$3,2026,$4,$5,$6,$7,$8) RETURNING id,created_at',[s.facility_id,s.employee_id,s.session_id,b.decision,b.decision==='CONSENT'?b.proofId:null,b.decision==='CONSENT'?b.termsFingerprint:null,receipt,fingerprint])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,NULL,'W2_ELECTRONIC_PREFERENCE_RECORDED','w2_consent',$2,$3)",[s.facility_id,String(saved.id),{employeeId:Number(s.employee_id),decision:b.decision,year:2026}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{id:Number(saved.id),effectiveAt:saved.created_at,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to save electronic W-2 preference.'})}finally{db.release()}
 })
}
