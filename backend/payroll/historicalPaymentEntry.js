import {compensationEvidence} from './employmentCompensation.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s
export function registerHistoricalPaymentEntryRoutes(app,pool){
 app.post('/api/admin/payroll/employees/:id/historical-payments',async(req,res)=>{
  let db
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId
   const input={requestId:b.requestId,periodStart:b.periodStart,periodEnd:b.periodEnd,paymentDate:b.paymentDate,method:b.method,reference:String(b.reference||'').trim(),grossCents:b.grossCents,taxCents:b.taxCents,netCents:b.netCents,evidence:String(b.evidence||'').trim()}
   if(!/^[a-zA-Z0-9-]{12,100}$/.test(input.requestId||'')||![input.periodStart,input.periodEnd,input.paymentDate].every(validDate)||input.periodStart>input.periodEnd||input.periodEnd>input.paymentDate||!['CHECK','ACH','CASH','WIRE'].includes(input.method)||input.reference.length<4||input.reference.length>200||input.evidence.length<20||input.evidence.length>2000||![input.grossCents,input.taxCents,input.netCents].every(n=>Number.isSafeInteger(n)&&n>=0)||input.grossCents===0||BigInt(input.taxCents)+BigInt(input.netCents)!==BigInt(input.grossCents)||b.wageOnlyConfirmed!==true||b.confirmed!==true)throw fail('Confirm a wage-only payment with valid dates, payment reference and source evidence. Gross wages minus withheld taxes must equal net paid.',400)
   db=await pool.connect();await db.query('BEGIN')
   const settings=(await db.query('SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   const employee=(await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,req.params.id])).rows[0]
   if(!employee)throw fail('Employee not found.',404)
   const prior=(await db.query("SELECT after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee' AND entity_id=$2 AND action='HISTORICAL_PAYMENT_RECORDED' AND after_data->'input'->>'requestId'=$3 ORDER BY id DESC LIMIT 1",[facility,String(employee.id),input.requestId])).rows[0]
   if(prior){if(JSON.stringify(compensationEvidence(prior.after_data.input))!==JSON.stringify(compensationEvidence(input)))throw fail('This payment reference was already submitted with different inputs.');await db.query('COMMIT');return res.json({success:true,data:prior.after_data.payment})}
   if(!settings||input.paymentDate>settings.today)throw fail('Only record a payment that has already been made.')
   const conflicts=(await db.query(`SELECT r.id FROM payroll_run r JOIN payroll_run_employee e ON e.payroll_run_id=r.id JOIN payroll_pay_period p ON p.id=r.pay_period_id
    WHERE r.facility_id=$1 AND e.employee_id=$2 AND r.status IN ('APPROVED','FINALIZED') AND r.run_kind<>'OFF_CYCLE_REIMBURSEMENT'
    AND ((EXTRACT(YEAR FROM COALESCE(r.payment_date,p.pay_date))=EXTRACT(YEAR FROM $3::date) AND COALESCE(r.payment_date,p.pay_date)>=$3::date)
     OR (r.run_kind='REGULAR' AND p.period_start<=$5::date AND p.period_end>=$4::date)) LIMIT 1`,[facility,employee.id,input.paymentDate,input.periodStart,input.periodEnd])).rows
   if(conflicts.length)throw fail('Existing approved or finalized payroll overlaps this work or uses later wage history. Reconcile that payroll before importing this payment.')
   if((await db.query('SELECT id FROM payroll_historical_payment WHERE facility_id=$1 AND employee_id=$2 AND (reference=$3 OR (period_start<=$5::date AND period_end>=$4::date)) LIMIT 1',[facility,employee.id,input.reference,input.periodStart,input.periodEnd])).rows.length)throw fail('A historical payment already uses this reference or work period. Reconcile the existing record before adding another.')
   const payment=(await db.query(`INSERT INTO payroll_historical_payment(facility_id,employee_id,period_start,period_end,payment_date,method,reference,gross_amount_cents,employee_tax_withheld_cents,net_amount_cents,evidence_note,source)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ADMIN_RECORDED') RETURNING *`,[facility,employee.id,input.periodStart,input.periodEnd,input.paymentDate,input.method,input.reference,input.grossCents,input.taxCents,input.netCents,input.evidence])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'HISTORICAL_PAYMENT_RECORDED','employee',$3,$4)",[facility,req.adminId,String(employee.id),{input,payment,wageOnlyConfirmed:true,confirmed:true}])
   await db.query('COMMIT');res.status(201).json({success:true,data:payment})
  }catch(error){if(db)await db.query('ROLLBACK');res.status(error.status||500).json({success:false,message:error.status?error.message:'Unable to record historical payment.'})}finally{db?.release()}
 })
}
