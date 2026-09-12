import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {compensationCategories} from '../compensationApplicability.js'
import {PDFDocument} from 'pdf-lib'
import {paidOvertimeReview} from '../overtimeSource.js'

// Exercises public annual APIs against the real synthetic engine/approval ledger.
// It does not claim the normal payroll route already creates retirement payroll.
export async function verifyRetirementAnnualApproval(h,employeeId,runId,calculated){
 const previous=process.env.PAYROLL_DOCUMENT_KEY
 process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const api=async(path,body,status=body?201:200)=>{
  const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
  assert.equal(response.status,status,await response.clone().text());return (await response.json()).data
 }
 try{
  const fields={regular_pay_cents:'regularPayCents',overtime_pay_cents:'overtimePayCents',other_taxable_pay_cents:'otherTaxablePayCents',federal_income_tax_cents:'federalIncomeTaxCents',state_income_tax_cents:'stateIncomeTaxCents',social_security_tax_cents:'socialSecurityTaxCents',medicare_tax_cents:'medicareTaxCents',additional_medicare_tax_cents:'additionalMedicareTaxCents',net_pay_cents:'netPayCents'}
  const keys=Object.keys(fields)
  await h.pool.query(`UPDATE payroll_run_employee SET ${keys.map((key,i)=>`${key}=$${i+1}`).join(',')} WHERE payroll_run_id=$${keys.length+1}`,[...keys.map(key=>calculated[fields[key]]),runId])
  const retained=(await h.pool.query('SELECT re.*,r.calculation_snapshot FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id WHERE r.id=$1',[runId])).rows[0]
  assert.equal(paidOvertimeReview(retained).paidPremiumCents,0)
  for(const mutate of [r=>r.pretax_deduction_cents='5001',r=>delete r.statement_snapshot.retirement,r=>r.statement_snapshot.retirement.plans[0].ordinaryPretaxCents++,r=>delete r.calculation_snapshot.employees[0].retirementPlans]){
   const bad=structuredClone(retained);mutate(bad);assert.equal(paidOvertimeReview(bad).paidPremiumCents,null);assert.match(paidOvertimeReview(bad).issues.join(' '),/Retirement deductions/)
  }
  const identity={identifier:'123456789',legalName:'Synthetic Retirement Employer',firstName:'Synthetic',lastName:'Employee',address:{line1:'123 Test Street',city:'Bowie',state:'MD',postalCode:'20715',country:'US'},reference:'Synthetic reviewed retirement filing identity',confirmed:true,expectedRevision:0,marylandRegistrationNumber:'01234567'}
  await api('/filing-identity',identity);await api(`/employees/${employeeId}/filing-identity`,identity)
  const source=(await api('/reports/overtime-review?year=2026')).records.find(r=>r.runId===Number(runId))
  assert.deepEqual(source.issues,[])
  await api(`/runs/${runId}/employees/${employeeId}/overtime-qualification`,{sourceFingerprint:source.sourceFingerprint,expectedReviewId:0,qualifiedPremiumCents:0,flsaStatus:'FLSA_REQUIRED',reference:'Synthetic reviewed retirement payroll overtime',confirmed:true})
  const preparationPath='/reports/year-end-preparation?year=2026',record=(await api(preparationPath)).employees.find(e=>e.employeeId===employeeId)
  assert.equal(record.sourceStatus,'READY_FOR_REVIEW',JSON.stringify(record.issues))
  assert.equal(record.wageInputs.federal,'950.00');assert.equal(record.retirementContributions.pretaxDeferrals,'50.00')
  const base=`/employees/${employeeId}`,review={year:2026,sourceFingerprint:record.sourceFingerprint,expectedRevision:0,confirmed:true,reference:'Synthetic reviewed complete standard 401k compensation',categories:Object.fromEntries(Object.keys(compensationCategories).map(key=>[key,key==='retirement'?'STANDARD_401K_DEFERRALS':'NOT_APPLICABLE']))}
  await api(`${base}/compensation-applicability`,review,400)
  const saved=await api(`${base}/compensation-applicability`,{...review,retirementStandard401kConfirmed:true})
  assert.equal((await api(`${base}/compensation-applicability`,{...review,retirementStandard401kConfirmed:true},200)).reused,true)
  await api(`${base}/compensation-applicability`,{...review,expectedRevision:saved.revision,categories:{...review.categories,retirement:'NOT_APPLICABLE'}},409)
  const health=await api('/health-coverage-reporting',{year:2026,disposition:'REPORT',priorYearW2Count:null,expectedRevision:0,reference:'Synthetic reviewed employer annual health reporting',confirmed:true})
  await api(`${base}/health-coverage-classification`,{year:2026,determinationId:health.revision,sourceFingerprint:record.sourceFingerprint,expectedRevision:0,disposition:'NO_APPLICABLE_COVERAGE',reportableCostCents:null,reference:'Synthetic verified no reportable health coverage',confirmed:true})
  await api(`${base}/annual-input-review`,{year:2026,sourceFingerprint:record.sourceFingerprint,expectedReviewId:0,reference:'Synthetic verified annual retirement wages and contributions',confirmed:true})
  const draft=(await api(preparationPath)).employees.find(e=>e.employeeId===employeeId).w2Draft
  assert.equal(draft.status,'DRAFT_REVIEW_REQUIRED',JSON.stringify(draft.issues));assert.equal(draft.boxes.box1,'950.00');assert.deepEqual(draft.boxes.box12,[{code:'D',amount:'50.00'}]);assert.equal(draft.boxes.box13.retirementPlan,true)
  const approval=await api(`${base}/w2-approval`,{year:2026,draftFingerprint:draft.fingerprint,expectedRevision:0,reference:'Synthetic reviewed retirement W-2 boxes and source records',confirmed:true})
  const pdf=await fetch(`${h.url}/api/admin/payroll${base}/w2-approval/${approval.revision}/pdf`,{headers:{Authorization:'Bearer payroll-test-admin'}})
  assert.equal(pdf.status,200,await pdf.clone().text());const document=await PDFDocument.load(await pdf.arrayBuffer());assert.equal(document.getPageCount(),6);assert.equal(document.getForm().getFields().length,0)
  await h.pool.query('UPDATE payroll_run_employee SET pretax_deduction_cents=pretax_deduction_cents+1 WHERE payroll_run_id=$1',[runId])
  const changed=(await api(preparationPath)).employees.find(e=>e.employeeId===employeeId)
  assert.equal(changed.sourceStatus,'NEEDS_RECONCILIATION');assert.equal(changed.w2Draft.boxes,null);assert.equal(changed.w2ApprovalHistory[0].status,'STALE')
  await api(`${base}/w2-approval`,{year:2026,draftFingerprint:draft.fingerprint,expectedRevision:approval.revision,reference:'Synthetic stale retirement approval must not succeed',confirmed:true},409)
  await h.pool.query('UPDATE payroll_run_employee SET pretax_deduction_cents=pretax_deduction_cents-1 WHERE payroll_run_id=$1',[runId])
  assert.equal((await api(preparationPath)).employees.find(e=>e.employeeId===employeeId).w2ApprovalHistory[0].status,'CURRENT')
 }finally{if(previous===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previous}
}
