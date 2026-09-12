import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementBankProvider} from '../testing/retirementBankProvider.js'
import {retirementRemittanceAuthorizationFixture} from '../testing/retirementRemittanceAuthorizationFixture.js'
import {recoverRetirementRemittances} from '../retirementRemittanceRecovery.js'
const bank={action:'SUBMIT',confirmed:true,bankInstructionsReviewed:true,outsideActivityReviewed:true,reference:'Trustee accepts this separate employer CCD credit without addenda or recordkeeper auto debit'}
test('retirement dispatch commits once, recovers lost responses without resend and reconciles exact bank withdrawals',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY,key=randomBytes(32).toString('hex');process.env.PAYROLL_DOCUMENT_KEY=key;let clock=new Date('2026-09-19T12:00:00Z')
 const provider=retirementBankProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>clock,retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const {api,path,body}=await retirementRemittanceAuthorizationFixture(h),a=await api(path,body),dispatch=`/retirement-remittance-authorizations/${a.id}/dispatch`
 provider.beforePost(async()=>{const claims=(await h.pool.query('SELECT encrypted_instruction FROM payroll_retirement_remittance_claim WHERE authorization_id=$1',[a.id])).rows;assert.equal(claims.length,1);assert.ok(claims[0].encrypted_instruction)})
 clock=new Date('2026-09-21T12:00:00Z') // UPCOMING becomes DUE TODAY without changing the authorized evidence.
 provider.loseResponse(true)
 const [x,y]=await Promise.all([api(dispatch,bank),api(dispatch,bank)]);assert.equal(provider.posts(),1);assert.ok([x.result.status,y.result.status].includes('SENT'))
 assert.equal(provider.instruction().subtype,'CCD');assert.equal(provider.instruction().send_remittance_advice,false);assert.equal(provider.instruction().amount,1400);assert.equal(provider.instruction().metadata.retirement_plan_id,'standard');assert.ok(!JSON.stringify(provider.instruction()).includes('PRIVATE-PARTICIPANT'))
 await api(`/retirement-remittance-authorizations/${a.id}/cancel`,{confirmed:true,reference:'Attempt cancellation after dispatch already started',requestKey:randomUUID()},'POST',409)
 delete process.env.PAYROLL_DOCUMENT_KEY;assert.equal((await api(dispatch,{action:'RECOVER',confirmed:true})).result.status,'RECOVERY_UNAVAILABLE');process.env.PAYROLL_DOCUMENT_KEY=key
 provider.missing(true);assert.equal((await api(dispatch,{action:'RECOVER',confirmed:true})).result.status,'NOT_FOUND');assert.equal(provider.posts(),1);provider.missing(false)
 provider.mismatch(true);assert.equal((await api(dispatch,{action:'RECOVER',confirmed:true})).result.status,'UNCERTAIN');provider.mismatch(false)
 provider.complete();clock=new Date('2026-09-22T16:00:00Z')
 const recovered=await recoverRetirementRemittances(h.pool,1,{fetcher:provider.fetcher,now:clock});assert.equal(recovered.bankPosted,1);assert.equal(provider.posts(),1)
 const history=await api(path);assert.equal(history.history[0].bank_result.settlementStatus,'BANK_POSTED');assert.equal(history.history[0].bank_result.settlementEvidence[0].amountCents,1400)
 assert.equal((await recoverRetirementRemittances(h.pool,1,{fetcher:provider.fetcher,now:new Date(+clock+600000)})).checked,0)
 provider.returned();assert.equal((await api(dispatch,{action:'RECOVER',confirmed:true})).result.status,'RETURNED');assert.equal((await api(path)).history[0].bank_result.settlementStatus,'EXCEPTION')
 provider.returnedCredit()
 const returned=await api(dispatch,{action:'RECOVER',confirmed:true})
 assert.equal(returned.result.returnEvidenceStatus,'BANK_CREDIT_POSTED');assert.equal(returned.result.returnEvidence.amountCents,1400)
 assert.equal(returned.result.returnEvidence.postedDate,'2026-09-24');assert.equal(provider.posts(),1)
 const retainedReturn=(await api(path)).history[0].bank_result
 assert.equal(retainedReturn.returnEvidenceStatus,'BANK_CREDIT_POSTED');assert.equal(JSON.stringify(retainedReturn).includes('PRIVATE RETURN'),false)
 assert.equal((await api(`/retirement-remittance-authorizations/${a.id}/assessment`)).status,'REVIEW_REQUIRED')
 provider.creditValid(false)
 assert.equal((await api(dispatch,{action:'RECOVER',confirmed:true})).result.returnEvidenceStatus,'NEEDS_REVIEW')
 assert.equal((await api(path)).history[0].bank_result.returnEvidence,null)
 provider.creditValid(true)
 await recoverRetirementRemittances(h.pool,1,{fetcher:provider.fetcher,now:new Date(+clock+86400000)})
 assert.equal((await api(path)).history[0].bank_result.returnEvidenceStatus,'BANK_CREDIT_POSTED');assert.equal(provider.posts(),1)
 const alerts=(await h.pool.query('SELECT title,message FROM payroll_alert WHERE dedupe_key=$1',[`retirement-bank-${a.id}`])).rows;assert.match(alerts[0].message,/participant allocation remain unverified/)
 const foreign=await fetch(`${h.url}/api/admin/payroll${dispatch}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:JSON.stringify({action:'RECOVER',confirmed:true})});assert.equal(foreign.status,404)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_remittance_observation WHERE authorization_id=$1',[a.id]),/immutable|append|cannot|not allowed/i)
})
test('first dispatch rejects changed evidence and expired cutoffs before a claim or provider submission',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let clock=new Date('2026-09-19T12:00:00Z')
 const provider=retirementBankProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>clock,retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const {api,path,body}=await retirementRemittanceAuthorizationFixture(h),a=await api(path,body),dispatch=`/retirement-remittance-authorizations/${a.id}/dispatch`
 await api(dispatch,{...bank,bankInstructionsReviewed:false},'POST',400)
 await api(dispatch,{...bank,outsideActivityReviewed:false},'POST',400)
 await api(dispatch,{action:'RECOVER',confirmed:true},'POST',409)
 provider.change(true);await api(dispatch,bank,'POST',409);provider.change(false)
 const holder=await h.pool.connect();try{await holder.query('BEGIN');await holder.query('SELECT facility_id FROM payroll_settings WHERE facility_id=1 FOR UPDATE');await api(dispatch,bank,'POST',409);assert.equal((await holder.query("SELECT pg_try_advisory_lock(hashtextextended('payroll-payment-connection:1',0)) AS locked")).rows[0].locked,true);await holder.query("SELECT pg_advisory_unlock(hashtextextended('payroll-payment-connection:1',0))");await holder.query('ROLLBACK')}finally{holder.release()}
 clock=new Date('2026-09-21T18:00:00Z');await api(dispatch,bank,'POST',409)
 assert.equal((await h.pool.query('SELECT count(*)::int AS count FROM payroll_retirement_remittance_claim')).rows[0].count,0);assert.equal(provider.posts(),0)
})

test('a cutoff reached during the final provider check leaves a claimed no-send outcome and never retries transport',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let clock=new Date('2026-09-19T12:00:00Z'),checking=false,fundingReads=0
 const provider=retirementBankProvider(),fetcher=async(url,options)=>{const r=await provider.fetcher(url,options);if(checking&&url.includes('/internal_accounts/')&&++fundingReads===2)clock=new Date('2026-09-21T18:00:00Z');return r}
 const h=await createHarness({paymentFetcher:fetcher,remittanceNow:()=>clock,retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const {api,path,body}=await retirementRemittanceAuthorizationFixture(h),a=await api(path,body),dispatch=`/retirement-remittance-authorizations/${a.id}/dispatch`
 checking=true;assert.equal((await api(dispatch,bank)).result.status,'BLOCKED_CUTOFF');assert.equal(provider.posts(),0)
 assert.equal((await api(dispatch,{action:'RECOVER',confirmed:true})).result.status,'NOT_FOUND');assert.equal(provider.posts(),0)
 assert.equal((await api(path)).history[0].claimed,true)
})
