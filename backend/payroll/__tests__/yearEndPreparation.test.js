import {runW2ProviderEventSweep} from '../w2NoticeProviderScheduler.js'
import {readFile} from 'node:fs/promises'
import {hashEmail,registerEmailPool,updateDeliveryStatus} from '../../email/emailDeliveryStore.js'
import {reconcileW2NoticeAcceptance} from '../w2NoticeReconciliation.js'
import {dispatchW2Notice,refreshW2NoticeDispatch} from '../w2NoticeDispatch.js'
import {readW2Notice,refreshW2NoticeQueue} from '../w2NoticeQueue.js'
import {hashPayrollToken} from '../employeeAuth.js'
import {refreshW2FurnishingAlerts} from '../w2FurnishingAlerts.js'
import {PDFDocument} from 'pdf-lib'
import {compensationCategories} from '../compensationApplicability.js'
import {decryptDocument} from '../onboarding.js'
import {annualSourceFingerprint} from '../yearEndSource.js'
import {combinedMedicareWithholding} from '../yearEndPreparation.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID,createHash,generateKeyPairSync,sign} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
async function exerciseProviderBounce(h,claim,delivery){
 const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),old=process.env.PAYROLL_SENDGRID_WEBHOOK_PUBLIC_KEY
 process.env.PAYROLL_SENDGRID_WEBHOOK_PUBLIC_KEY=pair.publicKey.export({format:'der',type:'spki'}).toString('base64')
 const event={event:'bounce',sg_event_id:'6g4ZI7SA-xmRDv57GoPIPw==',sg_message_id:'synthetic-provider-message',email:'Notice.Example@example.test',vortex_w2_dispatch:`w2-notice-${claim.dispatch_key}`,timestamp:Math.floor(Date.now()/1000)}
 const post=async(events,status=202,bad=false)=>{const timestamp=String(Math.floor(Date.now()/1000)),body=Buffer.from(JSON.stringify(events)+'\r\n'),signature=sign('sha256',Buffer.concat([Buffer.from(timestamp),body]),pair.privateKey).toString('base64');const response=await fetch(`${h.url}/api/payroll/providers/sendgrid/events`,{method:'POST',headers:{'Content-Type':'application/json','X-Twilio-Email-Event-Webhook-Timestamp':timestamp,'X-Twilio-Email-Event-Webhook-Signature':bad?'YQ==':signature},body});assert.equal(response.status,status,await response.clone().text());return (await response.json()).data}
 try{
  await post([event],401,true);assert.equal((await post([event])).accepted,0)
  await h.pool.query("UPDATE email_delivery SET provider='smtp:sendgrid' WHERE id=$1",[delivery.id])
  assert.equal((await post([{...event,email:'other@example.test'}])).accepted,0)
  assert.equal((await post([{...event,event:'dropped'}])).accepted,0)
  await post([{...event,timestamp:1}],400)
  await post([event,{...event,sg_event_id:'invalid-event',timestamp:1}],400)
  assert.equal((await h.pool.query('SELECT * FROM payroll_w2_provider_event')).rowCount,0)
  const results=await Promise.all([post([event]),post([event])]);assert.ok(results.every(r=>r.accepted===1))
  assert.equal((await h.pool.query('SELECT * FROM payroll_w2_provider_event')).rowCount,1)
  assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='W2_PROVIDER_BOUNCE_RETAINED'")).rowCount,1)
  await post([{...event,sg_message_id:'conflicting-provider-message'}],409)
  assert.equal((await post([{...event,timestamp:String(event.timestamp)}])).accepted,1)
  registerEmailPool(h.pool);try{await updateDeliveryStatus(delivery.id,'accepted')}finally{registerEmailPool(null)}
  assert.equal((await h.pool.query('SELECT status FROM email_delivery WHERE id=$1',[delivery.id])).rows[0].status,'bounced')
  const activity=async(facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll/service-readiness`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':String(facility)}});assert.equal(r.status,200);return (await r.json()).data.w2Provider}
  assert.equal((await activity()).retained,1);assert.equal((await activity()).pending,1);assert.equal((await activity(2)).retained,0)
  const owner=(await h.pool.query('SELECT u.employee_id,p.approval_id FROM payroll_w2_publication u JOIN payroll_w2_packet p ON p.id=u.packet_id JOIN payroll_w2_notice_job j ON j.publication_id=u.id JOIN payroll_w2_notice_attempt a ON a.job_id=j.id WHERE a.id=$1',[claim.id])).rows[0]
  const base=`/api/admin/payroll/employees/${owner.employee_id}/w2-approval/${owner.approval_id}`
  const change=async(path,body,status)=>{const response=await fetch(`${h.url}${base}/${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,status,await response.clone().text());return (await response.json()).data}
  const manual=await change('notice-return',{attemptId:Number(claim.id),returnedAt:new Date().toISOString(),reference:'Synthetic manual return before provider reconciliation',confirmed:true,expectedRevision:0},201)
  const clock=new Date(),key=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY
  try{assert.equal((await runW2ProviderEventSweep(h.pool,{now:()=>clock})).failed,1)}finally{process.env.PAYROLL_DOCUMENT_KEY=key}
  assert.equal((await runW2ProviderEventSweep(h.pool,{now:()=>clock})).checked,0)
  const correction={returnId:manual.id,expectedRevision:0,providerEventId:event.sg_event_id,reference:'Synthetic review of earliest signed provider return',confirmed:true}
  await change('notice-return-correction',{...correction,providerEventId:null,returnedAt:new Date().toISOString()},409)
  await change('notice-return-correction',correction,201);await change('notice-return-correction',correction,409)
  clock.setMinutes(clock.getMinutes()+11)
  const sweeps=await Promise.all([runW2ProviderEventSweep(h.pool,{now:()=>clock}),runW2ProviderEventSweep(h.pool,{now:()=>clock})]);assert.equal(sweeps.reduce((n,r)=>n+r.checked,0),1);assert.equal(sweeps.reduce((n,r)=>n+r.failed,0),0)
  assert.equal((await h.pool.query('SELECT * FROM payroll_w2_provider_processed')).rowCount,1)
  assert.equal((await activity()).pending,0);assert.ok((await activity()).last_checked_at);assert.equal((await activity(2)).last_checked_at,null)
  for(const table of ['payroll_w2_return_correction','payroll_w2_provider_event','payroll_w2_provider_processed','payroll_w2_provider_check'])await assert.rejects(h.pool.query(`DELETE FROM ${table}`),/append-only/)
  const next=(await h.pool.query('INSERT INTO payroll_w2_notice_attempt(job_id,dispatch_key) SELECT job_id,$2 FROM payroll_w2_notice_attempt WHERE id=$1 RETURNING *',[claim.id,randomUUID()])).rows[0]
  await h.pool.query("INSERT INTO payroll_w2_notice_result(attempt_id,outcome,reason) VALUES($1,'UNCERTAIN','synthetic_lost_response')",[next.id])
  await h.pool.query("INSERT INTO email_delivery(facility_id,category,stream,template_version,recipient_hash,status,idempotency_key,provider,accepted_at) SELECT facility_id,category,stream,template_version,recipient_hash,'queued',$2,'smtp:sendgrid',NULL FROM email_delivery WHERE id=$1",[delivery.id,`w2-notice-${next.dispatch_key}`])
  const mistaken=await change('notice-return',{attemptId:Number(next.id),returnedAt:new Date().toISOString(),reference:'Synthetic incorrectly entered manual return',confirmed:true,expectedRevision:0},201)
  const retract={returnId:mistaken.id,expectedRevision:0,reference:'Synthetic review proves manual return entered in error',confirmed:true}
  await change('notice-return-retraction',{...retract,expectedRevision:999999},409);await change('notice-return-retraction',retract,201);await change('notice-return-retraction',retract,409)
  const published=async()=>{const response=await fetch(`${h.url}${base}/publication`,{headers:{Authorization:'Bearer payroll-test-admin'}});return (await response.json()).data.publication.notice}
  assert.equal((await published()).status,'UNCERTAIN');assert.equal((await published()).history[0].is_retracted,true)
  await change('notice-return-correction',{...retract,returnedAt:new Date().toISOString()},409)
  await h.pool.query("UPDATE email_delivery SET status='bounced' WHERE idempotency_key=$1",[`w2-notice-${next.dispatch_key}`])
  await change('notice-return-again',{...retract,returnedAt:new Date().toISOString()},409)
  assert.equal((await h.pool.query('SELECT * FROM payroll_w2_return_correction WHERE return_id=$1',[mistaken.id])).rowCount,0)
  await h.pool.query("UPDATE email_delivery SET status='queued' WHERE idempotency_key=$1",[`w2-notice-${next.dispatch_key}`])
  const cycle=await change('notice-return-again',{...retract,returnedAt:new Date().toISOString(),reference:'Synthetic subsequent real return review'},201)
  assert.equal((await published()).status,'NOTICE_RETURNED')
  const cycleRetraction={...retract,expectedRevision:cycle.correctionId,expectedCycleRevision:cycle.cycleRevision}
  await change('notice-return-retraction',cycleRetraction,201);assert.equal((await published()).status,'UNCERTAIN')

  await post([{...event,sg_event_id:'synthetic-later-provider-return',sg_message_id:'synthetic-next-message',vortex_w2_dispatch:`w2-notice-${next.dispatch_key}`,timestamp:Math.floor(Date.now()/1000)}])
  assert.equal((await published()).status,'NOTICE_RETURNED');assert.equal((await published()).history[0].provider_reinstated,true)
  clock.setMinutes(clock.getMinutes()+11);assert.equal((await runW2ProviderEventSweep(h.pool,{now:()=>clock})).checked,1)
  await change('notice-return-retraction',retract,409)
  const providerCurrent=(await published()).history[0];await change('notice-return-again',{...retract,expectedRevision:Number(providerCurrent.correction_id),expectedCycleRevision:Number(providerCurrent.cycle_revision),returnedAt:new Date().toISOString()},409)
  await change('notice-return-retraction',{...retract,expectedRevision:Number(providerCurrent.correction_id),expectedCycleRevision:Number(providerCurrent.cycle_revision)},409)
  await assert.rejects(h.pool.query("INSERT INTO payroll_w2_return_cycle(return_id,prior_id,correction_id,action,reference,created_by) VALUES($1,$2,$3,'RETURN_RECORDED',$4,99)",[mistaken.id,providerCurrent.cycle_revision,providerCurrent.correction_id,'Synthetic invalid provider override']),/current manual evidence/)
  await assert.rejects(h.pool.query('DELETE FROM payroll_w2_return_retraction'),/append-only/)

 }finally{if(old===undefined)delete process.env.PAYROLL_SENDGRID_WEBHOOK_PUBLIC_KEY;else process.env.PAYROLL_SENDGRID_WEBHOOK_PUBLIC_KEY=old}
}
test('annual source digests canonicalize object order and bind facility and review evidence',()=>{
 const hash=(facility,employee)=>annualSourceFingerprint(facility,{revision:1},employee,{paid:[],imported:[]},[],null)
 assert.equal(hash(1,{a:1,b:2}),hash(1,{b:2,a:1}))
 assert.notEqual(hash(1,{a:1}),hash(2,{a:1}))
 assert.notEqual(hash(1,{a:1}),hash(1,{a:2}))
})
test('combined Medicare uses exact cents and requires both components',()=>{
 assert.equal(combinedMedicareWithholding('3045.00','90.00'),'3135.00')
 assert.equal(combinedMedicareWithholding('0.00','0.00'),'0.00')
 assert.equal(combinedMedicareWithholding('90071992547409.91','0.10'),'90071992547410.01')
 for(const value of [null,undefined,'','1.2','-0.01','NaN',1]){assert.equal(combinedMedicareWithholding(value,'0.00'),null);assert.equal(combinedMedicareWithholding('0.00',value),null)}
})
for(const noticeOutcome of ['SMTP_ACCEPTED','UNCERTAIN','NOT_SENT','INTERRUPTED','PAPER_FIRST'])test(`annual preparation joins masked identities, wage inputs and current overtime reviews (${noticeOutcome})`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');const h=await createHarness();t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const {api,employee,periods}=await monthlyBenefitsFixture(h),path='/reports/year-end-preparation?year=2026'
 assert.deepEqual((await api(path)).employees,[])
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-YEAR-END-INPUT'})
 let preparation=await api(path),record=preparation.employees[0]
 assert.equal(preparation.issuanceAvailable,false);assert.equal(record.sourceStatus,'NEEDS_RECONCILIATION');assert.equal(record.filingIdentity.revision,null);assert.equal(record.reviewedQualifiedOvertime,null);assert.deepEqual(record.wageInputs,{federal:'200.00',maryland:'200.00',socialSecurity:'200.00',medicare:'200.00'})
 const identity={identifier:'123456789',legalName:'Synthetic Employer',firstName:'Monthly',lastName:'Benefits',address:{line1:'123 Test Street',city:'Bowie',state:'MD',postalCode:'20715',country:'US'},reference:'Synthetic verified tax identity worksheet',confirmed:true,expectedRevision:0}
 await api('/filing-identity',identity,'POST',201);await api(`/employees/${employee.id}/filing-identity`,identity,'POST',201)
 const source=(await api('/reports/overtime-review?year=2026')).records[0]
 await api(`/runs/${run.id}/employees/${employee.id}/overtime-qualification`,{sourceFingerprint:source.sourceFingerprint,expectedReviewId:0,qualifiedPremiumCents:0,flsaStatus:'FLSA_REQUIRED',reference:'Synthetic reviewed overtime source worksheet',confirmed:true},'POST',201)
 preparation=await api(path);record=preparation.employees[0];assert.equal(record.sourceStatus,'NEEDS_RECONCILIATION');assert.equal(preparation.employer.marylandRegistrationLast4,null);assert.match(record.issues.join(' '),/Maryland Central Registration Number/);
 await api('/filing-identity',{...identity,expectedRevision:preparation.employer.revision,marylandRegistrationNumber:'01234567'},'POST',201)
 preparation=await api(path);record=preparation.employees[0];assert.equal(preparation.employer.marylandRegistrationLast4,'4567');assert.equal(JSON.stringify(preparation).includes('01234567'),false);assert.equal(record.sourceStatus,'READY_FOR_REVIEW');assert.equal(record.reviewedQualifiedOvertime,'0.00');assert.equal(record.filingIdentity.identifierLast4,'6789');assert.equal(record.withholding.socialSecurity,'12.40');assert.equal(record.withholding.combinedMedicare,'2.90');assert.match(record.sourceFingerprint,/^[a-f0-9]{64}$/);const stableFingerprint=record.sourceFingerprint;assert.equal((await api(path)).employees[0].sourceFingerprint,stableFingerprint);assert.equal(record.benefitContributions.length,1);assert.equal(record.benefitContributions[0].employeeContribution,'125.00');assert.equal(record.benefitContributions[0].month,'2026-09');assert.equal(record.benefitContributions[0].planName,'Medical');assert.equal(record.benefitContributions[0].runId,Number(run.id));
 const applicabilityPath=`/employees/${employee.id}/compensation-applicability`,applicability={year:2026,confirmed:true,expectedRevision:0,sourceFingerprint:stableFingerprint,reference:'Synthetic reviewed compensation applicability',categories:Object.fromEntries(Object.keys(compensationCategories).map(key=>[key,'NOT_APPLICABLE']))}
 const applicabilitySaved=await api(applicabilityPath,applicability,'POST',201);assert.equal((await api(applicabilityPath,applicability)).reused,true);assert.equal((await api(path)).employees[0].sourceFingerprint,stableFingerprint)
 const applicable={...applicability,expectedRevision:applicabilitySaved.revision,categories:{...applicability.categories,tips:'APPLICABLE'}};await api(applicabilityPath,applicable,'POST',201);const applicabilityHistory=(await api(path)).employees[0].compensationApplicabilityHistory;assert.deepEqual(applicabilityHistory.map(r=>r.status),['CURRENT','SUPERSEDED']);assert.equal(applicabilityHistory[0].categories.tips,'APPLICABLE')
 await api(applicabilityPath,{...applicable,reference:'Synthetic newer applicability evidence'},'POST',409)
 await assert.rejects(h.pool.query('DELETE FROM payroll_compensation_applicability WHERE id=$1',[applicabilitySaved.revision]),/append-only/)
 await assert.rejects(h.pool.query('UPDATE payroll_compensation_applicability SET reference=$1 WHERE id=$2',['Synthetic changed review',applicabilitySaved.revision]),/append-only/)
 const wrongFacility=await fetch(`${h.url}/api/admin/payroll${applicabilityPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(applicability)});assert.equal(wrongFacility.status,404)
 const classificationPath=`/employees/${employee.id}/health-coverage-classification`
 const employerDetermination=await api('/health-coverage-reporting',{year:2026,disposition:'REPORT',priorYearW2Count:null,expectedRevision:0,reference:'Synthetic employer reporting evidence',confirmed:true},'POST',201)
 const classification={year:2026,determinationId:employerDetermination.revision,sourceFingerprint:stableFingerprint,expectedRevision:0,disposition:'REPORT',reportableCostCents:690000,reference:'Synthetic annual coverage cost calculation',confirmed:true}
 await api(classificationPath,{...classification,disposition:'RELIEF_USED',reportableCostCents:null},'POST',400)
 const classified=await api(classificationPath,classification,'POST',201);assert.equal((await api(classificationPath,classification)).reused,true)
 const classifiedInput=(await api(path)).employees[0];assert.equal(classifiedInput.sourceFingerprint,stableFingerprint);assert.equal(classifiedInput.healthClassificationHistory[0].status,'CURRENT');assert.equal(classifiedInput.healthClassificationHistory[0].reportable_cost_cents,'690000')
 await api(classificationPath,{...classification,reference:'Synthetic changed cost evidence'},'POST',409)
 await assert.rejects(h.pool.query('UPDATE payroll_employee_health_classification SET reference=$1 WHERE id=$2',['Synthetic changed source',classified.revision]),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_employee_health_classification WHERE id=$1',[classified.revision]),/append-only/)
 await api('/health-coverage-reporting',{year:2026,disposition:'SMALL_EMPLOYER_RELIEF',priorYearW2Count:10,expectedRevision:employerDetermination.revision,reference:'Synthetic revised employer filing evidence',confirmed:true},'POST',201)
 const changed=(await api(path));assert.equal(changed.employees[0].healthClassificationHistory[0].status,'STALE');await api(classificationPath,{...classification,expectedRevision:classified.revision},'POST',409)
 const relief={...classification,determinationId:changed.healthCoverageReporting.revision,expectedRevision:classified.revision,disposition:'RELIEF_USED',reportableCostCents:null}
 const reliefSaved=await api(classificationPath,relief,'POST',201);
 const classificationRace=await Promise.all(['first','second'].map(name=>fetch(`${h.url}/api/admin/payroll${classificationPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({...relief,expectedRevision:reliefSaved.revision,reference:`Synthetic ${name} coverage review`})})));assert.deepEqual(classificationRace.map(r=>r.status).sort(),[201,409])
 const isolatedClassification=await fetch(`${h.url}/api/admin/payroll${classificationPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(relief)});assert.equal(isolatedClassification.status,404)
 await assert.rejects(h.pool.query("INSERT INTO payroll_employee_health_classification(facility_id,employee_id,payment_year,determination_id,source_fingerprint,disposition,reportable_cost_cents,reference,created_by) VALUES(2,$1,2026,$2,$3,'REPORT',1,'Synthetic wrong facility',99)",[employee.id,employerDetermination.revision,stableFingerprint]),/ownership/)
 assert.equal((await api(path)).employees[0].healthClassificationHistory[0].disposition,'RELIEF_USED')
 const reviewPath=`/employees/${employee.id}/annual-input-review`,reviewBody={year:2026,sourceFingerprint:stableFingerprint,expectedReviewId:0,reference:'Synthetic annual payroll inputs reviewed',confirmed:true}
 await api(reviewPath,{...reviewBody,confirmed:false},'POST',400)
 const savedReview=await api(reviewPath,reviewBody,'POST',201);assert.equal((await api(reviewPath,reviewBody)).reused,true)
 const readPath=`${reviewPath}/${savedReview.id}`;const historical=await api(readPath);assert.equal(historical.snapshot.employee.sourceFingerprint,stableFingerprint);assert.equal(JSON.stringify(historical).includes('123456789'),false);assert.equal(JSON.stringify(historical).includes('01234567'),false)
 const readOther=await fetch(`${h.url}/api/admin/payroll${readPath}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(readOther.status,404);assert.equal((await fetch(`${h.url}/api/admin/payroll${readPath}`)).status,401);await api(`/employees/999999/annual-input-review/${savedReview.id}`,undefined,'GET',404)
 let retained=(await api(path)).employees[0];assert.equal(retained.sourceFingerprint,stableFingerprint);assert.equal(retained.inputReviewHistory[0].status,'CURRENT')
 const encrypted=(await h.pool.query('SELECT encrypted_snapshot FROM payroll_annual_input_review WHERE id=$1',[savedReview.id])).rows[0].encrypted_snapshot;assert.equal(encrypted.includes(Buffer.from('Synthetic')),false);const snapshot=JSON.parse(decryptDocument(encrypted,`payroll-annual-input-review:1:${employee.id}:2026`).toString());assert.equal(snapshot.employee.sourceFingerprint,stableFingerprint);assert.equal(snapshot.employee.withholding.combinedMedicare,'2.90');assert.equal(snapshot.employee.inputReviewHistory,undefined)
 await assert.rejects(h.pool.query('INSERT INTO payroll_annual_input_review(facility_id,employee_id,payment_year,source_fingerprint,encrypted_snapshot,reference,created_by) VALUES(2,$1,2026,$2,$3,$4,99)',[employee.id,stableFingerprint,encrypted,'Synthetic wrong facility review']),/employee facility/)
 await assert.rejects(h.pool.query('UPDATE payroll_annual_input_review SET reference=$1 WHERE id=$2',['Changed reference',savedReview.id]),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_annual_input_review WHERE id=$1',[savedReview.id]),/append-only/)
 await api(reviewPath,{...reviewBody,reference:'Synthetic revised annual input review'},'POST',409)
 const concurrent=await Promise.all(['first','second'].map(reference=>fetch(`${h.url}/api/admin/payroll${reviewPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({...reviewBody,expectedReviewId:savedReview.id,reference:`Synthetic concurrent ${reference} review`})})))
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);retained=(await api(path)).employees[0];assert.deepEqual(retained.inputReviewHistory.map(r=>r.status),['CURRENT','SUPERSEDED'])
 const other=await fetch(`${h.url}/api/admin/payroll${reviewPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(reviewBody)});assert.equal(other.status,404)
 const beforeMapping=(await api(path)).employees[0];assert.equal(beforeMapping.w2Draft.boxes,null);assert.match(beforeMapping.w2Draft.issues.join(' '),/detailed reporting treatment/)
 await api(applicabilityPath,{...applicability,expectedRevision:Number(beforeMapping.compensationApplicabilityHistory[0].id),categories:{...applicability.categories,retirement:'EMPLOYER_ONLY_PARTICIPATION'},retirementEmployerOnlyConfirmed:true,reference:'Synthetic reviewed employer-only retirement participation'},'POST',201)
 const mapped=(await api(path)).employees[0].w2Draft;assert.equal(mapped.status,'DRAFT_REVIEW_REQUIRED');assert.equal(mapped.boxes.box13.retirementPlan,true);assert.equal(mapped.boxes.box1,'200.00');assert.equal(mapped.boxes.box6,'2.90');assert.deepEqual(mapped.boxes.box12,[]);assert.equal(mapped.boxes.box15.registrationLast4,'4567')
 const approvalPath=`/employees/${employee.id}/w2-approval`,approvalBody={year:2026,draftFingerprint:mapped.fingerprint,expectedRevision:0,reference:'Synthetic W-2 form boxes reviewed',confirmed:true}
 await api(approvalPath,{...approvalBody,confirmed:false},'POST',400)
 const approval=await api(approvalPath,approvalBody,'POST',201);assert.equal((await api(approvalPath,approvalBody)).reused,true)
 const approvalHistory=(await api(path)).employees[0].w2ApprovalHistory;assert.equal(approvalHistory[0].status,'CURRENT');assert.equal(JSON.stringify(approvalHistory).includes('123456789'),false)
 const encryptedForm=(await h.pool.query('SELECT encrypted_form FROM payroll_w2_approval WHERE id=$1',[approval.revision])).rows[0].encrypted_form;assert.equal(encryptedForm.includes(Buffer.from('123456789')),false)
 const approved=JSON.parse(decryptDocument(encryptedForm,`payroll-w2-approval:1:${employee.id}:2026`).toString());assert.equal(approved.employer.identifier,'123456789');assert.equal(approved.employer.marylandRegistrationNumber,'01234567');assert.equal(approved.employee.identifier,'123456789');assert.equal(approved.draft.boxes.box6,'2.90');assert.equal(approved.draft.boxes.box13.retirementPlan,true)
 await assert.rejects(h.pool.query('UPDATE payroll_w2_approval SET reference=$1 WHERE id=$2',['Synthetic mutation',approval.revision]),/append-only/);await assert.rejects(h.pool.query('DELETE FROM payroll_w2_approval WHERE id=$1',[approval.revision]),/append-only/)
 await assert.rejects(h.pool.query('INSERT INTO payroll_w2_approval(facility_id,employee_id,payment_year,draft_fingerprint,encrypted_form,reference,created_by) VALUES(2,$1,2026,$2,$3,$4,99)',[employee.id,mapped.fingerprint,encryptedForm,'Synthetic wrong owner']),/employee facility/)
 const furnishingPath=`${approvalPath}/${approval.revision}/furnishing`;assert.equal((await api(furnishingPath)).packet,null)
 await api(furnishingPath,{eventType:'PAPER_MAILED',occurredAt:new Date().toISOString(),reference:'Synthetic paper mailing evidence',confirmed:true,expectedRevision:0},'POST',409)
 const pdfPath=`${h.url}/api/admin/payroll${approvalPath}/${approval.revision}/pdf`
 const [pdfResponse,competingPdf]=await Promise.all([1,2].map(()=>fetch(pdfPath,{headers:{Authorization:'Bearer payroll-test-admin'}})));assert.equal(competingPdf.status,200);assert.equal(pdfResponse.status,200);assert.equal(pdfResponse.headers.get('content-type'),'application/pdf');assert.equal(pdfResponse.headers.get('cache-control'),'no-store');assert.match(pdfResponse.headers.get('content-disposition'),/attachment/)
 const packetBytes=Buffer.from(await pdfResponse.arrayBuffer()),approvedPdf=await PDFDocument.load(packetBytes);assert.equal(approvedPdf.getPageCount(),6);assert.equal(approvedPdf.getForm().getFields().length,0);assert.deepEqual(Buffer.from(await competingPdf.arrayBuffer()),packetBytes)
 assert.equal((await fetch(pdfPath,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}})).status,404)
 assert.equal((await fetch(pdfPath)).status,401)
 assert.equal((await fetch(pdfPath.replace(`/${approval.revision}/pdf`,'/0/pdf'),{headers:{Authorization:'Bearer payroll-test-admin'}})).status,400)
 assert.equal((await h.pool.query("SELECT count(*) FROM payroll_audit_log WHERE action='W2_APPROVAL_PDF_DOWNLOADED' AND entity_id=$1",[String(approval.revision)])).rows[0].count,'2')
 const repeatedPackets=await Promise.all([1,2].map(async()=>{const response=await fetch(pdfPath,{headers:{Authorization:'Bearer payroll-test-admin'}});assert.equal(response.status,200);return Buffer.from(await response.arrayBuffer())}));for(const bytes of repeatedPackets)assert.deepEqual(bytes,packetBytes)
 const packetRows=(await h.pool.query('SELECT * FROM payroll_w2_packet WHERE approval_id=$1',[approval.revision])).rows;assert.equal(packetRows.length,1);assert.equal(packetRows[0].content_sha256,createHash('sha256').update(packetBytes).digest('hex'));assert.equal(pdfResponse.headers.get('x-payroll-packet-id'),String(packetRows[0].id));assert.equal(pdfResponse.headers.get('x-payroll-packet-sha256'),packetRows[0].content_sha256);assert.notDeepEqual(packetRows[0].encrypted_pdf,packetBytes)
 assert.deepEqual(decryptDocument(packetRows[0].encrypted_pdf,`payroll-w2-packet:1:${employee.id}:${approval.revision}:2026`),packetBytes)
 await assert.rejects(h.pool.query('UPDATE payroll_w2_packet SET content_sha256=$1 WHERE id=$2',['a'.repeat(64),packetRows[0].id]),/append-only/);await assert.rejects(h.pool.query('DELETE FROM payroll_w2_packet WHERE id=$1',[packetRows[0].id]),/append-only/)
 await assert.rejects(h.pool.query("INSERT INTO payroll_w2_packet(facility_id,employee_id,approval_id,payment_year,content_sha256,encrypted_pdf,renderer_version,created_by) VALUES(2,$1,$2,2026,$3,$4,'irs-2026-v1',99)",[employee.id,approval.revision,packetRows[0].content_sha256,packetRows[0].encrypted_pdf]),/approval ownership/)
 assert.equal((await h.pool.query("SELECT count(*) FROM payroll_audit_log WHERE action='W2_PACKET_RETAINED' AND entity_id=$1",[String(packetRows[0].id)])).rows[0].count,'1')
 const publicationPath=`${approvalPath}/${approval.revision}/publication`,publicationBody={consentId:1,reference:'Synthetic approved W-2 ready for portal publication',confirmed:true}
 const publicationReadiness=await api(publicationPath);assert.equal(publicationReadiness.canPublish,false);assert.match(publicationReadiness.reasons.join(' '),/consent/);await api(publicationPath,publicationBody,'POST',409)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[employee.id,hashPayrollToken('publication-employee-session')])
 const selfHeaders={Authorization:'Bearer publication-employee-session','Content-Type':'application/json'},selfBase=`${h.url}/api/payroll/employee`,disclosure=(await (await fetch(`${selfBase}/w2-electronic/terms`,{headers:selfHeaders})).json()).data
 const accessCheck=await fetch(`${selfBase}/w2-electronic/proof`,{method:'POST',headers:selfHeaders,body:JSON.stringify({termsFingerprint:disclosure.fingerprint})}),proofId=accessCheck.headers.get('x-payroll-proof-id'),proofPdf=await PDFDocument.load(await accessCheck.arrayBuffer())
 const consentResponse=await fetch(`${selfBase}/w2-electronic/consent`,{method:'POST',headers:selfHeaders,body:JSON.stringify({decision:'CONSENT',confirmed:true,expectedRevision:0,termsFingerprint:disclosure.fingerprint,proofId,code:proofPdf.getForm().getTextField('access-code').getText(),signature:'Synthetic publication employee'})});assert.equal(consentResponse.status,201);const consent=(await consentResponse.json()).data;publicationBody.consentId=consent.id;assert.equal((await api(publicationPath)).canPublish,true)
 const publications=await Promise.all([1,2].map(()=>fetch(`${h.url}/api/admin/payroll${publicationPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(publicationBody)})));assert.equal(publications.filter(r=>r.status===201).length,1);assert.ok(publications.every(r=>[200,201,409].includes(r.status)));const publicationResults=await Promise.all(publications.map(r=>r.json())),publication=publicationResults[publications.findIndex(r=>r.status===201)].data;assert.equal(publication.status,'AVAILABLE_NOTICE_PENDING');assert.equal((await api(publicationPath)).publication.status,'AVAILABLE_NOTICE_PENDING');assert.equal((await api(publicationPath,publicationBody)).reused,true)
 const noticeJobs=async()=>(await h.pool.query('SELECT * FROM payroll_w2_notice_job WHERE publication_id=$1 ORDER BY id DESC',[publication.id])).rows
 let queuedJobs=await noticeJobs();assert.equal(queuedJobs.length,1);assert.equal(queuedJobs[0].initial_status,'NEEDS_CONTACT');const missingNotice=readW2Notice(queuedJobs[0]);assert.equal(missingNotice.recipient,null);assert.equal(missingNotice.subject,'IMPORTANT TAX RETURN DOCUMENT AVAILABLE');assert.match(missingNotice.text,/Print command/);assert.equal(missingNotice.text.includes('123456789'),false)
 await h.pool.query("UPDATE payroll_employee SET personal_email='Notice.Example@example.test' WHERE id=$1",[employee.id]);await refreshW2NoticeQueue(h.pool,2);assert.equal((await noticeJobs()).length,1);await refreshW2NoticeQueue(h.pool,1);queuedJobs=await noticeJobs();assert.equal(queuedJobs.length,2);assert.equal(queuedJobs[0].initial_status,'QUEUED');assert.equal(readW2Notice(queuedJobs[0]).recipient,'Notice.Example@example.test');assert.equal(queuedJobs[0].encrypted_notice.includes(Buffer.from('Notice.Example@example.test')),false)
 await refreshW2NoticeQueue(h.pool,1);assert.equal((await noticeJobs()).length,2);await assert.rejects(h.pool.query("UPDATE payroll_w2_notice_job SET initial_status='QUEUED' WHERE id=$1",[queuedJobs[1].id]),/append-only/);await assert.rejects(h.pool.query('DELETE FROM payroll_w2_notice_job WHERE id=$1',[queuedJobs[0].id]),/append-only/)
 await h.pool.query("UPDATE payroll_employee SET personal_email='corrected@example.test' WHERE id=$1",[employee.id]);await Promise.all([refreshW2NoticeQueue(h.pool,1),refreshW2NoticeQueue(h.pool,1)]);assert.equal((await noticeJobs()).length,3);assert.equal(readW2Notice((await noticeJobs())[0]).recipient,'corrected@example.test')
 await h.pool.query('UPDATE payroll_employee SET personal_email=NULL WHERE id=$1',[employee.id]);await refreshW2NoticeQueue(h.pool,1);assert.equal((await noticeJobs()).length,4);assert.equal((await noticeJobs())[0].initial_status,'NEEDS_CONTACT');assert.equal(readW2Notice((await noticeJobs())[0]).recipient,null)
 await h.pool.query("UPDATE payroll_employee SET personal_email='Notice.Example@example.test' WHERE id=$1",[employee.id]);await refreshW2NoticeQueue(h.pool,1);queuedJobs=await noticeJobs();assert.equal(queuedJobs.length,5);assert.equal(readW2Notice(queuedJobs[0]).recipient,'Notice.Example@example.test');await refreshW2NoticeQueue(h.pool,1);assert.equal((await noticeJobs()).length,5)
 const employeeDocuments=(await (await fetch(`${selfBase}/w2-documents`,{headers:selfHeaders})).json()).data;assert.equal(employeeDocuments.length,1);assert.equal(Number(employeeDocuments[0].id),publication.id)
 const employeePdf=await fetch(`${selfBase}/w2-documents/${publication.id}/pdf`,{headers:selfHeaders});assert.equal(employeePdf.status,200);assert.deepEqual(Buffer.from(await employeePdf.arrayBuffer()),packetBytes);assert.equal(employeePdf.headers.get('cache-control'),'no-store')
 assert.equal((await fetch(`${selfBase}/w2-documents/${publication.id}/pdf`)).status,401)
 await assert.rejects(h.pool.query('DELETE FROM payroll_w2_publication WHERE id=$1',[publication.id]),/append-only/)
 const otherEmployee=await api('/employees',{employeeNumber:'W2-OTHER-EMPLOYEE',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},'POST',201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[otherEmployee.id,hashPayrollToken('publication-other-session')])
 const otherHeaders={Authorization:'Bearer publication-other-session'};assert.deepEqual((await (await fetch(`${selfBase}/w2-documents`,{headers:otherHeaders})).json()).data,[]);assert.equal((await fetch(`${selfBase}/w2-documents/${publication.id}/pdf`,{headers:otherHeaders})).status,404)
 const foreignPublication=await fetch(`${h.url}/api/admin/payroll${publicationPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(publicationBody)});assert.equal(foreignPublication.status,404)
 const noticeAlert=(await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`w2-notice-${publication.id}`])).rows[0];assert.equal(noticeAlert.status,'OPEN')
 let noticeSends=0
 const sender=async message=>{noticeSends++;assert.equal(message.to,'Notice.Example@example.test');assert.equal(message.subject,'IMPORTANT TAX RETURN DOCUMENT AVAILABLE');assert.equal(message.category,'payroll_w2_notice');assert.equal(message.attachments,undefined);assert.match(message.idempotencyKey,/^w2-notice-/);if(noticeOutcome==='UNCERTAIN')throw new Error('Synthetic ambiguous SMTP failure');return noticeOutcome==='NOT_SENT'?{sent:false,skipped:true,reason:'category_disabled'}:{sent:true,messageId:'synthetic-smtp-acceptance'}}
 if(noticeOutcome!=='PAPER_FIRST'){
 let interruptResult=noticeOutcome==='INTERRUPTED'
 const dispatchPool={connect:async()=>{const client=await h.pool.connect();return {query:(sql,args)=>{if(interruptResult&&String(sql).startsWith('INSERT INTO payroll_w2_notice_result')){interruptResult=false;throw new Error('Synthetic crash after sender acceptance')}return client.query(sql,args)},release:error=>client.release(error)}}}
 const dispatch=()=>dispatchW2Notice(dispatchPool,1,queuedJobs[0].id,{sender})
 const expectedNotice=noticeOutcome==='INTERRUPTED'?'UNCERTAIN':noticeOutcome
 assert.equal((await dispatchW2Notice(h.pool,2,queuedJobs[0].id,{sender})).status,'NOT_FOUND')
 assert.equal((await dispatchW2Notice(h.pool,1,queuedJobs[1].id,{sender})).status,'SUPERSEDED')
 await h.pool.query("UPDATE payroll_employee SET personal_email='changed@example.test' WHERE id=$1",[employee.id]);assert.equal((await dispatch()).status,'BLOCKED_CONTACT');await h.pool.query("UPDATE payroll_employee SET personal_email='Notice.Example@example.test' WHERE id=$1",[employee.id])
 const priorAddress=(await h.pool.query('SELECT business_address FROM payroll_settings WHERE facility_id=1')).rows[0].business_address
 await h.pool.query("UPDATE payroll_settings SET business_address='Changed synthetic address' WHERE facility_id=1");assert.equal((await dispatch()).status,'BLOCKED_CONSENT');await h.pool.query('UPDATE payroll_settings SET business_address=$1 WHERE facility_id=1',[priorAddress])
 const savedKey=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY;try{assert.equal((await dispatch()).status,'BLOCKED_DOCUMENT')}finally{process.env.PAYROLL_DOCUMENT_KEY=savedKey}
 await refreshW2NoticeDispatch(h.pool,1);assert.equal((await h.pool.query('SELECT count(*)::int AS count FROM payroll_w2_notice_attempt WHERE job_id=$1',[queuedJobs[0].id])).rows[0].count,0);assert.match((await h.pool.query('SELECT message FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`w2-notice-${publication.id}`])).rows[0].message,/SENDER_NOT_CONFIGURED/)
 assert.equal(noticeSends,0)
 const settled=await Promise.allSettled([dispatch(),dispatch()]);assert.equal(settled.filter(r=>r.status==='rejected').length,noticeOutcome==='INTERRUPTED'?1:0);const dispatched=settled.filter(r=>r.status==='fulfilled').map(r=>r.value);assert.ok(dispatched.every(r=>r.status===expectedNotice));assert.equal(dispatched.filter(r=>r.reused).length,1);assert.equal(noticeSends,1);assert.equal((await dispatch()).status,expectedNotice);assert.equal(noticeSends,1)
 await h.pool.query("UPDATE payroll_employee SET personal_email='post-attempt@example.test' WHERE id=$1",[employee.id]);await refreshW2NoticeQueue(h.pool,1);assert.equal((await noticeJobs()).length,5);await h.pool.query("UPDATE payroll_employee SET personal_email='Notice.Example@example.test' WHERE id=$1",[employee.id])
 const attempt=(await h.pool.query('SELECT a.*,r.outcome FROM payroll_w2_notice_attempt a LEFT JOIN payroll_w2_notice_result r ON r.attempt_id=a.id WHERE a.job_id=$1',[queuedJobs[0].id])).rows;assert.equal(attempt.length,1);assert.equal(attempt[0].outcome,noticeOutcome==='INTERRUPTED'?null:noticeOutcome)
 await assert.rejects(h.pool.query('DELETE FROM payroll_w2_notice_attempt WHERE id=$1',[attempt[0].id]),/append-only/);if(noticeOutcome!=='INTERRUPTED')await assert.rejects(h.pool.query("UPDATE payroll_w2_notice_result SET outcome='NOT_SENT' WHERE attempt_id=$1",[attempt[0].id]),/append-only/)
 assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`w2-notice-${publication.id}`])).rows[0].status,noticeOutcome==='SMTP_ACCEPTED'?'DISMISSED':'OPEN')
 await refreshW2NoticeDispatch(h.pool,1,{sender});assert.equal(noticeSends,1);assert.equal((await api(publicationPath)).publication.notice.status,expectedNotice);assert.equal((await api(publicationPath)).publication.status,noticeOutcome==='SMTP_ACCEPTED'?'AVAILABLE_NOTICE_ACCEPTED':'AVAILABLE_NOTICE_PENDING');assert.equal((await api(publicationPath,publicationBody)).status,noticeOutcome==='SMTP_ACCEPTED'?'AVAILABLE_NOTICE_ACCEPTED':'AVAILABLE_NOTICE_PENDING')
 }
 const withdrawal=await fetch(`${selfBase}/w2-electronic/consent`,{method:'POST',headers:selfHeaders,body:JSON.stringify({decision:'WITHDRAW',confirmed:true,expectedRevision:consent.id})});assert.equal(withdrawal.status,201)
 const historicalDownload=await fetch(`${selfBase}/w2-documents/${publication.id}/pdf`,{headers:selfHeaders});assert.equal(historicalDownload.status,200);assert.deepEqual(Buffer.from(await historicalDownload.arrayBuffer()),packetBytes)
 const furnishedBody={eventType:'PAPER_MAILED',occurredAt:new Date().toISOString(),reference:'Synthetic paper mailed to retained address',confirmed:true,expectedRevision:0}
 await api(furnishingPath,{...furnishedBody,confirmed:false},'POST',400);await api(furnishingPath,{...furnishedBody,eventType:'RETURNED_UNDELIVERABLE'},'POST',400);await api(furnishingPath,{...furnishedBody,occurredAt:'2099-01-01T00:00:00.000Z'},'POST',400)
 const furnishing=await api(furnishingPath,furnishedBody,'POST',201);assert.equal((await api(furnishingPath,furnishedBody)).reused,true);assert.equal((await api(furnishingPath)).history.length,1)
 assert.equal((await api(publicationPath)).publication.notice.paperFallback.status,'PAPER_RECORDED');assert.equal((await api(publicationPath)).publication.status,'AVAILABLE_PAPER_RECORDED')
 assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`w2-notice-${publication.id}`])).rows[0].status,'DISMISSED')
 if(noticeOutcome==='PAPER_FIRST'){assert.equal((await dispatchW2Notice(h.pool,1,queuedJobs[0].id,{sender})).status,'PAPER_RECORDED');assert.equal(noticeSends,0)}
 await refreshW2NoticeDispatch(h.pool,1,{sender});assert.equal(noticeSends,noticeOutcome==='PAPER_FIRST'?0:1)

 await api(furnishingPath,{...furnishedBody,reference:'Synthetic competing mailing reference'},'POST',409)
 const returned=await api(furnishingPath,{...furnishedBody,eventType:'RETURNED_UNDELIVERABLE',occurredAt:new Date().toISOString(),reference:'Synthetic returned envelope evidence',expectedRevision:furnishing.id},'POST',201);assert.equal((await api(furnishingPath)).history[0].event_type,'RETURNED_UNDELIVERABLE')
 assert.equal((await api(publicationPath)).publication.notice.paperFallback.status,'PAPER_RETURNED');await refreshW2NoticeDispatch(h.pool,1,{sender});assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`w2-notice-${publication.id}`])).rows[0].status,noticeOutcome==='SMTP_ACCEPTED'?'DISMISSED':'OPEN');assert.equal(noticeSends,noticeOutcome==='PAPER_FIRST'?0:1)
 const deliveryAlert=async()=>(await h.pool.query('SELECT status,message FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`w2-undeliverable-${packetRows[0].id}`])).rows[0]
 assert.equal((await deliveryAlert()).status,'OPEN');assert.equal((await deliveryAlert()).message.includes('123456789'),false)
 await h.pool.query("UPDATE payroll_alert SET status='DISMISSED' WHERE facility_id=1 AND dedupe_key=$1",[`w2-undeliverable-${packetRows[0].id}`]);await refreshW2FurnishingAlerts(h.pool,2);assert.equal((await deliveryAlert()).status,'DISMISSED');await refreshW2FurnishingAlerts(h.pool,1);assert.equal((await deliveryAlert()).status,'OPEN')
 await api(furnishingPath,{...furnishedBody,eventType:'HAND_DELIVERED',occurredAt:new Date().toISOString(),reference:'Synthetic actual employee handoff after return',expectedRevision:returned.id},'POST',201)
 assert.equal((await deliveryAlert()).status,'DISMISSED');await refreshW2FurnishingAlerts(h.pool,1);assert.equal((await deliveryAlert()).status,'DISMISSED')
 await assert.rejects(h.pool.query('UPDATE payroll_w2_furnishing_event SET reference=$1 WHERE id=$2',['Synthetic forbidden edit',returned.id]),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_w2_furnishing_event WHERE id=$1',[returned.id]),/append-only/)
 await assert.rejects(h.pool.query("INSERT INTO payroll_w2_furnishing_event(packet_id,facility_id,employee_id,event_type,occurred_at,reference,created_by) VALUES($1,2,$2,'PAPER_MAILED',clock_timestamp(),'Synthetic wrong owner',99)",[packetRows[0].id,employee.id]),/ownership/)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${furnishingPath}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}})).status,404)
 const approvalRace=await Promise.all(['first','second'].map(name=>fetch(`${h.url}/api/admin/payroll${approvalPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({...approvalBody,expectedRevision:approval.revision,reference:`Synthetic ${name} W-2 approval`})})));assert.deepEqual(approvalRace.map(r=>r.status).sort(),[201,409])
 const latestOldEvent=(await api(furnishingPath)).history[0];const mailedAgain=await api(furnishingPath,{...furnishedBody,occurredAt:new Date().toISOString(),reference:'Synthetic later mailing after handoff',expectedRevision:Number(latestOldEvent.id)},'POST',201)
 const returnedAgain=await api(furnishingPath,{...furnishedBody,eventType:'RETURNED_UNDELIVERABLE',occurredAt:new Date().toISOString(),reference:'Synthetic later returned mailing',expectedRevision:mailedAgain.id},'POST',201)
 const currentPublicationApproval=(await api(path)).employees[0].w2ApprovalHistory[0];await api(`${approvalPath}/${currentPublicationApproval.id}/publication`,publicationBody,'POST',409)
 const replacementApproval=(await api(path)).employees[0].w2ApprovalHistory[0],replacementPdfPath=`${h.url}/api/admin/payroll${approvalPath}/${replacementApproval.id}/pdf`
 const replacementPdf=await fetch(replacementPdfPath,{headers:{Authorization:'Bearer payroll-test-admin'}});assert.equal(replacementPdf.status,200);await replacementPdf.arrayBuffer()
 const replacementPath=`${approvalPath}/${replacementApproval.id}/furnishing`,replacementMailed=await api(replacementPath,{...furnishedBody,occurredAt:new Date().toISOString(),reference:'Synthetic replacement packet actually mailed'},'POST',201)
 const replacementData=(await api(furnishingPath)).replacement;assert.equal(replacementData.candidates.length,1)
 assert.equal((await api(publicationPath)).publication.notice.paperFallback.status,'PAPER_RETURNED')
 const resolutionPath=`${approvalPath}/${approval.revision}/return-resolution`,resolutionBody={returnEventId:returnedAgain.id,replacementPacketId:Number(replacementData.candidates[0].packet_id),replacementEventId:replacementMailed.id,reference:'Synthetic replacement delivery resolves old return',confirmed:true,expectedRevision:0}
 await api(resolutionPath,{...resolutionBody,confirmed:false},'POST',400);await api(resolutionPath,{...resolutionBody,replacementPacketId:Number(packetRows[0].id)},'POST',409)
 const resolution=await api(resolutionPath,resolutionBody,'POST',201);assert.equal((await api(resolutionPath,resolutionBody)).reused,true);assert.equal((await deliveryAlert()).status,'DISMISSED');assert.equal((await api(furnishingPath)).replacement.history[0].status,'CURRENT');const replacementNotice=(await api(publicationPath)).publication.notice;assert.equal(replacementNotice.paperFallback.status,'PAPER_RECORDED');assert.equal(replacementNotice.paperFallback.resolutionId,resolution.id);assert.equal(replacementNotice.paperFallback.eventId,replacementMailed.id);await refreshW2NoticeDispatch(h.pool,1,{sender});assert.equal(noticeSends,noticeOutcome==='PAPER_FIRST'?0:1);assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`w2-notice-${publication.id}`])).rows[0].status,'DISMISSED')
 await assert.rejects(h.pool.query('UPDATE payroll_w2_return_resolution SET reference=$1 WHERE id=$2',['Synthetic wrong mutation',resolution.id]),/append-only/);await assert.rejects(h.pool.query('DELETE FROM payroll_w2_return_resolution WHERE id=$1',[resolution.id]),/append-only/)
 await api(replacementPath,{...furnishedBody,eventType:'RETURNED_UNDELIVERABLE',occurredAt:new Date().toISOString(),reference:'Synthetic replacement packet also returned',expectedRevision:replacementMailed.id},'POST',201)
 await refreshW2FurnishingAlerts(h.pool,1);assert.equal((await deliveryAlert()).status,'OPEN');assert.equal((await api(furnishingPath)).replacement.history[0].status,'STALE');assert.equal((await api(publicationPath)).publication.notice.paperFallback.status,'PAPER_RETURNED');await refreshW2NoticeDispatch(h.pool,1,{sender});assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`w2-notice-${publication.id}`])).rows[0].status,noticeOutcome==='SMTP_ACCEPTED'?'DISMISSED':'OPEN');await api(resolutionPath,resolutionBody,'POST',409)
 const foreignResolution=await fetch(`${h.url}/api/admin/payroll${resolutionPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:JSON.stringify(resolutionBody)});assert.equal(foreignResolution.status,404)
 const otherApproval=await fetch(`${h.url}/api/admin/payroll${approvalPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(approvalBody)});assert.equal(otherApproval.status,404)
 await h.pool.query('UPDATE payroll_run_employee SET posttax_deduction_cents=posttax_deduction_cents+1 WHERE payroll_run_id=$1',[run.id]);const badBenefits=(await api(path)).employees[0];assert.equal(badBenefits.benefitContributions,null);assert.equal(badBenefits.w2Draft.boxes,null);assert.equal(badBenefits.w2ApprovalHistory[0].status,'STALE');await api(approvalPath,approvalBody,'POST',409);assert.equal(badBenefits.compensationApplicabilityHistory[0].status,'STALE');await api(applicabilityPath,applicability,'POST',409);assert.equal(badBenefits.healthClassificationHistory[0].status,'STALE');await api(classificationPath,relief,'POST',409);assert.equal(badBenefits.inputReviewHistory[0].status,'STALE');assert.deepEqual((await api(readPath)).snapshot,historical.snapshot);await api(reviewPath,reviewBody,'POST',409);assert.notEqual(badBenefits.sourceFingerprint,stableFingerprint);assert.equal(badBenefits.sourceStatus,'NEEDS_RECONCILIATION');assert.match(badBenefits.issues.join(' '),/benefit contributions require reconciliation/);await h.pool.query('UPDATE payroll_run_employee SET posttax_deduction_cents=posttax_deduction_cents-1 WHERE payroll_run_id=$1',[run.id]);assert.equal(JSON.stringify(preparation).includes('123456789'),false)
 assert.equal((await api(path)).employees[0].sourceFingerprint,stableFingerprint)
 const currentOvertime=(await api('/reports/overtime-review?year=2026')).records[0];await api(`/runs/${run.id}/employees/${employee.id}/overtime-qualification`,{sourceFingerprint:currentOvertime.sourceFingerprint,expectedReviewId:currentOvertime.reviewId,qualifiedPremiumCents:0,flsaStatus:'FLSA_REQUIRED',reference:'Synthetic replacement overtime review evidence',confirmed:true},'POST',201);const reviewFingerprint=(await api(path)).employees[0].sourceFingerprint;assert.notEqual(reviewFingerprint,stableFingerprint)
 await api('/filing-identity',{...identity,expectedRevision:preparation.employer.revision,marylandRegistrationNumber:'01234567',reference:'Synthetic corrected employer verification reference'},'POST',201);assert.notEqual((await api(path)).employees[0].sourceFingerprint,reviewFingerprint)
 await h.pool.query("INSERT INTO payroll_filing_identity_employee_review(facility_id,employee_id,identity_id,decision) VALUES(1,$1,$2,'CORRECTION_REQUESTED')",[employee.id,record.filingIdentity.revision])
 assert.match((await api(path)).employees[0].issues.join(' '),/Employee requested a correction/);assert.notEqual((await api(path)).employees[0].sourceFingerprint,stableFingerprint)
 await h.pool.query('UPDATE payroll_run_employee SET federal_income_tax_cents=NULL WHERE payroll_run_id=$1',[run.id]);record=(await api(path)).employees[0];assert.equal(record.wageInputs.federal,null);assert.equal(record.withholding.federal,null);assert.equal(record.withholding.combinedMedicare,null);assert.equal(record.sourceStatus,'NEEDS_RECONCILIATION')
 await h.pool.query("INSERT INTO payroll_historical_payment(facility_id,employee_id,period_start,period_end,payment_date,gross_amount_cents,employee_tax_withheld_cents,net_amount_cents,method,reference,reconciliation_status) VALUES(1,$1,'2026-01-16','2026-01-31','2026-02-01',50000,10000,40000,'CHECK','SYNTHETIC-YEAR-END-IMPORT','RECONCILED')",[employee.id])
 record=(await api(path)).employees[0];const importedFingerprint=record.sourceFingerprint;await h.pool.query("UPDATE payroll_historical_payment SET reference='SYNTHETIC-REVISED-IMPORT' WHERE employee_id=$1",[employee.id]);assert.notEqual((await api(path)).employees[0].sourceFingerprint,importedFingerprint);assert.equal(record.importedPaymentCount,1);assert.equal(record.reviewedQualifiedOvertime,null);assert.equal(record.wageInputs.socialSecurity,null);assert.equal(record.withholding.socialSecurity,null);assert.equal(record.withholding.combinedMedicare,null);assert.match(record.issues.join(' '),/Imported payments/)
 if(noticeOutcome==='NOT_SENT'){
  const next=new Date((await api(publicationPath)).publication.notice.retry.nextAttemptAt)
  assert.equal((await dispatchW2Notice(h.pool,1,queuedJobs[0].id,{sender,now:next})).status,'BLOCKED_CONSENT')
  const freshProof=await fetch(`${selfBase}/w2-electronic/proof`,{method:'POST',headers:selfHeaders,body:JSON.stringify({termsFingerprint:disclosure.fingerprint})}),freshProofId=freshProof.headers.get('x-payroll-proof-id'),freshPdf=await PDFDocument.load(await freshProof.arrayBuffer())
  const renewed=await fetch(`${selfBase}/w2-electronic/consent`,{method:'POST',headers:selfHeaders,body:JSON.stringify({decision:'CONSENT',confirmed:true,expectedRevision:(await withdrawal.json()).data.id,termsFingerprint:disclosure.fingerprint,proofId:freshProofId,code:freshPdf.getForm().getTextField('access-code').getText(),signature:'Synthetic retry consent'})});assert.equal(renewed.status,201)
  await h.pool.query("UPDATE payroll_employee SET personal_email='retry@example.test' WHERE id=$1",[employee.id]);await refreshW2NoticeQueue(h.pool,1,{now:new Date(next.getTime()-1)});assert.equal((await noticeJobs()).length,5);await refreshW2NoticeQueue(h.pool,1,{now:next});const retriedJob=(await noticeJobs())[0];assert.equal((await noticeJobs()).length,6);assert.equal(readW2Notice(retriedJob).recipient,'retry@example.test')
  let retrySends=0;const retrySender=async message=>{retrySends++;assert.equal(message.to,'retry@example.test');return {sent:false,skipped:true,reason:'category_disabled'}}
  assert.equal((await dispatchW2Notice(h.pool,1,queuedJobs[0].id,{sender:retrySender,now:next})).status,'SUPERSEDED')
  const retries=await Promise.all([1,2].map(()=>dispatchW2Notice(h.pool,1,retriedJob.id,{sender:retrySender,now:next})));assert.equal(retrySends,1);assert.equal(retries.filter(r=>r.reused).length,1)
  const evidence=(await api(publicationPath)).publication.notice;assert.equal(evidence.retry.attemptCount,2);assert.equal(new Date(evidence.retry.nextAttemptAt).getTime()-next.getTime(),2*86400000)
  const lastTime=new Date(evidence.retry.nextAttemptAt);await dispatchW2Notice(h.pool,1,retriedJob.id,{sender:retrySender,now:lastTime});assert.equal(retrySends,2);assert.equal((await api(publicationPath)).publication.notice.retry.state,'EXHAUSTED')
  await dispatchW2Notice(h.pool,1,retriedJob.id,{sender:retrySender,now:new Date(lastTime.getTime()+7*86400000)});assert.equal(retrySends,2);assert.equal((await api(publicationPath)).publication.notice.retry.attemptCount,3);assert.equal((await api(publicationPath)).publication.notice.history.length,3);assert.ok((await api(publicationPath)).publication.notice.history.every(row=>row.outcome==='NOT_SENT'))
 }
 if(['UNCERTAIN','INTERRUPTED'].includes(noticeOutcome)){
  assert.equal((await reconcileW2NoticeAcceptance(h.pool,2,publication.id)).status,'NOT_FOUND')
  await h.pool.query(await readFile(new URL('../../migrations/044_email_deliverability.sql',import.meta.url),'utf8'))
  const claim=(await h.pool.query('SELECT * FROM payroll_w2_notice_attempt WHERE job_id=$1',[queuedJobs[0].id])).rows[0]
  const delivery=(await h.pool.query("INSERT INTO email_delivery(facility_id,category,stream,template_version,recipient_hash,status,idempotency_key,accepted_at) VALUES(2,'payroll_w2_notice','transactional','w2-notice-2026-v1',$1,'accepted',$2,clock_timestamp()) RETURNING id",[hashEmail('Notice.Example@example.test'),`w2-notice-${claim.dispatch_key}`])).rows[0]
  assert.equal((await reconcileW2NoticeAcceptance(h.pool,1,publication.id)).status,'NO_EVIDENCE')
  await h.pool.query("UPDATE email_delivery SET facility_id=1,recipient_hash='wrong-recipient' WHERE id=$1",[delivery.id]);assert.equal((await reconcileW2NoticeAcceptance(h.pool,1,publication.id)).status,'NO_EVIDENCE')
  await h.pool.query("UPDATE email_delivery SET recipient_hash=$2,status='failed' WHERE id=$1",[delivery.id,hashEmail('Notice.Example@example.test')]);assert.equal((await reconcileW2NoticeAcceptance(h.pool,1,publication.id)).status,'NO_EVIDENCE')
  await h.pool.query("UPDATE email_delivery SET status='accepted',bounced_at=clock_timestamp() WHERE id=$1",[delivery.id]);assert.equal((await reconcileW2NoticeAcceptance(h.pool,1,publication.id)).status,'NO_EVIDENCE')
  await h.pool.query("UPDATE email_delivery SET bounced_at=NULL,accepted_at='2000-01-01' WHERE id=$1",[delivery.id]);assert.equal((await reconcileW2NoticeAcceptance(h.pool,1,publication.id)).status,'NO_EVIDENCE');await h.pool.query('UPDATE email_delivery SET accepted_at=clock_timestamp() WHERE id=$1',[delivery.id]);const recoveries=await Promise.all([1,2].map(()=>reconcileW2NoticeAcceptance(h.pool,1,publication.id)));assert.ok(recoveries.every(r=>r.status==='RECONCILED'))
  const receipts=(await h.pool.query('SELECT * FROM payroll_w2_notice_reconciliation WHERE attempt_id=$1',[claim.id])).rows;assert.equal(receipts.length,1);assert.equal(Number(receipts[0].source_delivery_id),Number(delivery.id));await assert.rejects(h.pool.query('DELETE FROM payroll_w2_notice_reconciliation WHERE id=$1',[receipts[0].id]),/append-only/)
  assert.equal((await h.pool.query('SELECT outcome FROM payroll_w2_notice_result WHERE attempt_id=$1',[claim.id])).rows[0]?.outcome,noticeOutcome==='INTERRUPTED'?undefined:'UNCERTAIN')
  await refreshW2NoticeDispatch(h.pool,1,{sender});assert.equal(noticeSends,1);assert.equal((await api(publicationPath)).publication.notice.status,'SMTP_ACCEPTED');assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`w2-notice-${publication.id}`])).rows[0].status,'DISMISSED');if(noticeOutcome==='INTERRUPTED')await exerciseProviderBounce(h,claim,delivery);else await h.pool.query("UPDATE email_delivery SET status='bounced',bounced_at=clock_timestamp() WHERE id=$1",[delivery.id]);await refreshW2NoticeDispatch(h.pool,1,{sender});assert.equal((await api(publicationPath)).publication.notice.status,'NOTICE_RETURNED');assert.equal(noticeSends,1);assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`w2-notice-${publication.id}`])).rows[0].status,'OPEN');const bounce=(await h.pool.query('SELECT id FROM payroll_w2_notice_return WHERE attempt_id=$1',[claim.id])).rows;assert.equal(bounce.length,1);await assert.rejects(h.pool.query('DELETE FROM payroll_w2_notice_return WHERE id=$1',[bounce[0].id]),/append-only/);await refreshW2NoticeDispatch(h.pool,1,{sender});assert.equal((await h.pool.query('SELECT count(*)::int AS count FROM payroll_w2_notice_return WHERE attempt_id=$1',[claim.id])).rows[0].count,1);const target=(await api(publicationPath)).publication.notice.returnTarget;assert.equal(target.status,'OPEN');const savedZone=(await h.pool.query('SELECT timezone FROM payroll_settings WHERE facility_id=1')).rows[0].timezone;await h.pool.query("UPDATE payroll_settings SET timezone='Pacific/Honolulu' WHERE facility_id=1");assert.equal((await api(publicationPath)).publication.notice.returnTarget.timeZone,savedZone);assert.equal((await api(publicationPath)).publication.notice.returnTarget.dueOn,target.dueOn);await h.pool.query('UPDATE payroll_settings SET timezone=$1 WHERE facility_id=1',[savedZone]);await refreshW2NoticeDispatch(h.pool,1,{sender,now:new Date(Date.parse(target.dueOn+'T12:00:00Z')+86400000)});assert.match((await h.pool.query('SELECT message FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`w2-notice-${publication.id}`])).rows[0].message,/OVERDUE/);await api(furnishingPath,{...furnishedBody,eventType:'HAND_DELIVERED',occurredAt:new Date().toISOString(),reference:'Synthetic paper follow-up after electronic return',expectedRevision:returnedAgain.id},'POST',201);assert.equal((await api(publicationPath)).publication.notice.returnTarget.status,'RESOLVED_ON_TIME');assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`w2-notice-${publication.id}`])).rows[0].status,'DISMISSED')
  if(noticeOutcome==='UNCERTAIN'){
   const history=(await api(publicationPath)).publication.notice.history[0],base=`${approvalPath}/${approval.revision}`,correction={returnId:Number(history.return_id),expectedRevision:0,returnedAt:new Date().toISOString(),reference:'Synthetic manual correction of retained mail-log return',confirmed:true}
   const changed=await api(`${base}/notice-return-correction`,correction,'POST',201)
   await api(`${base}/notice-return-retraction`,{...correction,expectedRevision:changed.id},'POST',409)
   await assert.rejects(h.pool.query('INSERT INTO payroll_w2_return_retraction(return_id,correction_id,followup_timezone,reference,created_by) SELECT return_id,id,followup_timezone,reference,created_by FROM payroll_w2_return_correction WHERE id=$1',[changed.id]),/current manual return evidence/)
  }
 }
 if(['SMTP_ACCEPTED','NOT_SENT'].includes(noticeOutcome)){
  const notice=(await api(publicationPath)).publication.notice,returnPath=`${approvalPath}/${approval.revision}/notice-return`,body={attemptId:Number(notice.history[0].id),returnedAt:new Date().toISOString(),reference:'Synthetic admin retained undeliverable notice',confirmed:true,expectedRevision:0}
  await api(returnPath,{...body,confirmed:false},'POST',400)
  await api(returnPath,{...body,attemptId:999999},'POST',404)
  if(noticeOutcome==='NOT_SENT')await api(returnPath,body,'POST',409)
  else{
   await api(returnPath,{...body,returnedAt:'2000-01-01T00:00:00.000Z'},'POST',400);await api(returnPath,{...body,returnedAt:'2099-01-01T00:00:00.000Z'},'POST',400)
   const wrong=await fetch(`${h.url}/api/admin/payroll${returnPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(body)});assert.equal(wrong.status,404)
   const saved=await api(returnPath,body,'POST',201);assert.equal((await api(returnPath,body)).reused,true);await api(returnPath,{...body,reference:'Synthetic conflicting return reference'},'POST',409)
   const current=(await api(publicationPath)).publication.notice;assert.equal(current.status,'NOTICE_RETURNED');assert.equal(current.history[0].return_source,'ADMIN');assert.equal(current.history[0].return_reference,body.reference);assert.equal(current.returnTarget.status,'OPEN');assert.ok((await h.pool.query('SELECT message FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`w2-notice-${publication.id}`])).rows[0].message.includes(current.returnTarget.dueOn));assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`w2-notice-${publication.id}`])).rows[0].status,'OPEN');await assert.rejects(h.pool.query('DELETE FROM payroll_w2_notice_return WHERE id=$1',[saved.id]),/append-only/)
   const correctionPath=`${approvalPath}/${approval.revision}/notice-return-correction`,correction={returnId:saved.id,expectedRevision:0,returnedAt:new Date().toISOString(),reference:'Synthetic corrected manual return timestamp evidence',confirmed:true}
   await api(correctionPath,{...correction,confirmed:false},'POST',400);await api(correctionPath,{...correction,returnedAt:'2099-01-01T00:00:00.000Z'},'POST',400);await api(correctionPath,{...correction,returnId:999999},'POST',404)
   for(const [headers,status] of [[{'Content-Type':'application/json'},401],[{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},404]])assert.equal((await fetch(`${h.url}/api/admin/payroll${correctionPath}`,{method:'POST',headers,body:JSON.stringify(correction)})).status,status)
   const corrected=await api(correctionPath,correction,'POST',201);await api(correctionPath,correction,'POST',409);await api(returnPath,body,'POST',409)
   const revised=(await api(publicationPath)).publication.notice;assert.equal(revised.history[0].correction_id,String(corrected.id));assert.equal(new Date(revised.history[0].returned_at).toISOString(),correction.returnedAt);assert.equal(revised.history[0].corrections.length,1);assert.equal(revised.status,'NOTICE_RETURNED')
   assert.equal(new Date((await h.pool.query('SELECT returned_at FROM payroll_w2_notice_return WHERE id=$1',[saved.id])).rows[0].returned_at).toISOString(),body.returnedAt)
   await assert.rejects(h.pool.query("INSERT INTO payroll_w2_return_correction(return_id,prior_id,returned_at,followup_timezone,followup_due_on,reference,created_by) SELECT return_id,id,returned_at,followup_timezone,followup_due_on+1,reference,created_by FROM payroll_w2_return_correction WHERE id=$1",[corrected.id]),/recalculate its target/)
   const retainedZone=revised.returnTarget.timeZone;await h.pool.query("UPDATE payroll_settings SET timezone='Pacific/Honolulu' WHERE facility_id=1")
   await api(correctionPath,{...correction,expectedRevision:corrected.id,returnedAt:new Date().toISOString(),reference:'Synthetic second reviewed return timestamp correction'},'POST',201)
   assert.equal((await api(publicationPath)).publication.notice.returnTarget.timeZone,retainedZone);assert.equal((await api(publicationPath)).publication.notice.history[0].corrections.length,2)
   await h.pool.query('UPDATE payroll_settings SET timezone=$1 WHERE facility_id=1',[retainedZone])
   const latest=(await api(publicationPath)).publication.notice.history[0],retraction={returnId:saved.id,expectedRevision:Number(latest.correction_id),reference:'Synthetic evidence manual return was entered in error',confirmed:true}
   for(const [headers,status] of [[{'Content-Type':'application/json'},401],[{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},404]])assert.equal((await fetch(`${h.url}/api/admin/payroll${approvalPath}/${approval.revision}/notice-return-retraction`,{method:'POST',headers,body:JSON.stringify(retraction)})).status,status)
   await api(`${approvalPath}/${approval.revision}/notice-return-retraction`,{...retraction,confirmed:false},'POST',400)
   await api(`${approvalPath}/${approval.revision}/notice-return-retraction`,retraction,'POST',201)
   const retracted=(await api(publicationPath)).publication.notice;assert.equal(retracted.status,'SMTP_ACCEPTED');assert.equal(retracted.returnTarget,null);assert.equal(retracted.history[0].is_retracted,true)
   await api(returnPath,body,'POST',409);assert.equal((await api(publicationPath)).publication.notice.status,'SMTP_ACCEPTED');assert.equal((await h.pool.query('SELECT count(*)::int AS count FROM payroll_w2_notice_return WHERE attempt_id=$1',[body.attemptId])).rows[0].count,1)
   for(let index=0;index<3;index++){
    const before=(await api(publicationPath)).publication.notice.history[0],againPath=`${approvalPath}/${approval.revision}/notice-return-again`,again={returnId:saved.id,expectedRevision:Number(before.correction_id||0),expectedCycleRevision:Number(before.cycle_revision||0),returnedAt:new Date().toISOString(),reference:`Synthetic new actual return review cycle ${index}`,confirmed:true}
    await api(againPath,{...again,confirmed:false},'POST',400);await api(againPath,{...again,expectedCycleRevision:999999},'POST',409)
    await api(againPath,{...again,returnedAt:'2099-01-01T00:00:00.000Z'},'POST',400)
    for(const [headers,status] of [[{'Content-Type':'application/json'},401],[{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},404]])assert.equal((await fetch(`${h.url}/api/admin/payroll${againPath}`,{method:'POST',headers,body:JSON.stringify(again)})).status,status)
    const competing=await Promise.all([0,1].map(()=>fetch(`${h.url}/api/admin/payroll${againPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(again)})))
    assert.deepEqual(competing.map(r=>r.status).sort(),[201,409]);const recorded=(await competing.find(r=>r.status===201).json()).data;await api(againPath,again,'POST',409)
    let active=(await api(publicationPath)).publication.notice;assert.equal(active.status,'NOTICE_RETURNED');assert.equal(active.history[0].is_retracted,false);assert.equal(active.returnTarget.timeZone,retainedZone);assert.equal(active.history[0].return_cycles.length,index*2+1)
    await api(correctionPath,{...correction,expectedRevision:recorded.correctionId,returnedAt:new Date().toISOString()},'POST',409)
    const freshCorrection=await api(correctionPath,{...correction,expectedRevision:recorded.correctionId,expectedCycleRevision:recorded.cycleRevision,returnedAt:new Date().toISOString()},'POST',201)
    const retractAgain={...retraction,expectedRevision:freshCorrection.id,expectedCycleRevision:recorded.cycleRevision,reference:`Synthetic mistaken new return review cycle ${index}`}
    await api(`${approvalPath}/${approval.revision}/notice-return-retraction`,{...retractAgain,expectedCycleRevision:0},'POST',409)
    await api(`${approvalPath}/${approval.revision}/notice-return-retraction`,retractAgain,'POST',201)
    active=(await api(publicationPath)).publication.notice;assert.equal(active.status,'SMTP_ACCEPTED');assert.equal(active.returnTarget,null);assert.equal(active.history[0].return_cycles.length,index*2+2);assert.equal(active.history[0].retraction_reference,retraction.reference)
    await api(againPath,again,'POST',409)
   }
   const beforeReplay=(await api(publicationPath)).publication.notice
   await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'))
   assert.deepEqual((await api(publicationPath)).publication.notice,beforeReplay)
   assert.equal((await h.pool.query("SELECT count(*)::int AS count FROM payroll_audit_log WHERE entity_type='w2_return_cycle' AND action='W2_NOTICE_RETURN_RETRACTED'")).rows[0].count,3)
   const late=(await h.pool.query('INSERT INTO payroll_w2_notice_attempt(job_id,dispatch_key) SELECT job_id,$2 FROM payroll_w2_notice_attempt WHERE id=$1 RETURNING id',[body.attemptId,randomUUID()])).rows[0]
   const lateReturn=await api(returnPath,{...body,attemptId:Number(late.id),returnedAt:new Date().toISOString(),reference:'Synthetic manual review before a send result'},'POST',201)
   await api(`${approvalPath}/${approval.revision}/notice-return-retraction`,{...retraction,returnId:lateReturn.id,expectedRevision:0},'POST',201)
   await h.pool.query("INSERT INTO payroll_w2_notice_result(attempt_id,outcome,reason) VALUES($1,'NOT_SENT','synthetic_late_failure')",[late.id])
   await api(`${approvalPath}/${approval.revision}/notice-return-again`,{...body,returnId:lateReturn.id,returnedAt:new Date().toISOString()},'POST',409)
   assert.equal((await h.pool.query('SELECT * FROM payroll_w2_return_correction WHERE return_id=$1',[lateReturn.id])).rowCount,0)

   await assert.rejects(h.pool.query('DELETE FROM payroll_w2_return_cycle'),/append-only/)
   await assert.rejects(h.pool.query("INSERT INTO payroll_w2_return_cycle(return_id,prior_id,correction_id,action,reference,created_by) SELECT return_id,prior_id,correction_id,action,reference,created_by FROM payroll_w2_return_cycle ORDER BY id LIMIT 1"),/current manual evidence/)


   await assert.rejects(h.pool.query('DELETE FROM payroll_w2_return_correction'),/append-only/)

  }
 }
 delete process.env.PAYROLL_DOCUMENT_KEY;await api(readPath,undefined,'GET',503);assert.match((await api(path)).employer.issue,/cannot be read/)
 await api('/reports/year-end-preparation?year=2025',undefined,'GET',400)
 const response=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual((await response.json()).data.employees,[])
 assert.equal((await fetch(`${h.url}/api/admin/payroll${path}`)).status,401)
})

test('annual preparation combines real finalized Medicare and Additional Medicare and rejects inconsistent taxes',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h,{hourlyRateCents:2625000})
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-ADDITIONAL-MEDICARE'})
 const path='/reports/year-end-preparation?year=2026';let record=(await api(path)).employees[0]
 assert.equal(record.wageInputs.medicare,'210000.00');assert.equal(record.withholding.medicare,'3045.00');assert.equal(record.withholding.additionalMedicare,'90.00');assert.equal(record.withholding.combinedMedicare,'3135.00')
 await h.pool.query('UPDATE payroll_run_employee SET additional_medicare_tax_cents=additional_medicare_tax_cents+1 WHERE payroll_run_id=$1',[run.id]);record=(await api(path)).employees[0];assert.equal(record.withholding.combinedMedicare,null);assert.match(record.issues.join(' '),/posted taxes do not reconcile/)
})
