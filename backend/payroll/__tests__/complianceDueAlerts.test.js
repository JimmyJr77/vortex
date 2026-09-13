import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {ensureEmployerSetup} from '../employerSetup.js'
import {runPayrollComplianceSweep} from '../complianceScheduler.js'
import {reconcileComplianceDueAlerts} from '../complianceDueAlerts.js'

test('scheduled compliance alerts stop requesting action after the task is completed',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 await ensureEmployerSetup(h.pool,1)
 const task=(await h.pool.query(`INSERT INTO payroll_compliance_task(facility_id,task_key,title,category,jurisdiction,due_date,status,severity,description)
 VALUES(1,'SYNTHETIC_ALERT_LIFECYCLE','Synthetic compliance review','ONBOARDING','US',CURRENT_DATE,'OPEN','WARNING','Synthetic reviewed requirement') RETURNING id`)).rows[0]
 const sweep=()=>runPayrollComplianceSweep(h.pool,{workforceRunner:async()=>({}),sourceReviewer:async()=>{}})
 const read=async()=>(await h.pool.query("SELECT id,status,dismissed_at FROM payroll_alert WHERE facility_id=1 AND dedupe_key LIKE $1",[`due-task-${task.id}-%`])).rows
 await sweep()
 const first=await read();assert.equal(first.length,1);assert.equal(first[0].status,'OPEN')
 const dashboard=async()=>{
  const response=await fetch(`${h.url}/api/admin/payroll/dashboard`,{headers:{Authorization:'Bearer payroll-test-admin'}})
  assert.equal(response.status,200)
  return (await response.json()).data
 }
 assert.ok((await dashboard()).alerts.some(alert=>String(alert.id)===String(first[0].id)))
 await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE',completion_note='Synthetic evidence reviewed',completed_at=now(),completed_by=99 WHERE id=$1",[task.id])
 await sweep()
 const completed=await read()
 assert.equal(completed[0].id,first[0].id)
 assert.equal(completed[0].status,'DISMISSED','Completed compliance work must stop appearing as an open automated alert')
 assert.ok(completed[0].dismissed_at)
 assert.ok(!(await dashboard()).alerts.some(alert=>String(alert.id)===String(first[0].id)))
})

test('alert reconciliation follows rescheduling, reopening and applicability while preserving other alerts',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const task=(await h.pool.query(`INSERT INTO payroll_compliance_task(facility_id,task_key,title,category,jurisdiction,due_date,status,severity,description)
 VALUES(1,'SYNTHETIC_ALERT_CHANGES','Original title','ONBOARDING','US',CURRENT_DATE,'OPEN','WARNING','Original details') RETURNING id`)).rows[0]
 await h.pool.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES
 (1,'unrelated-alert','WARNING','Other work','Keep this alert'),
 (2,'due-task-synthetic-other-facility','WARNING','Other facility work','Keep this alert')`)
 const reconcile=()=>reconcileComplianceDueAlerts(h.pool,1)
 const alerts=async()=>(await h.pool.query("SELECT * FROM payroll_alert WHERE facility_id=1 AND dedupe_key LIKE $1 ORDER BY id",[`due-task-${task.id}-%`])).rows
 await reconcile();const original=(await alerts())[0]
 await h.pool.query("UPDATE payroll_compliance_task SET due_date=CURRENT_DATE+30 WHERE id=$1",[task.id])
 await reconcile();assert.equal((await alerts())[0].status,'DISMISSED')
 await h.pool.query("UPDATE payroll_compliance_task SET due_date=CURRENT_DATE,title='Updated title',description='Updated details',severity='CRITICAL' WHERE id=$1",[task.id])
 await reconcile();const reopened=(await alerts())[0]
 assert.equal(reopened.id,original.id);assert.equal(reopened.status,'OPEN');assert.equal(reopened.dismissed_at,null);assert.equal(reopened.dismissed_by,null)
 assert.equal(reopened.severity,'CRITICAL');assert.match(reopened.title,/Updated title/);assert.match(reopened.message,/Updated details/)
 await h.pool.query("UPDATE payroll_compliance_task SET status='NOT_APPLICABLE' WHERE id=$1",[task.id])
 await reconcile();assert.equal((await alerts())[0].status,'DISMISSED')
 await h.pool.query("UPDATE payroll_compliance_task SET status='OPEN',due_date=CURRENT_DATE+7 WHERE id=$1",[task.id])
 await reconcile();let rows=await alerts();assert.deepEqual(rows.map(r=>r.status),['DISMISSED','OPEN'])
 await h.pool.query("UPDATE payroll_compliance_task SET due_date=NULL WHERE id=$1",[task.id])
 await reconcile();rows=await alerts();assert.deepEqual(rows.map(r=>r.status),['DISMISSED','DISMISSED','OPEN']);assert.ok(rows[2].dedupe_key.endsWith('-none'))
 await reconcile();assert.equal((await alerts()).length,3)
 const unrelated=(await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key IN ('unrelated-alert','due-task-synthetic-other-facility') ORDER BY id")).rows
 assert.deepEqual(unrelated.map(r=>r.status),['OPEN','OPEN'])
})
