import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {hashPayrollToken} from '../employeeAuth.js'
import {employeeCoverageSummary} from '../employeeBenefitCoverage.js'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
test('employee coverage uses a strict public projection and removes stale carrier determinations',()=>{
 const row={employeeId:'7',planId:'medical',planName:'Medical',onboardingCycle:1,status:'REVIEWED',current:{created_at:'2026-09-01T00:00:00Z',review:{disposition:'COVERED',carrier:'Carrier',coverageStart:'2026-09-01',coverageEnd:'2026-09-30',reference:'PRIVATE ADMIN NOTE'}},history:[{private:'PRIVATE HISTORY'}],sourceFingerprint:'PRIVATE SOURCE'}
 const result=employeeCoverageSummary({month:'2026-09',rows:[row,{...row,employeeId:'8',planName:'OTHER EMPLOYEE PLAN'}]},7)
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].status,'COVERED');assert.equal(JSON.stringify(result).includes('PRIVATE'),false);assert.equal(JSON.stringify(result).includes('OTHER'),false)
 for(const status of ['STALE','RETRACTED','SOURCE_CHANGED','NEEDS_REVIEW']){const summary=employeeCoverageSummary({month:'2026-09',rows:[{...row,status}]},7).rows[0];assert.equal(summary.status,'NEEDS_REVIEW');assert.equal(summary.carrier,null);assert.equal(summary.coverageStart,null);assert.equal(summary.coverageEnd,null)}
})
test('authenticated employee reads only own coverage and current review status',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee}=await monthlyBenefitsFixture(h)
 const read=()=>api('/benefit-coverage?month=2026-09&employeeId=999&facilityId=2',undefined,'GET',200,true)
 assert.equal((await read()).rows[0].status,'NEEDS_REVIEW')
 const row=(await api('/benefit-coverage?month=2026-09')).rows[0]
 const review={month:row.month,employeeId:row.employeeId,onboardingCycle:row.onboardingCycle,planId:row.planId,sourceFingerprint:row.sourceFingerprint,expectedRevision:0,disposition:'COVERED',carrier:'Synthetic Carrier',coverageStart:'2026-09-01',coverageEnd:'2026-09-30',reference:'PRIVATE ADMIN COVERAGE INVESTIGATION',confirmed:true,requestKey:randomUUID()}
 await api('/benefit-coverage',review);let data=await read();assert.equal(data.rows[0].status,'COVERED');assert.equal(data.rows[0].coverageEnd,'2026-09-30');assert.equal(JSON.stringify(data).includes('PRIVATE'),false)
 await api('/benefit-coverage',{...review,expectedRevision:1,disposition:'NOT_COVERED',requestKey:randomUUID()});assert.equal((await read()).rows[0].status,'NOT_COVERED')
 await api('/benefit-coverage',{...review,expectedRevision:2,disposition:'RETRACTED',requestKey:randomUUID()});assert.equal((await read()).rows[0].status,'NEEDS_REVIEW')
 const other=await api('/employees',{employeeNumber:'OTHER-COVERAGE',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},'POST',201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[other.id,hashPayrollToken('other-coverage-session')])
 const otherResponse=await fetch(`${h.url}/api/payroll/employee/benefit-coverage?month=2026-09&employeeId=${employee.id}`,{headers:{Authorization:'Bearer other-coverage-session'}});assert.equal(otherResponse.status,200);assert.deepEqual((await otherResponse.json()).data.rows,[])
 await api('/benefit-coverage?month=2026-99',undefined,'GET',400,true)
 const unauth=await fetch(`${h.url}/api/payroll/employee/benefit-coverage?month=2026-09`);assert.equal(unauth.status,401)
 await h.pool.query('UPDATE payroll_employee_session SET revoked_at=now() WHERE employee_id=$1',[employee.id]);await api('/benefit-coverage?month=2026-09',undefined,'GET',401,true)
})
