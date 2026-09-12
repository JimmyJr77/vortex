import {correctionPremiumEvidence} from './correctionOvertimeSource.js'
import {createHash} from 'node:crypto'
import {calculateTimeCorrection} from './timeCorrectionCalculation.js'
import {compensationEvidence} from './employmentCompensation.js'
import {loadSupplementalPaymentHistory} from './supplementalPaymentHistory.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const day=v=>new Date(v).toISOString().slice(0,10)
const financialFields=['grossPayCents','federalIncomeTaxCents','stateIncomeTaxCents','socialSecurityTaxCents','medicareTaxCents','additionalMedicareTaxCents','employerSocialSecurityTaxCents','employerMedicareTaxCents','futaTaxCents','mdUiTaxCents','totalDeductionCents','netPayCents']
const amounts=e=>Object.fromEntries(financialFields.map(k=>[k,e[k]]))
export async function correctionPaymentPreview(db,facility,request,input,loadPreview,excludedRunId=null){
 const retained=(await db.query("SELECT id,after_data FROM payroll_audit_log WHERE facility_id=$1 AND id=$2 AND entity_type='employee_request' AND entity_id=$3 AND action='TIME_CORRECTION_CALCULATION_RETAINED'",[facility,input.calculationId,String(request.id)])).rows[0]
 if(!retained)throw fail('Retained correction calculation not found.',404)
 const calculation=await calculateTimeCorrection(db,facility,request,loadPreview,excludedRunId)
 if(retained.after_data.calculation.version!==calculation.version||retained.after_data.calculation.fingerprint!==calculation.fingerprint)throw fail('Retain the current correction calculation before preparing its payment.')
 const amount=calculation.workedWagesDifferenceCents
 if(!Number.isSafeInteger(amount)||amount<=0||calculation.runs.some(r=>r.delta.workedWagesCents<0))throw fail('Zero or negative wage differences require separate correction resolution or recovery. Do not net a recovery against this payment.')
 if(calculation.runs.some(r=>r.status!=='FINALIZED'))throw fail('Resolve the original approved payroll before preparing a separate correction payment.')
 if(calculation.leave.status!=='LEAVE_DIFFERENCE_CALCULATED')throw fail('Reconcile correction leave effects before preparing payment.')
 const history=await loadSupplementalPaymentHistory(db,facility,request.employee_id,input.paymentDate)
 if(!history.reconciled)throw fail('Reconcile imported and supplemental wage history before calculating correction withholding.')
 const target=(await db.query("SELECT * FROM payroll_pay_period WHERE facility_id=$1 AND id=$2 AND status<>'VOID'",[facility,input.payPeriodId])).rows[0]
 if(!target)throw fail('Processing pay period not found.',404)
 if(calculation.runs.some(r=>r.periodEnd>=day(target.period_start)))throw fail('Select a later regular payroll for this correction payment.')
 const committed=(await db.query("SELECT id FROM payroll_run WHERE facility_id=$1 AND pay_period_id=$2 AND run_kind='REGULAR' AND status IN ('APPROVED','FINALIZED') AND id<>COALESCE($3::bigint,0)",[facility,input.payPeriodId,excludedRunId])).rows[0]
 if(committed)throw fail('The selected payroll is already committed. Choose a later uncommitted payroll.')
 const originalDates=(await db.query('SELECT COALESCE(r.payment_date,p.pay_date)::text AS paid FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 AND r.id=ANY($2::bigint[])',[facility,calculation.runs.map(r=>r.runId)])).rows
 if(originalDates.some(r=>r.paid>input.paymentDate))throw fail('Correction payment cannot precede the original paid wages.')
 const adjustment={employeeId:Number(request.employee_id),kind:'WAGE_CORRECTION',name:'Prior-period wage correction',amountCents:amount,taxTreatmentVerified:true,federalSupplemental:true,correction:{version:1,requestId:Number(request.id),calculationId:Number(retained.id),fingerprint:calculation.fingerprint}}
 const beforeData=await loadPreview(db,facility,input.payPeriodId,input.paymentDate,excludedRunId)
 const afterData=await loadPreview(db,facility,input.payPeriodId,input.paymentDate,excludedRunId,false,{...request.payload,employeeId:Number(request.employee_id)},[adjustment],{employeeId:Number(request.employee_id),calculationId:Number(retained.id),fingerprint:calculation.fingerprint,plan:calculation.leave})
 const before=beforeData.preview.employees.find(e=>Number(e.employeeId)===Number(request.employee_id)),after=afterData.preview.employees.find(e=>Number(e.employeeId)===Number(request.employee_id))
 if(!before||!after||before.regularPayCents+before.overtimePayCents<=0)throw fail('This method requires the employee to receive regular wages in the selected payroll. A standalone correction method is required otherwise.')
 if(!beforeData.preview.canApprove||!afterData.preview.canApprove)throw fail(`Resolve the processing payroll before preparing the correction: ${[...beforeData.preview.warnings,...afterData.preview.warnings].filter(w=>w.blocking).map(w=>w.message).filter((v,i,a)=>a.indexOf(v)===i).join(' ')}`)
 if(after.payItems.some(i=>i.bonusAllocation||i.bonusReview?.classification==='NONDISCRETIONARY'))throw fail('Reconcile earned-bonus allocation against corrected source time before combining it with this payment.')
 const supplemental=after.payItems.filter(i=>['BONUS','LEAVE_PAYOUT','WAGE_CORRECTION'].includes(i.kind)||i.federalSupplemental===true).reduce((n,i)=>n+i.amountCents,0)
 if(!Number.isSafeInteger(supplemental)||history.ytdSupplementalCents+supplemental>100000000)throw fail('Supplemental wages above $1 million require the mandatory supplemental-rate method.')
 if(financialFields.some(k=>!Number.isSafeInteger(before[k])||!Number.isSafeInteger(after[k])))throw fail('Correction tax amounts do not reconcile to the added wages.')
 if(before.regularMinutes+before.overtimeMinutes!==after.regularMinutes+after.overtimeMinutes)throw fail('The correction must not count prior hours again in current payroll.')
 const delta=Object.fromEntries(financialFields.map(k=>[k,after[k]-before[k]]))
 const targetLeave={before:{accrualMinutes:before.sickLeaveAccrualMinutes,balanceBeforeMinutes:before.sickLeaveBalanceBeforeMinutes,yearAccruedBeforeMinutes:before.sickLeaveYearAccruedBeforeMinutes,fraction:before.sickLeaveFraction},after:{accrualMinutes:after.sickLeaveAccrualMinutes,balanceBeforeMinutes:after.sickLeaveBalanceBeforeMinutes,yearAccruedBeforeMinutes:after.sickLeaveYearAccruedBeforeMinutes,fraction:after.sickLeaveFraction},accrualDifferenceMinutes:after.sickLeaveAccrualMinutes-before.sickLeaveAccrualMinutes,combinedCreditDifferenceMinutes:calculation.leave.creditDifferenceMinutes+after.sickLeaveAccrualMinutes-before.sickLeaveAccrualMinutes,applied:false}
 const currentWageReclassificationCents=after.regularPayCents+after.overtimePayCents-before.regularPayCents-before.overtimePayCents
 if(after.grossPayCents-before.grossPayCents!==amount+currentWageReclassificationCents||before.otherTaxablePayCents+amount!==after.otherTaxablePayCents)throw fail('Reconcile correction-dependent additional earnings before payment.')
 const result={version:3,overtimeSource:correctionPremiumEvidence(calculation.runs,amount),priorWageCorrectionCents:amount,currentWageReclassificationCents,targetHours:{before:{regularMinutes:before.regularMinutes,overtimeMinutes:before.overtimeMinutes},after:{regularMinutes:after.regularMinutes,overtimeMinutes:after.overtimeMinutes}},targetLeave,status:'CORRECTION_PAYMENT_PREVIEW',method:'COMBINED_REGULAR_PAYROLL',input,employeeId:Number(request.employee_id),requestId:Number(request.id),calculationId:Number(retained.id),calculationFingerprint:calculation.fingerprint,periodStart:day(target.period_start),periodEnd:day(target.period_end),paymentDate:input.paymentDate,before:amounts(before),after:amounts(after),delta,currentWorkedMinutes:after.regularMinutes+after.overtimeMinutes,currentLeaveAccrualMinutes:after.sickLeaveAccrualMinutes,correctionLeave:calculation.leave,payItems:after.payItems,paymentApplied:false,historyFingerprint:history.fingerprint,withholdingMethod:after.withholdingMethod}
 const evidence={result,before,after,history}
 return {...result,fingerprint:createHash('sha256').update(JSON.stringify(compensationEvidence(JSON.parse(JSON.stringify(evidence))))).digest('hex')}
}
export function correctionPaymentInput(b){
 const input={calculationId:Number(b.calculationId),payPeriodId:Number(b.payPeriodId),paymentDate:b.paymentDate,historyCompleteConfirmed:b.historyCompleteConfirmed===true,historySource:String(b.historySource||'').trim()}
   if(!Number.isSafeInteger(input.calculationId)||input.calculationId<=0||!Number.isSafeInteger(input.payPeriodId)||input.payPeriodId<=0||!/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate||'')||!Number.isFinite(Date.parse(input.paymentDate))||day(input.paymentDate)!==input.paymentDate||!input.historyCompleteConfirmed||input.historySource.length<20||input.historySource.length>2000)throw fail('Choose a retained calculation, payroll period and valid payment date; confirm complete employer and related-employer wage history with a source.',400)
 return input
}
export function registerCorrectionPaymentPreviewRoutes(app,pool,loadPreview){
 app.post('/api/admin/payroll/requests/:requestId/payroll-correction-payment-preview',async(req,res)=>{
  let db
  try{
   const input=correctionPaymentInput(req.body||{})
   db=await pool.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
   const facility=req.canonicalAccess.facilityId,request=(await db.query("SELECT * FROM payroll_employee_request WHERE facility_id=$1 AND id=$2 AND kind='TIME_CORRECTION'",[facility,req.params.requestId])).rows[0]
   if(!request)throw fail('Time correction request not found.',404)
   const data=await correctionPaymentPreview(db,facility,request,input,loadPreview)
   await db.query('ROLLBACK');res.json({success:true,data})
  }catch(e){if(db)await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to preview correction payment.'})}finally{db?.release()}
 })
}
