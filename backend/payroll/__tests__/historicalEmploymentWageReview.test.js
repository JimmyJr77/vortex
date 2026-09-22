import {hashPayrollToken} from '../employeeAuth.js'
import {PDFDocument} from 'pdf-lib'
import {decryptDocument} from '../onboarding.js'
import {compensationCategories} from '../compensationApplicability.js'
import {historicalAnnualWageState} from '../historicalEmploymentWageReview.js'
import {yearEndPreparation} from '../yearEndPreparation.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
const options={skip:!process.env.PAYROLL_TEST_DATABASE_URL}
async function fixture(t){
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const f=await monthlyBenefitsFixture(h),{api,employee}=f
 await api(`/employees/${employee.id}/historical-payments`,{requestId:randomUUID(),periodStart:'2026-08-01',periodEnd:'2026-08-15',paymentDate:'2026-08-18',method:'ACH',reference:'SYNTHETIC-PRIOR-WAGES',grossCents:100000,taxCents:20000,netCents:80000,evidence:'Synthetic original payroll register and payment confirmation',wageOnlyConfirmed:true,confirmed:true},'POST',201)
 const path=`/employees/${employee.id}/historical-employment-wages`,state=()=>api(`${path}?paymentDate=2026-09-18`),current=await state()
 const body={requestKey:randomUUID(),expectedRevision:0,paymentDate:'2026-09-18',sourceFingerprint:current.source.fingerprint,disposition:'REVIEWED',reference:'Reviewed original same-employer payroll register for uncapped taxable wages',confirmed:true,sameEmployerConfirmed:true,uncappedWagesConfirmed:true,completeHistoryConfirmed:true,payments:current.source.payments.map(p=>({paymentId:p.paymentId,wages:{socialSecurityWagesCents:100000,medicareWagesCents:100000,futaWagesCents:100000,marylandUnemploymentWagesCents:100000}}))}
 return {...f,h,path,state,body}
}
test('imported wage review is scoped, immutable, revisioned and recovers exact retries',options,async t=>{
 const {h,api,path,state,body}=await fixture(t)
 assert.equal((await state()).status,'NEEDS_REVIEW')
 const denied=await fetch(h.url+'/api/admin/payroll'+path+'?paymentDate=2026-09-18');assert.equal(denied.status,401)
 const saved=await api(path,body);assert.equal((await state()).status,'REVIEWED')
 assert.deepEqual(await api(path,body),{id:saved.id,reused:true})
 await api(path,{...body,reference:'Different review reference with same request key'},'POST',409)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_historical_employment_wage_review WHERE id=$1',[saved.id]))
 await api(path,{...body,requestKey:randomUUID(),expectedRevision:1,disposition:'UNRESOLVED'})
 assert.equal((await state()).status,'UNRESOLVED');assert.equal((await state()).history.length,2)
 assert.deepEqual(await api(path,body),{id:saved.id,reused:true})
 await h.pool.query("UPDATE payroll_historical_payment SET evidence_note='Changed retained prior payroll evidence'")
 assert.equal((await state()).status,'STALE')
 await api(path,{...body,requestKey:randomUUID(),expectedRevision:2},'POST',409)
})
test('concurrent wage reviews save once and failed audits roll back the ledger',options,async t=>{
 const {h,api,path,state,body}=await fixture(t)
 await h.pool.query("CREATE FUNCTION reject_import_review_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='HISTORICAL_EMPLOYMENT_WAGES_REVIEWED' THEN RAISE EXCEPTION 'Synthetic failed audit'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_import_review_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_import_review_audit()")
 await api(path,body,'POST',500);assert.equal((await state()).history.length,0)
 await h.pool.query('DROP TRIGGER reject_import_review_audit ON payroll_audit_log')
 const send=b=>fetch(h.url+'/api/admin/payroll'+path,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(b)})
 const results=await Promise.all([send(body),send({...body,requestKey:randomUUID()})])
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await state()).history.length,1)
 assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_audit_log WHERE action='HISTORICAL_EMPLOYMENT_WAGES_REVIEWED'")).rows[0].n,1)
})

