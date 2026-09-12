import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementStatementSummary,retirementStatementLines} from '../retirementStatement.js'
import {writeFile} from 'node:fs/promises'
import {statementLines,payStatementPdf} from '../payStatement.js'
const employee={employeeId:1,totalDeductionCents:16000,pretaxDeductionCents:10000,posttaxDeductionCents:6000,retirement401k:{pretaxCents:10000,rothCents:5000},retirementPlans:[{planId:'standard',calculation:{planName:'Employee retirement plan',requiresPayrollIntegration:false,ordinary:{pretax:10000,roth:2000},catchUp:{pretax:0,roth:3000},pretaxCents:10000,rothCents:5000,totalCents:15000,source:{privateReference:'Never disclose'},annualSourceFingerprint:'Private source'}}],payItems:[{kind:'RETIREMENT_401K_PRETAX',amountCents:10000},{kind:'RETIREMENT_401K_ROTH',amountCents:5000},{kind:'POSTTAX_DEDUCTION',name:'Other authorized deduction',amountCents:1000}]}
const row={regular_pay_cents:100000,overtime_pay_cents:0,other_taxable_pay_cents:0,hourly_rate_cents:2500,regular_minutes:2400,overtime_minutes:0,pretax_deduction_cents:10000,posttax_deduction_cents:6000,federal_income_tax_cents:5000,state_income_tax_cents:4000,social_security_tax_cents:6200,medicare_tax_cents:1450,net_pay_cents:67350,statement_snapshot:{payItems:employee.payItems,retirement:retirementStatementSummary(employee)}}
test('employee statement separates retirement tax treatment and catch-up as negative deductions',()=>{
 const result=statementLines(row)
 assert.deepEqual(retirementStatementLines(row),[['401(k) pretax','Employee retirement plan',-10000],['401(k) Roth','Employee retirement plan',-2000],['401(k) Roth catch-up','Employee retirement plan',-3000]])
 assert.equal(result.lines.reduce((n,l)=>n+l[2],0),row.net_pay_cents)
 assert.equal(result.lines.filter(l=>l[0].startsWith('401(k)')).length,3)
 assert.equal(JSON.stringify(row.statement_snapshot.retirement).includes('Private'),false)
 assert.equal(JSON.stringify(row.statement_snapshot.retirement).includes('privateReference'),false)
 const only={...row,posttax_deduction_cents:5000,net_pay_cents:68350,statement_snapshot:{...row.statement_snapshot,payItems:employee.payItems.slice(0,2)}}
 assert.equal(statementLines(only).lines.reduce((n,l)=>n+l[2],0),only.net_pay_cents)
})
test('retirement statements reject incomplete, duplicated or mismatched contribution evidence',()=>{
 assert.throws(()=>statementLines({...row,statement_snapshot:{payItems:employee.payItems}}),/retained/)
 assert.throws(()=>statementLines({...row,pretax_deduction_cents:9999}),/reconcile/)
 const bad=structuredClone(row);bad.statement_snapshot.retirement.plans.push(bad.statement_snapshot.retirement.plans[0]);assert.throws(()=>statementLines(bad),/identity/)
 const missing=structuredClone(row);missing.statement_snapshot.payItems=[];assert.throws(()=>statementLines(missing),/reconcile/)
 assert.equal(retirementStatementSummary({payItems:[]}),null)
})

test('retirement statement PDF renders the retained employee summary',async()=>{
 const pdf=await payStatementPdf({...row,id:101,period_start:'2026-09-01',period_end:'2026-09-15',pay_date:'2026-09-20',statement_snapshot:{...row.statement_snapshot,employeeName:'Synthetic Employee',employeeNumber:'TEST-101',employer:{name:'Synthetic Employer',address:'100 Example Street, Baltimore, MD',phone:'555-0100'}}})
 assert.equal(pdf.subarray(0,5).toString(),'%PDF-')
 if(process.env.RETIREMENT_STATEMENT_PDF_PATH)await writeFile(process.env.RETIREMENT_STATEMENT_PDF_PATH,pdf)
})
