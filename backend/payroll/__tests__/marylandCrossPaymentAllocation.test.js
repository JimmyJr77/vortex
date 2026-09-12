import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {regularRetirementFixture} from '../testing/regularRetirementFixture.js'
import {loadMarylandAdditionalPeriod} from '../loadMarylandAdditionalPeriod.js'

for(const ptoFirst of [false,true])test(`regular and repeated PTO payments share one additional-withholding agreement: PTO first=${ptoFirst}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness({databaseNow:'2026-09-11T12:00:00.000Z',retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const unusedPto={inServiceDeferrals:'INCLUDED',postSeveranceDeferrals:'INCLUDED',postSeverance415:'INCLUDED',limitationYear:'CALENDAR_YEAR',terms:'Actual plan unused-leave cashout compensation review'}
 const {api,employee,periods}=await regularRetirementFixture(h,{unusedPto,hourlyRateCents:10000})
 await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed additional withholding election',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1,extraWithholdingCents:500}},'PATCH')
 const path=`/employees/${employee.id}/maryland-additional-agreements`,current=await api(path)
 await api(path,{status:'ACTIVE',expectedRevision:0,requestKey:randomUUID(),confirmed:true,sourceReference:'Synthetic signed payment date additional withholding agreement',effectiveOn:'2026-09-16',amountCents:500,periodBasis:'PAYMENT_DATE',electionFingerprint:current.currentElectionFingerprint},'POST',201)
 const finish=async(body)=>{const run=await api('/runs',body,'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:body.paymentDate,paymentConfirmationReference:'SYNTHETIC-CROSS-PAYMENT-ALLOCATION'});return (await h.pool.query('SELECT statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1 AND employee_id=$2',[run.id,employee.id])).rows[0].statement_snapshot}
 const regular=await finish({payPeriodId:periods[0].id,paymentDate:ptoFirst?'2026-09-15':'2026-09-18'})
 assert.equal(regular.incomeTaxWageBasis.stateTaxComponents.appliedAdditionalCents,500)
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-09-01',480,'Synthetic accrued vacation')",[employee.id])
 const employment=(await h.pool.query('SELECT id,started_on::text,ended_on::text FROM payroll_employment_period WHERE employee_id=$1',[employee.id])).rows[0]
 const evidence={employmentPeriodId:Number(employment.id),employmentStartedOn:employment.started_on,employmentEndedOn:employment.ended_on,usableIfContinued:true,sourceReference:'Retained actual earned leave and continued use records',confirmed:true}
 for(const paymentDate of ['2026-09-22','2026-09-23']){
  const policy={leaveType:'PTO',minutes:240,hourlyRateCents:2500,policyVerified:true,unusedVacationVerified:true,policyReference:'Retained reviewed unused vacation payment policy'}
  const preview=await api(`/employees/${employee.id}/leave-payout/preview`,policy)
  const payout=await api(`/employees/${employee.id}/leave-payouts`,{...policy,payPeriodId:periods[1].id,fingerprint:preview.fingerprint,requestKey:randomUUID(),paymentMode:'STANDALONE'},'POST',201)
  const body={payPeriodId:periods[1].id,paymentDate,offCyclePto:{stateMethod:'MD_LUMP_SUM',payoutId:Number(payout.id),historyCompleteVerified:true,historySource:'Complete employer and related employer payroll reconciliation',federalMethod:'FLAT_22',retirementPtoEvidence:evidence}}
  const calculation=(await api('/runs/preview',body)).preview
  assert.equal(calculation.canApprove,true,JSON.stringify(calculation.warnings))
  assert.equal(calculation.employees[0].stateIncomeTaxCents,922+(ptoFirst&&paymentDate==='2026-09-22'?500:0))
  const statement=await finish(body),components=statement.incomeTaxWageBasis.stateTaxComponents
  assert.equal(components.requestedAdditionalCents,500);assert.equal(components.appliedAdditionalCents,ptoFirst&&paymentDate==='2026-09-22'?500:0)
 }
 const bonusBody={payPeriodId:periods[1].id,paymentDate:'2026-09-24',offCycleBonus:{employeeId:employee.id,amountCents:10000,classification:'DISCRETIONARY',paymentType:'ANNUAL_LUMP_SUM',confirmed:true,source:'Synthetic discretionary bonus decision with no prior promise',amountDiscretionVerified:true,paymentDiscretionVerified:true,noPriorPromiseVerified:true,historyCompleteVerified:true,stateBonusRateVerified:true,historySource:'Synthetic complete employer and related employer records',requestKey:randomUUID()}}
 const bonus=await finish(bonusBody)
 assert.equal(bonus.incomeTaxWageBasis.stateTaxComponents.appliedAdditionalCents,0)
 assert.equal(bonus.incomeTaxWageBasis.stateTaxComponents.totalCents,970)
 const lastRegular=await finish({payPeriodId:periods[1].id,paymentDate:'2026-09-30'})
 assert.equal(lastRegular.incomeTaxWageBasis.stateTaxComponents.appliedAdditionalCents,0)
 const allocation=await loadMarylandAdditionalPeriod(h.pool,{facility:1,employeeId:employee.id,paymentDate:'2026-09-30'})
 assert.equal(allocation.applications.length,ptoFirst?4:5);assert.equal(allocation.committedAdditionalCents,500);assert.equal(allocation.remainingAdditionalCents,0)
})

for(const kind of ['BONUS','PTO'])test(`competing ${kind} approvals reserve additional withholding once and stale drafts require rebuilding`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness({databaseNow:'2026-09-11T12:00:00.000Z',retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const {api,employee,periods}=await regularRetirementFixture(h,{hourlyRateCents:10000,unusedPto:{inServiceDeferrals:'INCLUDED',postSeveranceDeferrals:'INCLUDED',postSeverance415:'INCLUDED',limitationYear:'CALENDAR_YEAR',terms:'Actual plan unused leave cashout compensation review'}})
 await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed additional withholding election',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1,extraWithholdingCents:500}},'PATCH')
 const regular=await api('/runs',{payPeriodId:periods[0].id,paymentDate:'2026-09-15'},'POST',201)
 await api(`/runs/${regular.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${regular.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${regular.id}/finalize`,{paymentDate:'2026-09-15',paymentConfirmationReference:'SYNTHETIC-PRIOR-PERIOD'})
 const path=`/employees/${employee.id}/maryland-additional-agreements`,current=await api(path)
 await api(path,{status:'ACTIVE',expectedRevision:0,requestKey:randomUUID(),confirmed:true,sourceReference:'Synthetic signed payment date additional withholding agreement',effectiveOn:'2026-09-16',amountCents:500,periodBasis:'PAYMENT_DATE',electionFingerprint:current.currentElectionFingerprint},'POST',201)
 const bonusBody=()=>({payPeriodId:periods[1].id,paymentDate:'2026-09-22',offCycleBonus:{employeeId:employee.id,amountCents:10000,classification:'DISCRETIONARY',paymentType:'ANNUAL_LUMP_SUM',confirmed:true,source:'Synthetic discretionary bonus decision with no prior promise',amountDiscretionVerified:true,paymentDiscretionVerified:true,noPriorPromiseVerified:true,historyCompleteVerified:true,stateBonusRateVerified:true,historySource:'Synthetic complete employer and related employer records',requestKey:randomUUID()}})
 const payouts=[]
 let evidence
 if(kind==='PTO'){
  await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-09-01',480,'Synthetic accrued vacation')",[employee.id])
  const employment=(await h.pool.query('SELECT id,started_on::text,ended_on::text FROM payroll_employment_period WHERE employee_id=$1',[employee.id])).rows[0]
  evidence={employmentPeriodId:Number(employment.id),employmentStartedOn:employment.started_on,employmentEndedOn:employment.ended_on,usableIfContinued:true,sourceReference:'Retained actual earned leave and continued use records',confirmed:true}
  for(let i=0;i<2;i++){
   const policy={leaveType:'PTO',minutes:240,hourlyRateCents:2500,policyVerified:true,unusedVacationVerified:true,policyReference:'Retained reviewed unused vacation payment policy'}
   const preview=await api(`/employees/${employee.id}/leave-payout/preview`,policy)
   payouts.push(await api(`/employees/${employee.id}/leave-payouts`,{...policy,payPeriodId:periods[1].id,fingerprint:preview.fingerprint,requestKey:randomUUID(),paymentMode:'STANDALONE'},'POST',201))
  }
 }
 const body=(index=0)=>kind==='BONUS'?bonusBody():{payPeriodId:periods[1].id,paymentDate:'2026-09-22',offCyclePto:{stateMethod:'MD_LUMP_SUM',payoutId:Number(payouts[index].id),historyCompleteVerified:true,historySource:'Complete employer and related employer payroll reconciliation',federalMethod:'FLAT_22',retirementPtoEvidence:evidence}}
 const runs=[]
 for(let i=0;i<2;i++){const run=await api('/runs',body(i),'POST',201);runs.push(run);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')}
 const responses=await Promise.all(runs.map(run=>fetch(`${h.url}/api/admin/payroll/runs/${run.id}/status`,{method:'PATCH',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({status:'APPROVED'})})))
 const payloads=await Promise.all(responses.map(response=>response.json()))
 assert.deepEqual(responses.map(response=>response.status).sort(),[200,409],JSON.stringify(payloads))
 let winner=runs[responses.findIndex(response=>response.status===200)],loser=runs[responses.findIndex(response=>response.status===409)]
 const reserved=await loadMarylandAdditionalPeriod(h.pool,{facility:1,employeeId:employee.id,paymentDate:'2026-09-22'})
 assert.equal(reserved.applications.length,1);assert.equal(reserved.committedAdditionalCents,500)
 if(kind==='PTO'){
  await api(`/runs/${winner.id}/status`,{status:'VOID'},'PATCH')
  const released=await loadMarylandAdditionalPeriod(h.pool,{facility:1,employeeId:employee.id,paymentDate:'2026-09-22'})
  assert.equal(released.remainingAdditionalCents,500);assert.equal(released.applications.length,0)
  const leave=(await h.pool.query("SELECT COUNT(*)::int n FROM payroll_leave_transaction WHERE employee_id=$1 AND leave_type='PTO' AND minutes<0",[employee.id])).rows[0]
  assert.equal(leave.n,0)
  const winnerIndex=runs.indexOf(winner)
  winner=await api('/runs',body(winnerIndex),'POST',201)
  await api(`/runs/${winner.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${winner.id}/status`,{status:'APPROVED'},'PATCH')
 }
 await api(`/runs/${winner.id}/finalize`,{paymentDate:'2026-09-22',paymentConfirmationReference:'SYNTHETIC-CONCURRENT-WINNER'})
 await api(`/runs/${loser.id}/status`,{status:'APPROVED'},'PATCH',409)
 await api(`/runs/${loser.id}/status`,{status:'VOID'},'PATCH')
 const rebuilt=await api('/runs',body(runs.indexOf(loser)),'POST',201)
 await api(`/runs/${rebuilt.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${rebuilt.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${rebuilt.id}/finalize`,{paymentDate:'2026-09-22',paymentConfirmationReference:'SYNTHETIC-REBUILT-ZERO-EXTRA'})
 const paid=await loadMarylandAdditionalPeriod(h.pool,{facility:1,employeeId:employee.id,paymentDate:'2026-09-22'})
 assert.equal(paid.applications.length,2);assert.equal(paid.committedAdditionalCents,500);assert.equal(paid.remainingAdditionalCents,0)
 if(kind==='PTO'){
  const leave=(await h.pool.query("SELECT COUNT(*)::int n,SUM(minutes)::int minutes FROM payroll_leave_transaction WHERE employee_id=$1 AND leave_type='PTO' AND minutes<0",[employee.id])).rows[0]
  assert.equal(leave.n,2);assert.equal(leave.minutes,-480)
  assert.ok((await h.pool.query('SELECT status FROM payroll_leave_payout WHERE employee_id=$1',[employee.id])).rows.every(row=>row.status==='PAID'))
 }
 assert.deepEqual(paid.applications.map(row=>row.appliedAdditionalCents).sort((a,b)=>a-b),[0,500])
})
