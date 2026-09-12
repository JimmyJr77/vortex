import {retirementStatementLines} from './retirementStatement.js'
import PDFDocument from 'pdfkit'
import { payrollEmployeeAuth } from './employeeAuth.js'

const dollars=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(cents||0)/100)
const date=value=>value instanceof Date?value.toISOString().slice(0,10):String(value||'').slice(0,10)
export function statementLines(row) {
 const retirementLines=retirementStatementLines(row)
 const items=(row.statement_snapshot?.payItems||[]).filter(item=>!item.kind?.startsWith('RETIREMENT_'))
 const gross=Number(row.regular_pay_cents)+Number(row.overtime_pay_cents)+Number(row.other_taxable_pay_cents)
 const rates=row.statement_snapshot?.rateBreakdown?.length?row.statement_snapshot.rateBreakdown:[{hourlyRateCents:Number(row.hourly_rate_cents),regularMinutes:Number(row.regular_minutes),overtimeMinutes:Number(row.overtime_minutes),regularPayCents:Number(row.regular_pay_cents),overtimePayCents:Number(row.overtime_pay_cents)}]
 const salary=row.statement_snapshot?.salaryCalculation
 const split=row.statement_snapshot?.splitCompensation
 const expenseOnly=row.statement_snapshot?.runKind==='OFF_CYCLE_REIMBURSEMENT'
 const lines=expenseOnly||['OFF_CYCLE_BONUS','OFF_CYCLE_PTO'].includes(row.statement_snapshot?.runKind)?[]:salary?[['Salary',`${dollars(salary.annualSalaryCents)} annually / ${salary.periodsPerYear} pay periods`,Number(row.regular_pay_cents)]]:rates.flatMap(rate=>[['Regular wages',`${(rate.regularMinutes/60).toFixed(2)} hours at ${dollars(rate.hourlyRateCents)}/hour`,rate.regularPayCents],['Overtime wages',rate.overtimeMethod==='WEIGHTED'?`${(rate.overtimeMinutes/60).toFixed(2)} hours at ${dollars(rate.hourlyRateCents)}/hour + ${dollars(rate.overtimePremiumCents)} weighted overtime premium`:`${(rate.overtimeMinutes/60).toFixed(2)} hours at ${dollars(rate.hourlyRateCents*1.5)}/hour`,rate.overtimePayCents]])
 if(split?.length){
  lines.length=0
  for(const portion of split){
   const suffix=`${portion.start} through ${portion.end}`
   if(portion.payType==='SALARY'){
    const agreement=portion.salaryCalculation
    lines.push(['Salary',`${suffix} · ${dollars(agreement.annualSalaryCents)} annually / ${agreement.periodsPerYear} pay periods`,portion.regularPayCents])
    if(agreement.classification==='NONEXEMPT')lines.push(['Salary overtime',`${suffix} · ${(portion.overtimeMinutes/60).toFixed(2)} hours at 1.5 × annual salary / ${((agreement.standardWeeklyHours??40)*52).toLocaleString('en-US')}`,portion.overtimePayCents])
   }else for(const rate of portion.rateBreakdown||[]){
    lines.push(['Regular wages',`${suffix} · ${(rate.regularMinutes/60).toFixed(2)} hours at ${dollars(rate.hourlyRateCents)}/hour`,rate.regularPayCents])
    lines.push(['Overtime wages',`${suffix} · ${(rate.overtimeMinutes/60).toFixed(2)} hours at ${dollars(rate.hourlyRateCents*(rate.overtimeMethod==='WEIGHTED'?1:1.5))}/hour${rate.overtimeMethod==='WEIGHTED'?` + ${dollars(rate.overtimePremiumCents)} weighted overtime premium`:''}`,rate.overtimePayCents])
   }
  }
 }
 if(row.statement_snapshot?.authorizedSettlement?.length){
  lines.length=0
  for(const week of row.statement_snapshot.authorizedSettlement){
   lines.push(['Allocated straight-time wages',`${week.periodStart||week.week} through ${week.periodEnd||week.end} · ${(week.workedMinutes/60).toFixed(2)} worked hours`,week.straightTimePayCents])
   lines.push(['Workweek overtime premium',`${(week.overtimeMinutes/60).toFixed(2)} overtime hours · reviewed combined regular rate`,week.overtimePremiumCents])
  }
 }
 if(salary?.classification==='NONEXEMPT')lines.push(['Salary overtime',`${(Number(row.overtime_minutes)/60).toFixed(2)} hours at 1.5 × annual salary / ${((salary.standardWeeklyHours??40)*52).toLocaleString('en-US')}`,Number(row.overtime_pay_cents)])
 if(items.length||retirementLines.length)for(const item of items)lines.push([String(item.name||item.kind).slice(0,160),item.benefitDeduction?`${item.benefitDeduction.month} monthly benefit contribution`:item.kind==='WAGE_CORRECTION'?`Prior work correction #${item.correction?.requestId}${row.statement_snapshot?.correctionSettlements?.find(s=>s.requestId===item.correction?.requestId)?.settlementId?` / settlement #${row.statement_snapshot.correctionSettlements.find(s=>s.requestId===item.correction.requestId).settlementId}`:''}`:item.allocatedLeave?`${item.allocatedLeave.leaveDate} · ${(Number(item.minutes)/60).toFixed(2)} leave hours · ${item.allocatedLeave.includedInSalary?'salary component':'hourly leave'}`:item.includedInSalary?`${Number(item.minutes)/60} hours — included in salary`:item.kind==='LEAVE_PAYOUT'?`${(Number(item.minutes)/60).toFixed(2)} unused PTO hours at ${dollars(item.leavePayout?.hourlyRateCents)}/hour`:item.kind==='SALARY_EXTRA_STRAIGHT_TIME'?`${(Number(item.minutes)/60).toFixed(2)} hours at annual salary / ${((item.salaryStandardWeeklyHours??salary?.standardWeeklyHours??40)*52).toLocaleString('en-US')}`:String(item.kind).replaceAll('_',' '),(['PRETAX_DEDUCTION','POSTTAX_DEDUCTION','GARNISHMENT'].includes(item.kind)?-1:1)*Number(item.amountCents)])
 else for(const [name,key] of [['Other taxable pay','other_taxable_pay_cents'],['Reimbursements','reimbursement_cents'],['Pretax deductions','pretax_deduction_cents'],['Posttax deductions','posttax_deduction_cents'],['Garnishments','garnishment_cents']])if(Number(row[key]))lines.push([name,'',Number(row[key])*(name.includes('deduction')||name==='Garnishments'?-1:1)])
 lines.push(...retirementLines)
 if(!expenseOnly)for(const [name,key] of [['Federal income tax','federal_income_tax_cents'],['Maryland state and local income tax','state_income_tax_cents'],['Social Security','social_security_tax_cents'],['Medicare','medicare_tax_cents'],['Additional Medicare','additional_medicare_tax_cents']])lines.push([name,'Withheld',-Number(row[key]||0)])
 return {lines,gross}
}
export async function payStatementPdf(row) {
 const doc=new PDFDocument({size:'LETTER',margin:48,bufferPages:true,info:{Title:`Pay statement ${row.id}`,Author:'Vortex Payroll'}}),chunks=[]
 const completed=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)})
 const snapshot=row.statement_snapshot||{},employer=snapshot.employer||{}
 const header=()=>{doc.font('Helvetica-Bold').fontSize(10).fillColor('#64748b').text('VORTEX / PAYROLL');doc.moveDown(.7);doc.fontSize(24).fillColor('#0f172a').text(row.statement_snapshot?.runKind==='OFF_CYCLE_REIMBURSEMENT'?'Expense reimbursement':row.statement_snapshot?.runKind==='OFF_CYCLE_BONUS'?'Bonus payment':row.statement_snapshot?.runKind==='OFF_CYCLE_PTO'?'Unused PTO payment':'Pay statement');doc.moveDown(.6)}
 header()
 doc.font('Helvetica-Bold').fontSize(12).text(employer.name||row.legal_business_name||'Employer')
 doc.font('Helvetica').fontSize(10).fillColor('#475569').text(employer.address||row.business_address||'Address unavailable').text(`Telephone: ${employer.phone||row.business_phone||'Not recorded'}`)
 doc.moveDown().font('Helvetica-Bold').fillColor('#0f172a').text(snapshot.employeeName||row.employee_name||'Employee')
 doc.font('Helvetica').fillColor('#475569').text(`Employee number: ${snapshot.employeeNumber||row.employee_number||'-'}`).text(`${snapshot.runKind?.startsWith('OFF_CYCLE_')?'Processing period':'Pay period'}: ${date(row.period_start)} through ${date(row.period_end)}`).text(`Pay date: ${date(row.pay_date)}    Statement: ${row.id}`)
 doc.moveDown(1.5)
 const {lines,gross}=statementLines(row)
 for(const [name,detail,amount] of lines){
  const height=Math.max(34,doc.heightOfString(name,{width:330})+doc.heightOfString(detail,{width:330})+12)
  if(doc.y+height>680){doc.addPage();header()}
  const y=doc.y;doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(name,48,y,{width:360});doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(detail,48,doc.y+2,{width:360});doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(dollars(amount),430,y,{width:134,align:'right'});doc.y=y+height;doc.moveTo(48,doc.y-7).lineTo(564,doc.y-7).strokeColor('#e2e8f0').stroke()
 }
 if(doc.y>630){doc.addPage();header()}
 doc.moveDown(.5).font('Helvetica').fontSize(11).fillColor('#475569').text(`Gross wages: ${dollars(gross)}`,48,doc.y,{width:516})
 doc.moveDown(.4).font('Helvetica-Bold').fontSize(19).fillColor('#047857').text(`Net pay: ${dollars(row.net_pay_cents)}`,48,doc.y,{width:516})
 doc.moveDown(.8).font('Helvetica').fontSize(9).fillColor('#64748b').text('This statement records finalized payroll. It is not a negotiable check.',48,doc.y,{width:516})
 const range=doc.bufferedPageRange();for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);doc.fontSize(8).fillColor('#64748b').text(`Confidential employee pay statement | Page ${i+1} of ${range.count}`,48,730,{lineBreak:false})}
 doc.end();return completed
}
export function registerPayStatementRoutes(app,pool) {
 app.get('/api/payroll/employee/pay-statements/:id.pdf',payrollEmployeeAuth(pool),async(req,res)=>{
  try {
   const row=(await pool.query(`SELECT re.*,p.period_start,p.period_end,COALESCE(r.payment_date,p.pay_date) AS pay_date,ps.legal_business_name,ps.business_address,ps.onboarding_policy->>'businessPhone' AS business_phone,e.employee_number,e.legal_first_name||' '||e.legal_last_name AS employee_name FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_settings ps ON ps.facility_id=r.facility_id JOIN payroll_employee e ON e.id=re.employee_id WHERE re.id=$1 AND re.employee_id=$2 AND r.facility_id=$3 AND r.status='FINALIZED'`,[req.params.id,req.payrollEmployee.employee_id,req.payrollEmployee.facility_id])).rows[0]
   if(!row)return res.status(404).json({success:false,message:'Pay statement not found.'})
   const pdf=await payStatementPdf(row)
   await pool.query(`INSERT INTO payroll_audit_log (facility_id,action,entity_type,entity_id,after_data) VALUES ($1,'STATEMENT_DOWNLOADED','pay_statement',$2,$3)`,[req.payrollEmployee.facility_id,String(row.id),{employeeId:req.payrollEmployee.employee_id}])
   res.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="pay-statement-${row.id}.pdf"`,'Cache-Control':'no-store'}).send(pdf)
  }catch{res.status(500).json({success:false,message:'Unable to generate pay statement.'})}
 })
}
