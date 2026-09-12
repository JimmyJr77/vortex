import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {healthReportingInput} from '../healthReporting.js'
const body={year:2026,disposition:'SMALL_EMPLOYER_RELIEF',priorYearW2Count:249,expectedRevision:0,reference:'Synthetic verified prior-year W-2 filing count',confirmed:true}
test('health reporting requires reviewed evidence and an explicit eligible prior-year filing count',()=>{
 assert.equal(healthReportingInput(body).priorYearW2Count,249)
 assert.equal(healthReportingInput({...body,priorYearW2Count:0}).priorYearW2Count,0)
 assert.equal(healthReportingInput({...body,disposition:'REPORT',priorYearW2Count:null}).priorYearW2Count,null)
 for(const change of [{priorYearW2Count:250},{priorYearW2Count:null},{priorYearW2Count:undefined},{priorYearW2Count:'10'},{priorYearW2Count:-1},{priorYearW2Count:1.5},{year:2025},{confirmed:false},{reference:'short'},{disposition:'EXEMPT'},{expectedRevision:-1}])assert.throws(()=>healthReportingInput({...body,...change}))
})
test('employer health reporting preserves corrections and concurrent revisions within the facility',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const call=async(body,facility=1,auth=true)=>{const response=await fetch(`${h.url}/api/admin/payroll/health-coverage-reporting${body?'':'?year=2026'}`,{method:body?'POST':'GET',headers:{...(auth?{Authorization:'Bearer payroll-test-admin'}:{}),'Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});return {status:response.status,cache:response.headers.get('cache-control'),json:await response.json()}}
 assert.equal((await call()).json.data.revision,0);assert.equal((await call(undefined,1,false)).status,401)
 assert.equal((await call({...body,priorYearW2Count:250})).status,400)
 const saved=await call(body);assert.equal(saved.status,201);assert.equal(saved.cache,'no-store');const revision=saved.json.data.revision
 assert.equal((await call(body)).json.data.reused,true);assert.equal((await call(undefined,2)).json.data.revision,0)
 assert.equal((await call({...body,disposition:'REPORT'})).status,409)
 const concurrent=await Promise.all(['first','second'].map(name=>call({...body,disposition:'REPORT',expectedRevision:revision,reference:`Synthetic ${name} reporting determination`})))
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);let history=(await call()).json.data;assert.deepEqual(history.history.map(r=>r.status),['CURRENT','SUPERSEDED'])
 await assert.rejects(h.pool.query('UPDATE payroll_health_reporting_determination SET disposition=$1 WHERE id=$2',['UNRESOLVED',revision]),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_health_reporting_determination WHERE id=$1',[revision]),/append-only/)
 await assert.rejects(h.pool.query("INSERT INTO payroll_health_reporting_determination(facility_id,payment_year,disposition,prior_year_w2_count,reference,created_by) VALUES(1,2026,'SMALL_EMPLOYER_RELIEF',250,'Synthetic invalid relief',99)"),/check constraint/)
 const unresolved=await call({...body,expectedRevision:history.revision,disposition:'UNRESOLVED',priorYearW2Count:null});assert.equal(unresolved.status,201)
 const preparation=await fetch(`${h.url}/api/admin/payroll/reports/year-end-preparation?year=2026`,{headers:{Authorization:'Bearer payroll-test-admin'}});const data=(await preparation.json()).data;assert.equal(data.healthCoverageReporting.history[0].disposition,'UNRESOLVED');assert.equal(data.issuanceAvailable,false)
 assert.equal((await call(undefined,2)).json.data.history.length,0)
 assert.equal(Number((await h.pool.query("SELECT count(*) AS count FROM payroll_audit_log WHERE action='HEALTH_REPORTING_DETERMINATION_RECORDED'")).rows[0].count),3)
})