test('annual imported detail persists exact components and drives annual preparation with stale-source invalidation',options,async t=>{
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1b'.repeat(32);t.after(()=>{if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey})
 const {h,api,path,state,body,employee}=await fixture(t)
 await api(path,body)
 assert.equal((await historicalAnnualWageState(h.pool,1,employee.id)).status,'NEEDS_ANNUAL_DETAIL')
 const annualDetail={federalWagesCents:100000,marylandWagesCents:100000,socialSecurityReportedWagesCents:100000,additionalMedicareWagesCents:0,federalWithheldCents:10000,marylandWithheldCents:2350,socialSecurityWithheldCents:6200,medicareWithheldCents:1450,additionalMedicareWithheldCents:0,qualifiedOvertimePremiumCents:2500,reference:'Original synthetic employer register with separate tax and FLSA detail',registerReconciledConfirmed:true,reportingWagesConfirmed:true,qualifiedOvertimeReviewed:true}
 const next={...body,requestKey:randomUUID(),expectedRevision:1,payments:body.payments.map(p=>({...p,annualDetail}))}
 await api(path,{...next,payments:next.payments.map(p=>({...p,annualDetail:{...annualDetail,federalWithheldCents:10001}}))},'POST',409)
 const saved=await api(path,next)
 assert.deepEqual(await api(path,next),{id:saved.id,reused:true})
 assert.equal((await state()).current.review.payments[0].annualDetail.qualifiedOvertimePremiumCents,2500)
 const annual=await historicalAnnualWageState(h.pool,1,employee.id)
 assert.equal(annual.status,'REVIEWED');assert.equal(annual.totals.medicareWagesCents,100000)
 const prepared=(await yearEndPreparation(h.pool,1)).employees.find(e=>e.employeeId===employee.id)
 assert.deepEqual(prepared.wageInputs,{federal:'1000.00',maryland:'1000.00',socialSecurity:'1000.00',medicare:'1000.00'})
 assert.deepEqual(prepared.withholding,{federal:'100.00',maryland:'23.50',socialSecurity:'62.00',medicare:'14.50',additionalMedicare:'0.00',combinedMedicare:'14.50'})
 assert.equal(prepared.reviewedQualifiedOvertime,'25.00')
 assert.equal(prepared.importedAnnual.reviewId,saved.id)
 // Identity and other annual determinations are still mandatory.
 assert.equal(prepared.w2Draft.status,'REVIEW_REQUIRED')
 const identity={identifier:'123456789',legalName:'Synthetic Employer',firstName:'Monthly',lastName:'Benefits',address:{line1:'123 Test Street',city:'Bowie',state:'MD',postalCode:'20715',country:'US'},reference:'Synthetic verified filing identity evidence',confirmed:true,expectedRevision:0}
 await api('/filing-identity',{...identity,marylandRegistrationNumber:'01234567'},'POST',201);await api(`/employees/${employee.id}/filing-identity`,identity,'POST',201)
 const prepare=async()=>(await api('/reports/year-end-preparation?year=2026')).employees.find(e=>e.employeeId===employee.id)
 const ready=await prepare();assert.equal(ready.sourceStatus,'READY_FOR_REVIEW',JSON.stringify(ready.issues))
 await api(`/employees/${employee.id}/annual-input-review`,{year:2026,expectedReviewId:0,sourceFingerprint:ready.sourceFingerprint,reference:'Synthetic reviewed imported annual preparation',confirmed:true},'POST',201)
 await api(`/employees/${employee.id}/compensation-applicability`,{year:2026,expectedRevision:0,sourceFingerprint:ready.sourceFingerprint,reference:'Synthetic original register compensation review',categories:Object.fromEntries(Object.keys(compensationCategories).map(key=>[key,'NOT_APPLICABLE'])),confirmed:true},'POST',201)
 const determination=await api('/health-coverage-reporting',{year:2026,disposition:'SMALL_EMPLOYER_RELIEF',priorYearW2Count:10,expectedRevision:0,reference:'Synthetic employer health reporting determination',confirmed:true},'POST',201)
 await api(`/employees/${employee.id}/health-coverage-classification`,{year:2026,determinationId:determination.revision,sourceFingerprint:ready.sourceFingerprint,expectedRevision:0,disposition:'RELIEF_USED',reportableCostCents:null,reference:'Synthetic employee health classification review',confirmed:true},'POST',201)
 const mapped=(await prepare()).w2Draft;assert.equal(mapped.status,'DRAFT_REVIEW_REQUIRED',JSON.stringify(mapped.issues))
 assert.equal(mapped.boxes.box1,'1000.00');assert.equal(mapped.boxes.box2,'100.00');assert.equal(mapped.boxes.box3,'1000.00');assert.equal(mapped.boxes.box4,'62.00');assert.equal(mapped.boxes.box5,'1000.00');assert.equal(mapped.boxes.box6,'14.50');assert.equal(mapped.boxes.box17,'23.50');assert.deepEqual(mapped.boxes.box12,[{code:'TT',amount:'25.00'}])
 const approvalPath=`/employees/${employee.id}/w2-approval`,approval=await api(approvalPath,{year:2026,draftFingerprint:mapped.fingerprint,expectedRevision:0,reference:'Synthetic imported W-2 boxes reviewed',confirmed:true},'POST',201)
 const encrypted=(await h.pool.query('SELECT encrypted_form FROM payroll_w2_approval WHERE id=$1',[approval.revision])).rows[0].encrypted_form
 const retained=JSON.parse(decryptDocument(encrypted,`payroll-w2-approval:1:${employee.id}:2026`).toString());assert.deepEqual(retained.draft.boxes,mapped.boxes)
 const pdfResponse=await fetch(`${h.url}/api/admin/payroll${approvalPath}/${approval.revision}/pdf`,{headers:{Authorization:'Bearer payroll-test-admin'}});assert.equal(pdfResponse.status,200)
 const packetBytes=Buffer.from(await pdfResponse.arrayBuffer()),pdf=await PDFDocument.load(packetBytes);assert.equal(pdf.getPageCount(),6);assert.equal(pdf.getForm().getFields().length,0)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[employee.id,hashPayrollToken('synthetic-imported-w2-session')])
 const selfBase=`${h.url}/api/payroll/employee`,headers={Authorization:'Bearer synthetic-imported-w2-session','Content-Type':'application/json'}
 const terms=(await (await fetch(`${selfBase}/w2-electronic/terms`,{headers})).json()).data
 const proof=await fetch(`${selfBase}/w2-electronic/proof`,{method:'POST',headers,body:JSON.stringify({termsFingerprint:terms.fingerprint})});assert.equal(proof.status,200)
 const proofPdf=await PDFDocument.load(await proof.arrayBuffer())
 const consentResponse=await fetch(`${selfBase}/w2-electronic/consent`,{method:'POST',headers,body:JSON.stringify({decision:'CONSENT',confirmed:true,expectedRevision:0,termsFingerprint:terms.fingerprint,proofId:proof.headers.get('x-payroll-proof-id'),code:proofPdf.getForm().getTextField('access-code').getText(),signature:'Synthetic imported wage employee'})});assert.equal(consentResponse.status,201)
 const consent=(await consentResponse.json()).data
 const publication=await api(`${approvalPath}/${approval.revision}/publication`,{consentId:consent.id,reference:'Synthetic imported annual document publication',confirmed:true},'POST',201)
 const employeeDocuments=(await (await fetch(`${selfBase}/w2-documents`,{headers})).json()).data;assert.equal(employeeDocuments.length,1);assert.equal(Number(employeeDocuments[0].id),publication.id)
 const download=await fetch(`${selfBase}/w2-documents/${publication.id}/pdf`,{headers});assert.equal(download.status,200);assert.equal(download.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await download.arrayBuffer()),packetBytes)
 assert.equal((await fetch(`${selfBase}/w2-documents/${publication.id}/pdf`)).status,401)
 await api(path,{...next,requestKey:randomUUID(),expectedRevision:2,disposition:'UNRESOLVED'})
 const unresolved=(await yearEndPreparation(h.pool,1)).employees.find(e=>e.employeeId===employee.id)
 assert.equal((await prepare()).w2ApprovalHistory[0].status,'STALE')
 assert.equal(unresolved.wageInputs.federal,null);assert.equal(unresolved.withholding.federal,null)
 assert.notEqual(unresolved.sourceFingerprint,prepared.sourceFingerprint)
 await api(path,{...next,requestKey:randomUUID(),expectedRevision:3})
 await h.pool.query("UPDATE payroll_historical_payment SET evidence_note='Changed annual original evidence'")
 assert.equal((await historicalAnnualWageState(h.pool,1,employee.id)).status,'STALE')
 const stale=(await yearEndPreparation(h.pool,1)).employees.find(e=>e.employeeId===employee.id)
 assert.equal(stale.reviewedQualifiedOvertime,null);assert.equal(stale.wageInputs.medicare,null)
})
