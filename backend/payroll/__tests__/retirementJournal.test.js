import test from 'node:test'
import assert from 'node:assert/strict'
import {journalEntries,journalPayload} from '../quickbooks.js'
import {verifyRetirementPosting} from '../retirementJournal.js'
const c={requiresPayrollIntegration:false,ordinary:{pretax:10000,roth:2000},catchUp:{pretax:0,roth:3000},pretaxCents:10000,rothCents:5000,totalCents:15000}
const employee={employeeId:1,pretaxDeductionCents:10000,posttaxDeductionCents:6000,totalDeductionCents:16000,retirement401k:{pretaxCents:10000,rothCents:5000},retirementPlans:[{planId:'standard',calculation:c}],payItems:[{kind:'RETIREMENT_401K_PRETAX',amountCents:10000},{kind:'RETIREMENT_401K_ROTH',amountCents:5000},{kind:'POSTTAX_DEDUCTION',amountCents:1000}]}
const run={id:1,facility_id:1,pay_date:'2026-09-15',gross_pay_cents:100000,employer_tax_cents:7650,employee_tax_cents:15000,reimbursement_cents:0,deduction_cents:16000,net_pay_cents:69000,calculation_snapshot:{employees:[employee]}}
const accounts={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6',retirement:'7'}
test('retirement journals separate plan/treatment liabilities without duplicating other deductions',()=>{
 const lines=journalEntries(run)
 assert.equal(lines.filter(l=>l[0]==='retirement').reduce((n,l)=>n+l[1],0),15000)
 assert.equal(lines.find(l=>l[0]==='deductions')[1],1000)
 assert.equal(lines.filter(l=>l[0]==='retirement').length,3)
 const payload=journalPayload(run,accounts)
 assert.equal(payload.Line.filter(l=>l.JournalEntryLineDetail.AccountRef.value==='7').reduce((n,l)=>n+l.Amount,0),150)
 assert.throws(()=>journalPayload(run,{...accounts,retirement:''}),/account/)
 assert.throws(()=>journalPayload(run,{...accounts,retirement:'5'}),/separate retirement/)
 for(const patch of [{totalDeductionCents:16001},{retirementPlans:[]},{payItems:[]},{retirement401k:{pretaxCents:1,rothCents:5000}},{retirementPlans:[{planId:'standard',calculation:{...c,requiresPayrollIntegration:true}}]}])assert.throws(()=>journalEntries({...run,calculation_snapshot:{employees:[{...employee,...patch}]}}))
})
test('retirement posting requires exact finalized employee and immutable ledger evidence',async()=>{
 let posted=6000,same=true,calls=[]
 const db={query:async(sql,args)=>{calls.push(args);return {rows:sql.includes('payroll_run_employee')?[{pretax_deduction_cents:10000,posttax_deduction_cents:posted}]:[{same}]}}}
 await verifyRetirementPosting(db,run);assert.deepEqual(calls[1],[1,1,1,'standard',c])
 posted=5999;await assert.rejects(verifyRetirementPosting(db,run),/Posted retirement/)
 posted=6000;same=false;await assert.rejects(verifyRetirementPosting(db,run),/exact retained/)
})

test('retirement account mapping verifies provider evidence and preserves optional mappings for older clients',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const {createHarness}=await import('../testing/harness.js'),{encryptDocument}=await import('../onboarding.js')
 const previous=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='c'.repeat(64);t.after(()=>{if(previous===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previous})
 let active=true,type='Other Current Liability',requests=0
 const h=await createHarness({quickbooksFetcher:async(url,options)=>{assert.equal(options.method,'GET');assert.match(String(url),/account\/7$/);requests++;return new Response(JSON.stringify({Account:{Id:'7',Active:active,AccountType:type,CurrencyRef:{value:'USD'}}}),{status:200})}});t.after(()=>h.close())
 await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,environment,account_ids,encrypted_tokens) VALUES(1,'123','sandbox',$1,$2)",[{},encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic',expiresAt:Date.now()+3600000})),'quickbooks:1')])
 const patch=async(accountIds,facility=1)=>fetch(`${h.url}/api/admin/payroll/quickbooks/mapping`,{method:'PATCH',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:JSON.stringify({accountIds,verified:true,autoSync:false})})
 assert.equal((await patch(accounts)).status,200)
 const legacy={...accounts};delete legacy.retirement
 assert.equal((await patch(legacy)).status,200)
 assert.equal((await h.pool.query('SELECT account_ids FROM payroll_quickbooks_connection')).rows[0].account_ids.retirement,'7')
 active=false;assert.equal((await patch(accounts)).status,409)
 active=true;type='Expense';assert.equal((await patch(accounts)).status,409)
 assert.equal((await patch({...accounts,retirement:'5'})).status,400)
 assert.equal((await patch(accounts,2)).status,409)
 assert.equal((await patch({...accounts,retirement:''})).status,200)
 assert.equal((await h.pool.query('SELECT account_ids FROM payroll_quickbooks_connection')).rows[0].account_ids.retirement,undefined)
 assert.equal(requests,4)
})
