import {createHash} from 'node:crypto'
import {reconcileIncomeTaxWageRows} from './incomeTaxWageReconciliation.js'
import {retirementStatementLines} from './retirementStatement.js'
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10)
const safe=value=>(typeof value==='number'||typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value))&&Number.isSafeInteger(Number(value))&&Number(value)>=0
const supplemental=new Set(['BONUS','LEAVE_PAYOUT','WAGE_CORRECTION'])
const ordinary=new Set(['BONUS_OVERTIME','SALARY_EXTRA_STRAIGHT_TIME','PAID_LEAVE'])
const nontaxable=new Set(['REIMBURSEMENT','POSTTAX_DEDUCTION','GARNISHMENT'])
export function reconcileSupplementalPayments(rows,paymentDate){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(paymentDate))||!Number.isFinite(Date.parse(paymentDate))||day(new Date(paymentDate))!==paymentDate)throw new Error('Use a valid payment date for supplemental wage history.')
 const year=Number(day(paymentDate).slice(0,4)),issues=[],evidence=[]
 let ytdSupplementalCents=0,regularWithholdingVerified=false
 for(const row of rows){
  const date=day(row.payment_date),rowYear=Number(date.slice(0,4))
  if(date>day(paymentDate)||rowYear<year-1||rowYear>year)continue
  const errors=[],employees=row.calculation_snapshot?.employees
  const matches=Array.isArray(employees)?employees.filter(e=>Number(e.employeeId)===Number(row.employee_id)):[]
  const snapshot=matches.length===1?matches[0]:null
  if(!snapshot)errors.push('exactly one employee calculation is required')
  const fields=['regular_pay_cents','overtime_pay_cents','other_taxable_pay_cents','federal_income_tax_cents']
  if(fields.some(key=>!safe(row[key])))errors.push('wage or withholding amounts are invalid')
  const gross=Number(row.regular_pay_cents)+Number(row.overtime_pay_cents)+Number(row.other_taxable_pay_cents)
  if(!Number.isSafeInteger(gross)||!safe(snapshot?.grossPayCents)||gross!==Number(snapshot?.grossPayCents))errors.push('gross wages do not reconcile')
  if(!row.withholding_verified_at||String(row.payment_confirmation_reference||'').trim().length<4)errors.push('verified withholding and payment confirmation are required')
  const items=snapshot?.payItems
  if(!Array.isArray(items)&&Number(row.other_taxable_pay_cents)!==0)errors.push('additional earnings lack itemization')
  const hasRetirement=!!snapshot?.retirement401k||!!snapshot?.retirementPlans?.length||Array.isArray(items)&&items.some(i=>i.kind?.startsWith('RETIREMENT_'))
  let taxableItems=0,supplementalCents=0,incomeTaxGrossCents=gross,retirementSupplementalPretaxCents=0
  for(const item of Array.isArray(items)?items:[]){
   if(!safe(item.amountCents)){errors.push('a pay item has an invalid amount');continue}
   const amount=Number(item.amountCents)
   if(supplemental.has(item.kind)||(item.kind==='BONUS_OVERTIME'&&item.federalSupplemental===true)){taxableItems+=amount;supplementalCents+=amount}
   else if(ordinary.has(item.kind))taxableItems+=amount
   else if(!nontaxable.has(item.kind)&&!['RETIREMENT_401K_PRETAX','RETIREMENT_401K_ROTH'].includes(item.kind)&&amount!==0)errors.push(`unclassified pay item ${String(item.kind)}`)
  }
  if(!Number.isSafeInteger(taxableItems)||taxableItems!==Number(row.other_taxable_pay_cents))errors.push('itemized taxable earnings do not reconcile')
  const grossSupplementalCents=supplementalCents
  if(hasRetirement){
   try{retirementStatementLines(row)}catch{errors.push('retirement deductions differ from the retained employee statement')}
   const reconciled=reconcileIncomeTaxWageRows([row]).get(String(row.employee_id)),basis=snapshot?.incomeTaxWageBasis?.retirement401k
   if(!basis||reconciled?.verified!==1||reconciled.issues.length)errors.push('retirement income-tax wages require reconciled payroll and statement evidence')
   else if(row.run_kind==='OFF_CYCLE_PTO'&&snapshot.supplementalTax?.retirementAllocation){
    const a=snapshot.supplementalTax.retirementAllocation,payouts=(items||[]).filter(i=>i.kind==='LEAVE_PAYOUT'),proposal=snapshot.retirementPtoProposals?.[0]
    if(a.version!==1||a.kind!=='LEAVE_PAYOUT'||payouts.length!==1||Number(payouts[0].leavePayout?.id)!==a.payoutId||a.grossCents!==gross||grossSupplementalCents!==gross||Number(row.regular_pay_cents)!==0||Number(row.overtime_pay_cents)!==0||a.pretaxCents!==basis.pretaxCents||basis.pretaxAnnualBonusCents!==0||a.incomeTaxWagesCents!==gross-basis.pretaxCents||a.proposalFingerprint!==proposal?.fingerprint||proposal?.calculation?.unusedPto?.grossCents!==gross||proposal?.calculation?.pretaxCents!==basis.pretaxCents)errors.push('PTO retirement supplemental-wage allocation does not reconcile')
    else{incomeTaxGrossCents=Number(reconciled.federal);retirementSupplementalPretaxCents=a.pretaxCents;supplementalCents-=a.pretaxCents}
   }
   else if(basis.pretaxCents>0&&(items||[]).some(i=>(supplemental.has(i.kind)&&i.kind!=='BONUS'||i.kind==='BONUS_OVERTIME'&&i.federalSupplemental===true)&&Number(i.amountCents)>0))errors.push('retirement deferrals require explicit allocation to each supplemental wage category')
   else if(!safe(basis.pretaxAnnualBonusCents)||basis.pretaxAnnualBonusCents>supplementalCents)errors.push('retirement supplemental-wage allocation does not reconcile')
   else{incomeTaxGrossCents=Number(reconciled.federal);retirementSupplementalPretaxCents=basis.pretaxAnnualBonusCents;supplementalCents-=basis.pretaxAnnualBonusCents}
  }else if(Number(row.pretax_deduction_cents||0)!==0)errors.push('pretax deductions require reconciled income-tax wage allocation')
  if(errors.length){issues.push({runId:Number(row.run_id),messages:errors});continue}
  if(rowYear===year)ytdSupplementalCents+=supplementalCents
  const qualifiesForFlat=grossSupplementalCents===0&&incomeTaxGrossCents>0&&Number(row.federal_income_tax_cents)>0
  regularWithholdingVerified ||= qualifiesForFlat
  evidence.push({runKind:row.run_kind??null,payPeriodId:row.pay_period_id==null?null:Number(row.pay_period_id),payFrequency:row.frequency??null,periodStart:row.period_start?day(row.period_start):null,periodEnd:row.period_end?day(row.period_end):null,runId:Number(row.run_id),employeeId:Number(row.employee_id),paymentDate:date,grossCents:gross,...(hasRetirement?{incomeTaxGrossCents,retirementPretaxCents:snapshot.retirement401k.pretaxCents,retirementSupplementalPretaxCents}:{}),supplementalCents,federalIncomeTaxCents:Number(row.federal_income_tax_cents),withholdingVerifiedAt:new Date(row.withholding_verified_at).toISOString(),qualifiesForFlat})
 }
 if(!Number.isSafeInteger(ytdSupplementalCents))issues.push({runId:null,messages:['cumulative supplemental wages exceed safe precision']})
 evidence.sort((a,b)=>a.paymentDate.localeCompare(b.paymentDate)||a.runId-b.runId)
 return {version:1,reconciled:issues.length===0,ytdSupplementalCents,regularWithholdingVerified:issues.length===0&&regularWithholdingVerified,evidence,issues,fingerprint:createHash('sha256').update(JSON.stringify(evidence)).digest('hex')}
}
export async function loadSupplementalPaymentHistory(db,facility,employeeId,paymentDate){
 const rows=(await db.query(`SELECT r.id AS run_id,r.facility_id,r.run_kind,r.pay_period_id,p.frequency,p.period_start,p.period_end,re.employee_id,COALESCE(r.payment_date,p.pay_date) AS payment_date,r.payment_confirmation_reference,r.calculation_snapshot,
  re.id,re.regular_pay_cents,re.overtime_pay_cents,re.other_taxable_pay_cents,re.federal_income_tax_cents,re.state_income_tax_cents,re.pretax_deduction_cents,re.posttax_deduction_cents,re.statement_snapshot,re.withholding_verified_at
  FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id
  WHERE r.facility_id=$1 AND re.employee_id=$2 AND r.status='FINALIZED'
  AND COALESCE(r.payment_date,p.pay_date) BETWEEN make_date(EXTRACT(YEAR FROM $3::date)::int-1,1,1) AND $3::date
  ORDER BY COALESCE(r.payment_date,p.pay_date),r.id`,[facility,employeeId,paymentDate])).rows
 const result=reconcileSupplementalPayments(rows,paymentDate)
 const imported=(await db.query(`SELECT id FROM payroll_historical_payment WHERE facility_id=$1 AND employee_id=$2
  AND payment_date BETWEEN make_date(EXTRACT(YEAR FROM $3::date)::int-1,1,1) AND $3::date`,[facility,employeeId,paymentDate])).rows
 if(imported.length){result.reconciled=false;result.regularWithholdingVerified=false;result.issues.push({runId:null,messages:['Imported payment totals require supplemental-wage and regular-withholding allocation before this method can be used.'],historicalPaymentIds:imported.map(r=>Number(r.id))})}
 // Reconciliation proves consistency of stored payments, not completeness of
 // employer/common-control history. The off-cycle review must attest completeness.
 return result
}
