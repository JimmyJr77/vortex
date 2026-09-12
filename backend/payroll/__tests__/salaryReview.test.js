import test from 'node:test'
import assert from 'node:assert/strict'
import {validateResponse,wageNoticeTerms} from '../onboarding.js'
import {validateSalaryReview} from '../salaryReview.js'
import {createHarness} from '../testing/harness.js'
const employee={pay_type:'SALARY',annual_salary_cents:7800000,work_state:'MD',job_title:'Office manager'}
const review={fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,classification:'EXEMPT',category:'ADMINISTRATIVE',salaryBasisVerified:true,dutiesVerified:true,stateRulesVerified:true,dutiesEvidence:'Verified independent discretion and judgment on significant office management matters.',confirmed:true,source:'Reviewed job description and salary basis agreement'}
test('standard salary exemptions require salary level, duties, salary basis and state verification',()=>{
 assert.equal(validateSalaryReview(employee,review).classification,'EXEMPT')
 assert.throws(()=>validateSalaryReview({...employee,annual_salary_cents:3556799},review),/684/)
 assert.throws(()=>validateSalaryReview(employee,{...review,dutiesVerified:false}),/actual job duties/)
 assert.throws(()=>validateSalaryReview({...employee,work_state:'CA'},review),/state-specific/)
 assert.equal(validateSalaryReview({...employee,annual_salary_cents:3000000},{...review,classification:'NONEXEMPT',category:'NONE'}).standardWeeklyHours,40)
})
test('salary review unblocks classification readiness, is audited and cannot overwrite used payroll',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,facility=1)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const e=await api('/employees',{employeeNumber:'SALARY-REVIEW',legalFirstName:'Reviewed',legalLastName:'Salary',hireDate:'2026-01-01',payType:'SALARY',annualSalaryCents:7800000,personalEmail:'reviewed@example.test'},201)
 await api(`/employees/${e.id}/salary-review`,review,404,2)
 const packet=await api(`/employees/${e.id}/onboarding`)
 const task=packet.tasks.find(t=>t.task_key==='PAY_REVIEW')
 await api(`/employees/${e.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Synthetic benefits review'},409)
 await api(`/employees/${e.id}/salary-review`,{...review,jobTitle:'Office manager'})
 const saved=await api(`/employees/${e.id}/salary-review`);assert.equal(saved.classification,'EXEMPT');assert.equal(saved.review.jobTitle,'Office manager');assert.ok(saved.review.verifiedAt)
 assert.equal((await api(`/employees/${e.id}/onboarding`)).readiness.blockers.includes('Salary overtime classification review'),false)
 await h.pool.query(`CREATE FUNCTION reject_salary_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='SALARY_CLASSIFICATION_REVIEWED' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`)
 await h.pool.query('CREATE TRIGGER reject_salary_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_salary_audit()')
 await api(`/employees/${e.id}/salary-review`,{...review,classification:'NONEXEMPT',jobTitle:'Changed role'},500)
 const unchanged=await api(`/employees/${e.id}/salary-review`);assert.equal(unchanged.classification,'EXEMPT');assert.equal(unchanged.jobTitle,'Office manager')
 await h.pool.query('DROP TRIGGER reject_salary_audit ON payroll_audit_log')
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-01','2026-08-15','2026-08-20','SEMIMONTHLY') RETURNING id")).rows[0]
 const run=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'APPROVED') RETURNING id",[period.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id) VALUES($1,$2)',[run.id,e.id])
 await api(`/employees/${e.id}/salary-review`,{...review,classification:'NONEXEMPT'},409)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='SALARY_CLASSIFICATION_REVIEWED'")).rows[0].n,1)
})

test('onboarding salary corrections preserve old acknowledgments and require revised employee terms',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json.data}
 const e=await api('/employees',{employeeNumber:'SALARY-CORRECTION',legalFirstName:'Offer',legalLastName:'Correction',hireDate:'2026-01-01',payType:'SALARY',annualSalaryCents:7000000,jobTitle:'Office manager',personalEmail:'offer@example.test'},201)
 const notice=(await api(`/employees/${e.id}/onboarding`)).tasks.find(t=>t.task_key==='WAGE_NOTICE')
 const oldResponse={acknowledged:true,signature:'Offer Correction',terms:{annualSalaryCents:7000000}}
 await h.pool.query("UPDATE payroll_onboarding_task SET status='COMPLETE',response=$2,completed_at=now() WHERE id=$1",[notice.id,oldResponse])
 await api(`/employees/${e.id}/salary-review`,{...review,annualSalaryCents:7800000})
 const saved=await api(`/employees/${e.id}/salary-review`);assert.equal(saved.annualSalaryCents,7800000);assert.equal(saved.review.annualSalaryCents,7800000)
 const reopened=(await api(`/employees/${e.id}/onboarding`)).tasks.find(t=>t.id===notice.id)
 assert.equal(reopened.status,'OPEN');assert.deepEqual(reopened.response,{})
 const audit=(await h.pool.query("SELECT before_data FROM payroll_audit_log WHERE action='WAGE_NOTICE_REOPENED' AND entity_id=$1",[String(notice.id)])).rows[0]
 assert.deepEqual(audit.before_data.response,oldResponse)
 assert.equal((await h.pool.query("SELECT status FROM payroll_employee_document WHERE employee_id=$1 AND document_type='WAGE_NOTICE'",[e.id])).rows[0].status,'REVERIFY')
 const invite=await api(`/employees/${e.id}/invitations`,{email:'offer@example.test',sendEmail:false},201)
 const redeemed=await fetch(`${h.url}/api/payroll/employee/invitations/redeem`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:new URL(invite.inviteUrl).searchParams.get('invite')})})
 assert.equal(redeemed.status,200);const session=(await redeemed.json()).data.sessionToken
 const acknowledgment=await fetch(`${h.url}/api/payroll/employee/onboarding/${notice.id}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session}`},body:JSON.stringify({signature:'Offer Correction',acknowledged:true,displayedWageTerms:(await api(`/employees/${e.id}/onboarding`)).wageTerms})})
 assert.equal(acknowledgment.status,200)
 const terms=(await h.pool.query('SELECT response FROM payroll_onboarding_task WHERE id=$1',[notice.id])).rows[0].response.terms
 assert.equal(terms.annualSalaryCents,7800000);assert.equal(terms.overtimeClassification,'EXEMPT')
 await api(`/employees/${e.id}/salary-review`,{...review,annualSalaryCents:7800000})
 assert.equal((await h.pool.query('SELECT status FROM payroll_onboarding_task WHERE id=$1',[notice.id])).rows[0].status,'SUBMITTED')
 const normalWorkweekMinutes=[360,0,360,360,360,360,0]
 await api(`/employees/${e.id}/salary-review`,{...review,annualSalaryCents:7800000,normalWorkweekMinutes})
 const packet=await api(`/employees/${e.id}/onboarding`)
 assert.equal(packet.tasks.find(t=>t.id===notice.id).status,'OPEN');assert.deepEqual(packet.wageTerms.normalWorkweekMinutes,normalWorkweekMinutes)
 await api(`/employees/${e.id}/salary-review`,{...review,annualSalaryCents:7800000,normalWorkweekMinutes:[0,600,600,600,600,600,0]},400)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/salary-review`,{...review,annualSalaryCents:7900000},409)
})

test('employee portal wage acknowledgment rejects terms changed after display',()=>{
 const initial={...employee,overtime_classification:'EXEMPT',hire_date:'2026-01-01',primary_work_location:'Bowie'},displayedWageTerms=wageNoticeTerms(initial,{})
 assert.throws(()=>validateResponse('WAGE_NOTICE',{acknowledged:true,signature:'Employee',displayedWageTerms},{...initial,annual_salary_cents:8000000},{}),/Hiring terms changed/)
 assert.equal(validateResponse('WAGE_NOTICE',{acknowledged:true,signature:'Employee',displayedWageTerms},initial,{}).terms.annualSalaryCents,7800000)
})
