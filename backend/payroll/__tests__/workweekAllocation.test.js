import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('scoped allocation preview derives hours and hourly earnings without authorizing payment',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'ALLOCATION',legalFirstName:'Allocation',legalLastName:'Preview',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-05' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2026-08-07',termination_date=NULL,pay_type='SALARY',annual_salary_cents=6240000 WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/salary-review`,{classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,confirmed:true,source:'Synthetic fixed salary hiring agreement'})
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 for(const [day,hours] of [['03',8],['04',8],['05',8],['07',8],['08',8],['09',10]])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${day}T12:00Z`,`2026-08-${day}T${12+hours}:00Z`])
 const p=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 const path=`/employees/${e.id}/workweek-allocation-preview`,body={payPeriodId:p.id,week:'2026-08-03',salaryAllocations:[{employmentStart:'2026-08-07',earningsCents:120000,source:'Synthetic allocation of full weekly salary to this workweek'}]}
 const before=(await h.pool.query('SELECT COUNT(*)::int n FROM payroll_audit_log')).rows[0].n
 const result=await api(path,body)
 assert.equal(result.status,'DRAFT_ALLOCATION');assert.equal(result.paymentApplied,false)
 assert.equal(result.calculation.workedMinutes,3000);assert.equal(result.calculation.straightTimePayCents,180000);assert.equal(result.calculation.overtimePremiumCents,18000)
 assert.equal(result.inputs[0].minutes,1440);assert.equal(result.inputs[0].hourlyRateCents,2500);assert.equal(result.inputs[1].minutes,1560)
 assert.equal((await api(path,body)).fingerprint,result.fingerprint)
 assert.equal((await api(path,{...body,salaryAllocations:[{...body.salaryAllocations[0],minutes:1,hourlyRateCents:1}]})).calculation.workedMinutes,3000)
 const changed=await api(path,{...body,salaryAllocations:[{...body.salaryAllocations[0],earningsCents:130000}]});assert.notEqual(changed.fingerprint,result.fingerprint)
 await api(path,body,404,2);await api(path,{...body,week:'bad'},400);await api(path,{...body,week:'2026-08-10'},409)
 for(const salaryAllocations of [[],[null],[...body.salaryAllocations,...body.salaryAllocations],[{...body.salaryAllocations[0],earningsCents:1}],[{...body.salaryAllocations[0],source:'short'}],[{...body.salaryAllocations[0],earningsCents:Number.MAX_SAFE_INTEGER}]])await api(path,{...body,salaryAllocations},409)
 await h.pool.query("UPDATE payroll_time_entry SET status='UNVERIFIED' WHERE employee_id=$1 AND clock_in='2026-08-09T12:00Z'",[e.id])
 await api(path,body,409)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_audit_log')).rows[0].n,before)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_run')).rows[0].n,0)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_leave_transaction')).rows[0].n,0)
 await h.pool.query("UPDATE payroll_time_entry SET status='APPROVED',clock_out='2026-08-09T23:00Z' WHERE employee_id=$1 AND clock_in='2026-08-09T12:00Z'",[e.id])
 const savePath=`/employees/${e.id}/workweek-allocations`,save={...body,fingerprint:result.fingerprint,requestId:'allocation-review-test-001',reason:'Reviewed the complete salary allocation and supporting records',confirmed:true}
 await api(savePath,save,409)
 const fresh=await api(path,body);save.fingerprint=fresh.fingerprint
 await api(savePath,{...save,confirmed:false},400);await api(savePath,save,404,2)
 await h.pool.query("CREATE FUNCTION reject_allocation_review() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='WORKWEEK_ALLOCATION_REVIEWED' THEN RAISE EXCEPTION 'Synthetic allocation audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_allocation_review BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_allocation_review()')
 await api(savePath,save,500)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_audit_log WHERE action='WORKWEEK_ALLOCATION_REVIEWED'")).rows[0].n,0)
 await h.pool.query('DROP TRIGGER reject_allocation_review ON payroll_audit_log')
 const concurrent=await Promise.all(Array.from({length:3},async()=>{const response=await fetch(`${h.url}/api/admin/payroll${savePath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(save)});return {status:response.status,data:(await response.json()).data}}))
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,200,201]);assert.equal(new Set(concurrent.map(r=>r.data.id)).size,1)
 const saved=concurrent[0].data;assert.equal(saved.status,'REVIEWED_ALLOCATION');assert.equal(saved.paymentApplied,false)
 const replay=await api(savePath,save);assert.equal(replay.id,saved.id)
 await api(savePath,{...save,reason:'Changed reasoning using the same review reference'},409)
 const current=(await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0].employmentWeekReviews[0].allocationReview
 assert.equal(current.status,'CURRENT');assert.equal(current.id,saved.id)
 const authorizationPath=`/employees/${e.id}/workweek-settlement-authorizations`
 const evidence=(await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0].employmentWeekReviews[0]
 const authorization={payPeriodId:p.id,week:body.week,fingerprint:evidence.paymentReconciliation.fingerprint,reason:'Reviewed all payroll history and documented unpaid workweek earnings',historyComplete:true,confirmed:true,requestId:'settlement-authorization-001'}
 await api(authorizationPath,{...authorization,historyComplete:false},400)
 await api(authorizationPath,{...authorization,confirmed:false},400)
 await api(authorizationPath,authorization,404,2)
 await api(authorizationPath,{...authorization,fingerprint:'0'.repeat(64)},409)
 await h.pool.query("CREATE FUNCTION reject_settlement_authorization() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='WORKWEEK_SETTLEMENT_AUTHORIZED' THEN RAISE EXCEPTION 'Synthetic settlement audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_settlement_authorization BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_settlement_authorization()')
 await api(authorizationPath,authorization,500)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_audit_log WHERE action='WORKWEEK_SETTLEMENT_AUTHORIZED'")).rows[0].n,0)
 await h.pool.query('DROP TRIGGER reject_settlement_authorization ON payroll_audit_log')
 const authorized=await Promise.all(Array.from({length:3},async()=>{const r=await fetch(`${h.url}/api/admin/payroll${authorizationPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(authorization)});return {status:r.status,data:(await r.json()).data}}))
 assert.deepEqual(authorized.map(r=>r.status).sort(),[200,200,201]);assert.equal(new Set(authorized.map(r=>r.data.id)).size,1)
 assert.equal(authorized[0].data.historyCompletenessVerified,true);assert.equal(authorized[0].data.paymentApplied,false)
 assert.equal((await api(authorizationPath,authorization)).id,authorized[0].data.id)
 await api(authorizationPath,{...authorization,reason:'Changed rationale using the same settlement reference'},409)
 assert.equal((await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0].employmentWeekReviews[0].settlementAuthorization.status,'CURRENT')
 const applied=(await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0]
 assert.equal(applied.regularPayCents,fresh.calculation.straightTimePayCents)
 assert.equal(applied.overtimePayCents,fresh.calculation.overtimePremiumCents)
 assert.equal(applied.otherTaxablePayCents,0)
 assert.equal(applied.authorizedSettlement[0].authorizationId,authorized[0].data.id)
 assert.equal(applied.workweekPayments.length,1)

 await h.pool.query("UPDATE payroll_time_entry SET status='UNVERIFIED' WHERE employee_id=$1 AND clock_in='2026-08-09T12:00Z'",[e.id])
 const stale=(await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0].employmentWeekReviews[0].allocationReview
 assert.equal(stale.status,'STALE');assert.equal(stale.id,saved.id)
 assert.equal((await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0].employmentWeekReviews[0].settlementAuthorization.status,'STALE')
 await api(authorizationPath,{...authorization,requestId:'settlement-authorization-stale'},409)
 await h.pool.query("UPDATE payroll_time_entry SET status='APPROVED' WHERE employee_id=$1 AND clock_in='2026-08-09T12:00Z'",[e.id])
 assert.equal((await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0].employmentWeekReviews[0].allocationReview.status,'CURRENT')
 assert.equal((await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0].employmentWeekReviews[0].settlementAuthorization.status,'CURRENT')
 const history=await fetch(`${h.url}/api/admin/payroll${savePath}`,{headers:{Authorization:'Bearer payroll-test-admin'}})
 assert.equal(history.status,200);const records=(await history.json()).data;assert.equal(records.length,1);assert.equal(records[0].fingerprint,fresh.fingerprint)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_run')).rows[0].n,0)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_leave_transaction')).rows[0].n,0)
 const historical=await api(`/employees/${e.id}/historical-payments`,{requestId:'allocation-import-record',periodStart:'2026-08-03',periodEnd:'2026-08-05',paymentDate:'2026-08-14',method:'CHECK',reference:'IMPORTED-CHECK-001',grossCents:60000,taxCents:12000,netCents:48000,evidence:'Synthetic prior wage register and cleared payment',confirmed:true,wageOnlyConfirmed:true},201)
 const importPath=`/employees/${e.id}/historical-payments/${historical.id}/allocation-preview`
 const importAuditBefore=(await h.pool.query('SELECT COUNT(*)::int n FROM payroll_audit_log')).rows[0].n
 const imported=await api(importPath,{payPeriodId:p.id})
 assert.equal(imported.weeks[0].workedMinutes,1440);assert.equal(imported.weeks[0].straightTimePayCents,60000);assert.equal(imported.paymentApplied,false)
 await api(importPath,{payPeriodId:p.id},404,2)
 await api(importPath,{payPeriodId:0},400)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_audit_log')).rows[0].n,importAuditBefore)
 const retainPath=importPath.replace('/allocation-preview','/allocations')
 const retain={payPeriodId:p.id,fingerprint:imported.fingerprint,requestId:'imported-allocation-review-001',reason:'Reviewed wage register against all dated earnings and premium coverage',sourceConfirmed:true,confirmed:true}
 await api(retainPath,{...retain,sourceConfirmed:false},400)
 await api(retainPath,retain,404,2)
 await api(retainPath,{...retain,fingerprint:'0'.repeat(64)},409)
 await h.pool.query("CREATE FUNCTION reject_import_review() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='HISTORICAL_ALLOCATION_REVIEWED' THEN RAISE EXCEPTION 'Synthetic import audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_import_review BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_import_review()')
 await api(retainPath,retain,500)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_audit_log')).rows[0].n,importAuditBefore)
 await h.pool.query('DROP TRIGGER reject_import_review ON payroll_audit_log')
 const retained=await Promise.all(Array.from({length:3},async()=>{const r=await fetch(`${h.url}/api/admin/payroll${retainPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(retain)});return {status:r.status,data:(await r.json()).data}}))
 assert.deepEqual(retained.map(r=>r.status).sort(),[200,200,201]);assert.equal(new Set(retained.map(r=>r.data.id)).size,1)
 assert.equal(retained[0].data.status,'REVIEWED_IMPORTED_ALLOCATION');assert.equal(retained[0].data.paymentApplied,false)
 await api(retainPath,{...retain,reason:'Changed reason with previously retained request reference'},409)
 const importHistory=await fetch(`${h.url}/api/admin/payroll${retainPath}`,{headers:{Authorization:'Bearer payroll-test-admin'}})
 assert.equal(importHistory.status,200);assert.equal((await importHistory.json()).data.length,1)
 const scopedHistory=await fetch(`${h.url}/api/admin/payroll${retainPath}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}})
 assert.equal(scopedHistory.status,404)
 await h.pool.query("UPDATE payroll_historical_payment SET evidence_note='Changed source evidence invalidates prior allocation fingerprint' WHERE id=$1",[historical.id])
 await api(retainPath,{...retain,requestId:'imported-allocation-review-stale'},409)
 assert.equal((await api(retainPath,retain)).id,retained[0].data.id)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_run')).rows[0].n,0)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_leave_transaction')).rows[0].n,0)
 assert.equal(Number((await h.pool.query('SELECT gross_amount_cents FROM payroll_historical_payment WHERE id=$1',[historical.id])).rows[0].gross_amount_cents),60000)
 const leaveRequest=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,status,payload) VALUES(1,$1,'LEAVE','APPROVED',$2) RETURNING id",[e.id,{leaveType:'PTO',startDate:'2026-08-08',endDate:'2026-08-08',minutes:60}])).rows[0]
 await h.pool.query("INSERT INTO payroll_paid_leave(facility_id,employee_id,request_id,leave_date,minutes,hourly_rate_cents,included_in_salary) VALUES(1,$1,$2,'2026-08-08',60,NULL,true)",[e.id,leaveRequest.id])
 const withLeave=(await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0].employmentWeekReviews[0]
 assert.equal(withLeave.paidLeave.length,1);assert.equal(withLeave.paidLeave[0].minutes,60)
 assert.equal(withLeave.allocationReview.status,'STALE');assert.equal(withLeave.settlementAuthorization.status,'STALE')
 const leavePreview=await api(path,body)
 assert.equal(leavePreview.paidLeave[0].includedInSalary,true)
 assert.equal(leavePreview.calculation.workedMinutes,fresh.calculation.workedMinutes)
 await h.pool.query("UPDATE payroll_employee_request SET status='CANCELLED' WHERE id=$1",[leaveRequest.id])
 const cancelledLeave=(await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0].employmentWeekReviews[0]
 assert.equal(cancelledLeave.paidLeave.length,0);assert.equal(cancelledLeave.allocationReview.status,'CURRENT')
 const committed=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'APPROVED') RETURNING id",[p.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id) VALUES($1,$2)',[committed.id,e.id])
 const committedReview=(await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0].employmentWeekReviews[0]
 assert.equal(committedReview.settlementAuthorization.status,'STALE');assert.equal(committedReview.settlementAuthorization.historyCompletenessVerified,false)
 await api(authorizationPath,{...authorization,requestId:'settlement-authorization-committed'},409)

})

