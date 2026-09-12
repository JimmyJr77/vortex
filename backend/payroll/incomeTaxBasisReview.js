import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const equal=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))
export function incomeTaxReviewSource(row){
 const keys=['regular_pay_cents','overtime_pay_cents','other_taxable_pay_cents','federal_income_tax_cents','state_income_tax_cents','pretax_deduction_cents']
 if(keys.some(k=>row[k]===null||row[k]===undefined||!/^\d+$/.test(String(row[k]))||!Number.isSafeInteger(Number(row[k]))))throw fail('Reconcile posted wage and withholding amounts before reviewing income-tax wages.',409)
 const gross=Number(row.regular_pay_cents)+Number(row.overtime_pay_cents)+Number(row.other_taxable_pay_cents),paymentDate=new Date(row.payment_date).toISOString().slice(0,10)
 if(!Number.isSafeInteger(gross)||row.status!=='FINALIZED'||!paymentDate.startsWith('2026-')||row.work_state!=='MD'||row.residence_state!=='MD')throw fail('This review requires finalized 2026 payroll for a Maryland resident working in Maryland.',409)
 const employees=(Array.isArray(row.calculation_snapshot?.employees)?row.calculation_snapshot.employees:[]).filter(e=>Number(e?.employeeId)===Number(row.employee_id))
 if(employees.length>1)throw fail('Reconcile duplicate employee calculations before reviewing wage inputs.',409)
 const source={version:1,facilityId:Number(row.facility_id),runEmployeeId:Number(row.id),runId:Number(row.payroll_run_id),employeeId:Number(row.employee_id),paymentDate,runKind:row.run_kind,grossWagesCents:gross,federalWithholdingCents:Number(row.federal_income_tax_cents),marylandWithholdingCents:Number(row.state_income_tax_cents),pretaxDeductionCents:Number(row.pretax_deduction_cents),calculation:employees[0]||null,statement:row.statement_snapshot}
 return {source,fingerprint:createHash('sha256').update(JSON.stringify(compensationEvidence(source))).digest('hex')}
}
export function registerIncomeTaxBasisReviewRoutes(app,pool){
 const route='/api/admin/payroll/runs/:runId/employees/:employeeId/income-tax-basis'
 const read=async(db,req,lock=false)=>{
  if(!/^[1-9]\d*$/.test(req.params.runId)||!/^[1-9]\d*$/.test(req.params.employeeId))throw fail('Choose a valid payroll and employee.')
  const row=(await db.query(`SELECT re.*,r.facility_id,r.status,r.run_kind,r.calculation_snapshot,COALESCE(r.payment_date,p.pay_date) AS payment_date,e.work_state,e.residence_state
   FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_employee e ON e.id=re.employee_id AND e.facility_id=r.facility_id
   WHERE r.facility_id=$1 AND r.id=$2 AND re.employee_id=$3 ${lock?'FOR UPDATE OF r,re':''}`,[req.canonicalAccess.facilityId,req.params.runId,req.params.employeeId])).rows[0]
  if(!row)throw fail('Finalized employee payroll not found.',404)
  return {row,...incomeTaxReviewSource(row)}
 }
 const history=(db,facility,id)=>db.query('SELECT id,source_fingerprint,federal_wages_cents,maryland_wages_cents,evidence_reference,created_by,created_at FROM payroll_income_tax_basis_review WHERE facility_id=$1 AND run_employee_id=$2 ORDER BY id DESC',[facility,id])
 const respondError=(res,e)=>res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to review income-tax wage inputs.'})
 app.get(route,async(req,res)=>{try{const data=await read(pool,req);res.setHeader('Cache-Control','no-store');res.json({success:true,data:{sourceFingerprint:data.fingerprint,paymentDate:data.source.paymentDate,grossWagesCents:data.source.grossWagesCents,federalWithholdingCents:data.source.federalWithholdingCents,marylandWithholdingCents:data.source.marylandWithholdingCents,reviews:(await history(pool,req.canonicalAccess.facilityId,data.row.id)).rows.map((r,index)=>({...r,current:index===0&&r.source_fingerprint===data.fingerprint,status:r.source_fingerprint!==data.fingerprint?'STALE':index===0?'CURRENT':'SUPERSEDED'}))}})}catch(e){respondError(res,e)}})
 app.post(route,async(req,res)=>{
  const db=await pool.connect()
  try{
   await db.query('BEGIN');const data=await read(db,req,true),b=req.body||{},reference=typeof b.evidenceReference==='string'?b.evidenceReference.trim():''
   if(b.sourceFingerprint!==data.fingerprint)throw fail('Payroll evidence changed. Refresh the wage review.',409)
   if(b.confirmed!==true||reference.length<12||reference.length>2000||typeof b.requestKey!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(b.requestKey)||[b.federalWagesCents,b.marylandWagesCents].some(n=>!Number.isSafeInteger(n)||n<0||n>data.source.grossWagesCents))throw fail('Confirm reviewed federal/Maryland wage amounts within posted gross and provide a detailed calculation reference.')
   const prior=(await db.query('SELECT * FROM payroll_income_tax_basis_review WHERE facility_id=$1 AND request_key=$2',[req.canonicalAccess.facilityId,b.requestKey])).rows[0]
   if(prior){if(Number((await history(db,req.canonicalAccess.facilityId,data.row.id)).rows[0]?.id)!==Number(prior.id))throw fail('This wage review was superseded. Refresh before reviewing again.',409);if(Number(prior.run_employee_id)!==Number(data.row.id)||prior.source_fingerprint!==data.fingerprint||Number(prior.federal_wages_cents)!==b.federalWagesCents||Number(prior.maryland_wages_cents)!==b.marylandWagesCents||prior.evidence_reference!==reference||!equal(prior.source_snapshot,data.source))throw fail('This review request was already used with different evidence.',409);await db.query('COMMIT');return res.json({success:true,data:{id:Number(prior.id),reused:true}})}
   const saved=(await db.query('INSERT INTO payroll_income_tax_basis_review(facility_id,run_employee_id,request_key,source_fingerprint,source_snapshot,federal_wages_cents,maryland_wages_cents,evidence_reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[req.canonicalAccess.facilityId,data.row.id,b.requestKey,data.fingerprint,data.source,b.federalWagesCents,b.marylandWagesCents,reference,req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'INCOME_TAX_BASIS_REVIEWED','income_tax_basis_review',$3,$4)",[req.canonicalAccess.facilityId,req.adminId,String(saved.id),{runEmployeeId:Number(data.row.id),sourceFingerprint:data.fingerprint}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{id:Number(saved.id),reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});respondError(res,e)}finally{db.release()}
 })
}
