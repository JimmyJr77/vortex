import test from 'node:test'
import {writeFile} from 'node:fs/promises'
import {statementLines,payStatementPdf} from '../payStatement.js'
import assert from 'node:assert/strict'
import {buildEmployeePreview} from '../payrollEngine.js'
import {calculateWithholding2026} from '../withholding2026.js'
const review={classification:'EXEMPT',annualSalaryCents:5200000,jobTitle:'Manager',workState:'MD',verifiedAt:'2026-01-01T00:00:00Z',salaryBasisVerified:true,dutiesVerified:true,stateRulesVerified:true}
const employee={id:1,payType:'HOURLY',hourlyRateCents:2500,jobTitle:'Manager',workState:'MD',residenceState:'MD',hireDate:'2026-08-03',w4Status:'COMPLETE',stateWithholdingStatus:'COMPLETE'}
const segments=[{employmentStart:'2026-08-03',employmentEnd:'2026-08-08',start:'2026-08-03',end:'2026-08-08',payType:'HOURLY',hourlyRateCents:2500},{employmentStart:'2026-08-10',employmentEnd:null,start:'2026-08-10',end:'2026-08-16',payType:'SALARY',annualSalaryCents:5200000,salaryReview:review}]
const entry=(id,day)=>({id,workDate:day,clockIn:`${day}T12:00:00Z`,clockOut:`${day}T20:00:00Z`,hourlyRateCents:2500,unpaidBreakMinutes:0,status:'APPROVED'})
test('split earnings combine hourly overtime, salary, paid leave and deductions without duplicate payroll taxes',async()=>{
 const taxElection={verified:true,federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}}
 const args={taxElection,employee:{...employee,compensationSegments:segments},payPeriod:{period_start:'2026-08-03',period_end:'2026-08-16'},payFrequency:'BIWEEKLY',timezone:'America/New_York',entries:[...Array.from({length:6},(_,i)=>entry(i+1,`2026-08-0${i+3}`)),entry(7,'2026-08-10')],adjustments:[{kind:'PAID_LEAVE',leaveDate:'2026-08-04',amountCents:2500,minutes:60,taxTreatmentVerified:true},{kind:'PAID_LEAVE',leaveDate:'2026-08-11',amountCents:2500,minutes:60,taxTreatmentVerified:true},{kind:'REIMBURSEMENT',amountCents:10000,taxTreatmentVerified:true},{kind:'POSTTAX_DEDUCTION',amountCents:1500,taxTreatmentVerified:true}]}
 const result=buildEmployeePreview(args)
 assert.equal(result.payType,'MIXED');assert.equal(result.regularPayCents,300000);assert.equal(result.overtimePayCents,30000);assert.equal(result.grossPayCents,332500)
 assert.equal(result.paidLeavePayCents,2500);assert.equal(result.paidLeaveMinutes,120);assert.equal(result.reimbursementCents,10000);assert.equal(result.totalDeductionCents,1500)
 assert.equal(result.socialSecurityTaxCents,Math.round(332500*.062));assert.equal(result.medicareTaxCents,Math.round(332500*.0145))
 assert.equal(result.splitLeaveBasisMinutes,5280);assert.equal(result.payItems.filter(p=>p.kind==='PAID_LEAVE'&&p.includedInSalary).length,1)
 const tax=calculateWithholding2026({grossPayCents:332500,regularWagesCents:332500,election:taxElection,payFrequency:'BIWEEKLY',year:2026,workState:'MD',residenceState:'MD'})
 assert.equal(result.federalIncomeTaxCents,tax.federalIncomeTaxCents);assert.equal(result.stateIncomeTaxCents,tax.stateIncomeTaxCents)
 assert.equal(result.netPayCents,332500+10000-1500-result.socialSecurityTaxCents-result.medicareTaxCents-tax.federalIncomeTaxCents-tax.stateIncomeTaxCents)
 const row={id:1,regular_pay_cents:result.regularPayCents,overtime_pay_cents:result.overtimePayCents,other_taxable_pay_cents:result.otherTaxablePayCents,net_pay_cents:result.netPayCents,federal_income_tax_cents:result.federalIncomeTaxCents,state_income_tax_cents:result.stateIncomeTaxCents,social_security_tax_cents:result.socialSecurityTaxCents,medicare_tax_cents:result.medicareTaxCents,period_start:'2026-08-03',period_end:'2026-08-16',pay_date:'2026-08-21',statement_snapshot:{...result,employer:{name:'Synthetic Payroll Employer',address:'123 Test Street, Bowie MD',phone:'555-010-0000'},employeeName:'Split Earnings Fixture',employeeNumber:'SPLIT-001'}}
 const statement=statementLines(row)
 assert.equal(statement.lines.filter(l=>l[0]==='Salary').length,1)
 assert.ok(statement.lines.some(l=>l[0]==='Salary'&&l[1].includes('2026-08-10 through 2026-08-16')&&l[2]===200000))
 assert.ok(statement.lines.some(l=>l[0]==='Regular wages'&&l[1].includes('2026-08-03 through 2026-08-08')&&l[2]===100000))
 assert.equal(statement.lines.reduce((sum,l)=>sum+Number(l[2]),0),result.netPayCents)
 const pdf=await payStatementPdf(row);assert.ok(pdf.subarray(0,5).toString().startsWith('%PDF'))
 if(process.env.PAYROLL_SPLIT_PDF_PATH)await writeFile(process.env.PAYROLL_SPLIT_PDF_PATH,pdf)
 assert.equal(result.entries.length,7);assert.equal(result.splitCompensation.length,2)
 assert.ok(!result.warnings.some(w=>w.code==='MIXED_EMPLOYMENT_WORKWEEK'))
})
test('workweeks crossing hiring agreements require reconciliation',()=>{
 const sameWeek=[{...segments[0],employmentEnd:'2026-08-05',end:'2026-08-05'},{...segments[1],employmentStart:'2026-08-07',start:'2026-08-07'}]
 const result=buildEmployeePreview({employee:{...employee,compensationSegments:sameWeek},payPeriod:{period_start:'2026-08-03',period_end:'2026-08-16'},payFrequency:'BIWEEKLY',entries:[]})
 assert.ok(result.warnings.some(w=>w.code==='MIXED_EMPLOYMENT_WORKWEEK'&&w.blocking))
})