test('allocation approval waits for the complete workweek to close',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'FUTURE-ALLOCATION',legalFirstName:'Future',legalLastName:'Week',hireDate:'2099-09-07',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2099-09-09' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2099-09-11',termination_date=NULL,pay_type='SALARY',annual_salary_cents=6240000 WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/salary-review`,{classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,confirmed:true,source:'Synthetic reviewed future salary agreement'})
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2099-09-11T12:00Z','2099-09-11T13:00Z','ADMIN','APPROVED')",[e.id])
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2099-09-07','2099-09-13','2099-09-18','WEEKLY') RETURNING id")).rows[0]
 const body={payPeriodId:period.id,week:'2099-09-07',salaryAllocations:[{employmentStart:'2099-09-11',earningsCents:3000,source:'Synthetic allocation for future workweek review'}]}
 const preview=await api(`/employees/${e.id}/workweek-allocation-preview`,body)
 await api(`/employees/${e.id}/workweek-allocations`,{...body,fingerprint:preview.fingerprint,requestId:'future-allocation-review',reason:'Synthetic full allocation review confirmation',confirmed:true},409)
 await api(`/employees/${e.id}/workweek-settlement-authorizations`,{payPeriodId:period.id,week:body.week,fingerprint:'0'.repeat(64),requestId:'future-settlement-authorization',reason:'Synthetic full payment history and allocation review',historyComplete:true,confirmed:true},409)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_audit_log WHERE action='WORKWEEK_ALLOCATION_REVIEWED'")).rows[0].n,0)
})
