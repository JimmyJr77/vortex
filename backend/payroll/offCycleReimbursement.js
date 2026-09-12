import {createHash} from 'node:crypto'
const fail=message=>Object.assign(new Error(message),{status:409})
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10)
export async function loadReimbursementPreview(db,facility,adjustmentId,paymentDate,runId=null){
 const row=(await db.query(`SELECT a.*,q.status AS request_status,q.kind AS request_kind,q.payload,q.reviewed_at,e.legal_first_name,e.legal_last_name,e.employment_status,e.pay_type,e.hourly_rate_cents,
  p.id AS period_id,p.period_start,p.period_end,p.frequency,s.legal_business_name,s.business_address,s.onboarding_policy,s.timezone
  FROM payroll_recurring_adjustment a JOIN payroll_employee_request q ON q.id=a.source_request_id AND q.facility_id=a.facility_id AND q.employee_id=a.employee_id
  JOIN payroll_employee e ON e.id=a.employee_id AND e.facility_id=a.facility_id JOIN payroll_settings s ON s.facility_id=a.facility_id
  JOIN payroll_pay_period p ON p.facility_id=a.facility_id AND p.id=(q.payload->'reimbursementPeriod'->>'id')::bigint
  WHERE a.id=$1 AND a.facility_id=$2`,[adjustmentId,facility])).rows[0]
 if(!row||row.request_kind!=='EXPENSE'||row.kind!=='REIMBURSEMENT'||row.status!=='ACTIVE'||row.request_status!=='APPROVED'||!row.tax_treatment_verified||row.employment_status==='ONBOARDING')throw fail('Select an approved, verified expense for an active or former employee.')
 const amount=Number(row.amount_cents)
 if(!Number.isSafeInteger(amount)||amount<=0||amount!==Number(row.payload.amountCents))throw fail('Reconcile the expense amount with its approved request.')
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(paymentDate))||!Number.isFinite(Date.parse(paymentDate))||day(new Date(paymentDate))!==paymentDate)throw fail('Select a valid off-cycle payment date.')
 const reviewedDay=new Intl.DateTimeFormat('en-CA',{timeZone:row.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(row.reviewed_at)
 if(paymentDate<reviewedDay)throw fail('The reimbursement payment date cannot precede approval of the expense.')
 const assigned=row.offcycle_run_id?(await db.query('SELECT id,status FROM payroll_run WHERE id=$1 AND facility_id=$2',[row.offcycle_run_id,facility])).rows[0]:null
 if(assigned&&assigned.status!=='VOID'&&Number(assigned.id)!==Number(runId))throw fail('This expense already belongs to an off-cycle payroll. Review that run before creating another.')
 if(runId&&Number(row.offcycle_run_id)!==Number(runId))throw fail('The expense assignment changed after the off-cycle draft was created.')
 const locked=(await db.query(`SELECT r.id FROM payroll_run r
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.calculation_snapshot->'employees','[]'::jsonb)) employee
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(employee->'payItems','[]'::jsonb)) item
  WHERE r.facility_id=$1 AND r.run_kind='REGULAR' AND r.status IN ('APPROVED','FINALIZED')
  AND employee->>'employeeId'=$2::text AND item->>'kind'='REIMBURSEMENT'
  AND (item->>'sourceRequestId'=$3::text OR item->>'name'='Expense request '||$3::text) LIMIT 1`,[facility,row.employee_id,row.source_request_id])).rows
 const uncertain=(await db.query(`SELECT r.id FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
  JOIN payroll_run_employee re ON re.payroll_run_id=r.id AND re.employee_id=$2
  WHERE r.facility_id=$1 AND r.run_kind='REGULAR' AND r.status IN ('APPROVED','FINALIZED') AND re.reimbursement_cents>0
  AND p.period_start<=$4::date AND p.period_end>=$3::date
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(r.calculation_snapshot->'employees','[]'::jsonb)) employee
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(employee->'payItems','[]'::jsonb)) item
   WHERE employee->>'employeeId'=$2::text AND item->>'kind'='REIMBURSEMENT'
   AND (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(r.calculation_snapshot->'employees','[]'::jsonb)) candidate WHERE candidate->>'employeeId'=$2::text)=1
   GROUP BY employee
   HAVING COUNT(*)=COUNT(DISTINCT COALESCE(item->>'sourceRequestId',substring(item->>'name' from '^Expense request ([0-9]+)$')))
   AND bool_and(COALESCE(item->>'sourceRequestId',substring(item->>'name' from '^Expense request ([0-9]+)$')) ~ '^[1-9][0-9]*$')
   AND bool_and(COALESCE(item->>'amountCents','') ~ '^[0-9]+$')
   AND SUM(CASE WHEN item->>'amountCents' ~ '^[0-9]+$' THEN (item->>'amountCents')::numeric ELSE 0 END)=re.reimbursement_cents) LIMIT 1`,[facility,row.employee_id,row.active_from,row.active_to])).rows
 if(locked.length||uncertain.length)throw fail('Regular payroll has committed or unreconciled reimbursement evidence. Reconcile that payroll before moving this expense.')
 const fingerprint=createHash('sha256').update(JSON.stringify([row.id,row.source_request_id,amount,row.authorization_reference,row.reviewed_at,row.payload.receiptReference,row.employee_id,row.period_id,paymentDate])).digest('hex')
 const employee={employeeId:Number(row.employee_id),employeeName:`${row.legal_first_name} ${row.legal_last_name}`,payType:row.pay_type,hourlyRateCents:0,payFrequency:row.frequency,calculationVersion:'off-cycle-reimbursement-v1',ficaWageBasis:{version:1,calculationReference:'verified-accountable-reimbursement-no-wages',grossWagesCents:0,socialSecurityTaxableCents:0,medicareTaxableCents:0,additionalMedicareTaxableCents:0},offcycleFingerprint:fingerprint,
  entries:[],workweekEarnings:[],workweekPayments:[],rateBreakdown:[],payItems:[{kind:'REIMBURSEMENT',name:`Expense request ${row.source_request_id}`,amountCents:amount,sourceRequestId:Number(row.source_request_id)}],warnings:[],withholdingMethod:'verified-accountable-reimbursement-no-wages',reimbursementCents:amount,netPayCents:amount}
 for(const key of ['regularMinutes','overtimeMinutes','regularPayCents','overtimePayCents','otherTaxablePayCents','paidLeavePayCents','paidLeaveMinutes','pretaxDeductionCents','posttaxDeductionCents','garnishmentCents','totalDeductionCents','grossPayCents','federalIncomeTaxCents','stateIncomeTaxCents','socialSecurityTaxCents','medicareTaxCents','additionalMedicareTaxCents','futaTaxCents','mdUiTaxCents','employerSocialSecurityTaxCents','employerMedicareTaxCents','sickLeaveAccrualMinutes'])employee[key]=0
 const warnings=[]
 if(!row.legal_business_name||!row.business_address||!row.onboarding_policy?.businessPhone)warnings.push({code:'EMPLOYER_STATEMENT_DETAILS',severity:'critical',blocking:true,message:'Complete employer name, address and telephone before issuing a reimbursement statement.'})
 const preview={calculationVersion:'off-cycle-reimbursement-v1',employees:[employee],grossPayCents:0,employeeTaxCents:0,employerTaxCents:0,deductionCents:0,reimbursementCents:amount,netPayCents:amount,warnings,canApprove:!warnings.length,paymentDate,runKind:'OFF_CYCLE_REIMBURSEMENT'}
 return {preview,period:{id:row.period_id,period_start:row.period_start,period_end:row.period_end,pay_date:paymentDate,frequency:row.frequency},context:{version:1,adjustmentId:Number(row.id),sourceRequestId:Number(row.source_request_id),employeeId:Number(row.employee_id)}}
}
export function registerOffCycleReimbursementRoutes(app,pool){
 app.get('/api/admin/payroll/off-cycle/reimbursements',async(req,res)=>{
  try{const rows=(await pool.query(`SELECT a.id,a.employee_id,a.amount_cents,a.source_request_id,q.payload->'reimbursementPeriod' AS period,e.legal_first_name||' '||e.legal_last_name AS employee_name
   FROM payroll_recurring_adjustment a JOIN payroll_employee_request q ON q.id=a.source_request_id AND q.facility_id=a.facility_id AND q.employee_id=a.employee_id JOIN payroll_employee e ON e.id=a.employee_id AND e.facility_id=a.facility_id
   LEFT JOIN payroll_run r ON r.id=a.offcycle_run_id WHERE a.facility_id=$1 AND a.kind='REIMBURSEMENT' AND a.status='ACTIVE' AND a.tax_treatment_verified AND q.kind='EXPENSE' AND q.status='APPROVED' AND e.employment_status<>'ONBOARDING' AND (r.id IS NULL OR r.status='VOID') ORDER BY a.id`,[req.canonicalAccess.facilityId])).rows;res.json({success:true,data:rows})}catch{res.status(500).json({success:false,message:'Unable to load approved reimbursements.'})}
 })
 app.post('/api/admin/payroll/off-cycle/reimbursements/preview',async(req,res)=>{try{res.json({success:true,data:await loadReimbursementPreview(pool,req.canonicalAccess.facilityId,req.body?.adjustmentId,req.body?.paymentDate)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to preview reimbursement.'})}})
}

export async function unpaidExpenseCount(db,facility,employeeId){
 return (await db.query(`SELECT COUNT(*)::int n FROM payroll_recurring_adjustment a
  JOIN payroll_employee_request q ON q.id=a.source_request_id AND q.facility_id=a.facility_id
  LEFT JOIN payroll_run oc ON oc.id=a.offcycle_run_id
  WHERE a.facility_id=$1 AND a.employee_id=$2 AND a.kind='REIMBURSEMENT' AND q.status='APPROVED'
  AND COALESCE(oc.status,'')<>'FINALIZED' AND NOT EXISTS(
   SELECT 1 FROM payroll_run r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.calculation_snapshot->'employees','[]'::jsonb)) employee
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(employee->'payItems','[]'::jsonb)) item
   WHERE r.facility_id=a.facility_id AND r.run_kind='REGULAR' AND r.status='FINALIZED'
   AND employee->>'employeeId'=a.employee_id::text AND item->>'kind'='REIMBURSEMENT'
   AND (item->>'sourceRequestId'=a.source_request_id::text OR item->>'name'='Expense request '||a.source_request_id::text)
  )`,[facility,employeeId])).rows[0].n
}
