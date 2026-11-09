import test from 'node:test'
import fs from 'node:fs/promises'
import { installSharedAccountRecords } from '../../newAdmin/__tests__/sharedAccountFixture.js'
import assert from 'node:assert/strict'
import pg from 'pg'
import {
  listAccountingLines,listAccountingPayments,accountingLineDetail,
  accountingPaymentDetail,accountingOptions,exportAccountingCsv,
} from '../accountingReport.js'
function validateRehearsalDatabaseUrl(value) {
  const url=new URL(value)
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname))
  assert.match(url.pathname,/^\/vortex_(?:billing_test|new_admin_test|new_admin_dev|dashboard_test)$/)
  assert.equal(url.search,'')
}

const connectionString=process.env.NEW_ADMIN_TEST_DATABASE_URL || process.env.DASHBOARD_TEST_DATABASE_URL
if(connectionString) validateRehearsalDatabaseUrl(connectionString)

// Real PostgreSQL types, date arithmetic, joins, and aggregates; private temporary
// copies avoid altering shared browser fixtures or invoking financial side effects.
// Explicit IDs mean no public sequence is advanced. Everything is rolled back.
test('accounting report PostgreSQL ledger reconciliation and historical scope',{skip:!connectionString},async t=>{
  const db=new pg.Client({connectionString})
  await db.connect()
  try {
    await db.query('BEGIN')
    const schema=`accounting_shared_${process.pid}`
    await db.query(`CREATE SCHEMA ${schema}`)
    await db.query(`SET LOCAL search_path=${schema}`)
    await db.query((await fs.readFile(new URL('./fixtures/turnover-schema.sql',import.meta.url),'utf8')).replaceAll('public.',`${schema}.`))
    // Exercise ambiguous legacy sources, as the original unconstrained fixture did.
    await db.query('DROP INDEX uq_billing_charge_source')
    await db.query(await fs.readFile(new URL('../../migrations/835_refund_preserve_charge_balance.sql',import.meta.url),'utf8'))
    await db.query(await fs.readFile(new URL('../../migrations/836_monthly_invoice_revisions.sql',import.meta.url),'utf8'))
    await installSharedAccountRecords(db)
    const tables=['jackrabbit_history_record','facility','family','family_billing_account','member','program','scheduling_form','scheduling_signup','drop_in_registration',
      'billing_subscription','billing_charge','billing_payment','billing_payment_application','billing_refund',
      'billing_monthly_invoice','billing_monthly_invoice_line','billing_charge_credit_application']

    const insert=async(table,row)=>{
      assert.ok(tables.includes(table))
      const keys=Object.keys(row)
      await db.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_,index)=>`$${index+1}`).join(',')})`,Object.values(row))
    }
    await insert('facility',{id:1,name:'Accounting fixture',timezone:'America/New_York'})
    await insert('facility',{id:2,name:'Other facility',timezone:'America/Los_Angeles'})
    await insert('family',{id:11,facility_id:1,family_name:'Historical family',archived:true})
    await insert('family',{id:22,facility_id:2,family_name:'Other family'})
    await insert('family_billing_account',{id:1001,family_id:11,is_active:false})
    await insert('family_billing_account',{id:2001,family_id:22})
    await insert('member',{id:301,facility_id:1,first_name:'Archived',last_name:'Athlete',is_active:false})
    await insert('member',{id:302,facility_id:1,first_name:'Active',last_name:'Athlete'})
    await insert('member',{id:401,facility_id:2,first_name:'Other',last_name:'Athlete'})
    for(const [id,facilityId,name,archived] of [[501,1,'Archived class',true],[502,1,'Other local class',false],[601,2,'Secret class',false]]) {
      await insert('program',{id,facility_id:facilityId,category:'GYMNASTICS',name,display_name:name,archived})
    }
    for(const [id,programId,title] of [[701,501,'Archived form'],[702,502,'Local form'],[703,null,'Removed class'],[801,601,'Foreign form']]) {
      await insert('scheduling_form',{id,program_id:programId,title})
    }
    for(const [id,formId,memberId,extra] of [
      [901,701,301,{archived_at:'2026-01-01T12:00:00Z'}],
      [902,702,302,{}],
      [903,703,301,{orphaned_at:'2026-01-01T12:00:00Z',orphaned_snapshot:{formTitle:'Removed historical class'}}],
      [904,801,401,{orphaned_at:'2026-01-01T12:00:00Z',orphaned_snapshot:{formTitle:'Foreign secret snapshot'}}],
    ]) await insert('scheduling_signup',{id,form_id:formId,member_id:memberId,first_name:'Fixture',last_name:'Athlete',email:'fixture@example.test',...extra})
    await insert('billing_subscription',{id:950,family_billing_account_id:1001,description:'Ambiguous historical subscription',source_type:'scheduling_signup',source_id:'901',status:'cancelled'})
    const charge=async(id,amount,extra={})=>insert('billing_charge',{
      id,family_billing_account_id:1001,member_id:301,description:`Bill ${id}`,amount_cents:amount,
      gross_amount_cents:amount,source_type:'scheduling_signup',source_id:'901',created_at:'2026-01-15T15:00:00Z',...extra,
    })
    await charge(101,10000,{description:'=SUM(1,2) "quoted"\nsecond line'})
    await charge(102,5000,{member_id:302,source_id:'902'})
    await charge(103,1000,{source_id:'903'})
    await charge(104,10000,{description:'Payment refund preserves tuition'})
    await charge(105,10000,{description:'Credit-funded tuition'})
    await charge(106,-3000,{source_type:'manual_account_credit',source_id:'credit:106',charge_type:'credit'})
    await charge(107,10000,{description:'Retired zero-net correction group'})
    await charge(108,-2000,{source_type:'refund_offset',source_id:'correction:108',related_charge_id:107,metadata:{allocationRetired:true}})
    await charge(109,2000,{source_type:'charge_adjustment',source_id:'correction:109',related_charge_id:107,metadata:{allocationRetired:true}})
    await charge(110,10000,{description:'Refund with waived tuition'})
    await charge(111,-2000,{source_type:'refund_offset',source_id:'refund:502',related_charge_id:110})
    await charge(112,0,{description:'Fully discounted bill',gross_amount_cents:10000,discount_amount_cents:10000})
    for(const [id,amount] of [[113,10000],[114,5000]]) await charge(id,amount,{subscription_id:950,service_period_start:'2026-01-01',charge_type:'recurring'})
    await charge(115,-1000,{source_type:'price_adjustment',source_id:'adjustment:115',subscription_id:950,service_period_start:'2026-01-01'})
    await charge(116,500,{source_id:'904',description:'Broken foreign textual source must stay unassigned'})
    for(const [id,createdAt] of [[117,'2026-11-01T03:59:59Z'],[118,'2026-11-01T04:00:00Z'],[119,'2026-11-02T04:59:59Z'],[120,'2026-11-02T05:00:00Z']]) await charge(id,100,{created_at:createdAt})
    await charge(201,999999,{family_billing_account_id:2001,member_id:401,source_id:'904',description:'Foreign bill'})
    for(const [id,amount,status] of [[401,12000,'settled'],[402,6000,'succeeded'],[403,6000,'settled'],[404,4000,'pending'],[405,1000,'failed'],[406,2000,'settled']]) {
      await insert('billing_payment',{id,family_billing_account_id:1001,amount_cents:amount,external_status:status,method:'cash',paid_at:'2026-02-10T15:00:00Z'})
    }
    await insert('billing_payment',{id:407,family_billing_account_id:2001,amount_cents:999999,external_status:'settled'})
    for(const [id,paymentId,chargeId,amount,kind,reverses] of [
      [601,401,101,10000,'application',null],[602,401,102,2000,'application',null],
      [603,402,104,6000,'application',null],[604,402,104,2000,'reversal',603],
      [605,403,110,6000,'application',null],[606,403,110,2000,'reversal',605],
      [607,404,104,4000,'application',null],
    ]) await insert('billing_payment_application',{id,billing_payment_id:paymentId,billing_charge_id:chargeId,amount_cents:amount,application_kind:kind,reverses_application_id:reverses})
    for(const [id,paymentId,chargeId,treatment,offset] of [[501,402,104,'return_payment',null],[502,403,110,'reverse_charge',111]]) {
      await insert('billing_refund',{id,family_billing_account_id:1001,payment_id:paymentId,related_charge_id:chargeId,ledger_treatment:treatment,offset_credit_charge_id:offset,amount_cents:2000,external_status:'succeeded',created_at:'2026-02-11T15:00:00Z'})
    }
    await insert('billing_monthly_invoice',{id:701,family_billing_account_id:1001,billing_month:'2026-01-01',status:'paid',total_cents:7000})
    await insert('billing_monthly_invoice',{id:702,family_billing_account_id:1001,billing_month:'2026-01-01',status:'void',total_cents:999999})
    for(const [id,invoiceId,chargeId,type,amount] of [[801,701,105,'charge',10000],[802,701,106,'credit',-3000],[803,702,105,'charge',999999]]) {
      await insert('billing_monthly_invoice_line',{id,billing_monthly_invoice_id:invoiceId,billing_charge_id:chargeId,line_type:type,description:'Immutable invoice version',amount_cents:amount})
    }
    await insert('billing_charge_credit_application',{id:901,billing_monthly_invoice_id:701,credit_invoice_line_id:802,target_invoice_line_id:801,amount_cents:3000,idempotency_key:'fixture-credit'})

    await t.test('all-page summary reconciles signed charges without invoice or split-payment multiplication',async()=>{
      const result=await listAccountingLines(db,{facilityId:1,query:{pageSize:2}})
      assert.equal(result.rows.length,2);assert.equal(result.total,17)
      assert.equal(result.summary.billedCents,65900)
      assert.equal(result.summary.paidCents,20000)
      assert.equal(result.summary.creditAppliedCents,3000)
      assert.equal(result.summary.openCents,46900)
      assert.equal(result.summary.creditCents,4000)
      const ledger=await db.query('SELECT SUM(amount_cents)::int AS cents FROM billing_charge WHERE family_billing_account_id=1001')
      assert.equal(result.summary.billedCents,ledger.rows[0].cents)
      const second=await listAccountingLines(db,{facilityId:1,query:{page:2,pageSize:2}})
      assert.deepEqual(second.summary,result.summary)
      assert.equal(new Set([...result.rows,...second.rows].map(row=>row.id)).size,4)
    })
    await t.test('partial allocations, reversals, credits, and zero-net corrections explain each bill once',async()=>{
      const split=await accountingLineDetail(db,{facilityId:1,id:102})
      assert.equal(split.line.paidCents,2000);assert.equal(split.line.openCents,3000);assert.equal(split.line.status,'partial')
      const returned=await accountingLineDetail(db,{facilityId:1,id:104})
      assert.equal(returned.line.paidCents,4000);assert.equal(returned.line.openCents,6000)
      assert.deepEqual(returned.allocations.map(a=>a.signedAmountCents).sort((a,b)=>a-b),[-2000,4000,6000])
      assert.equal(returned.refunds[0].amountCents,2000)
      const waived=await accountingLineDetail(db,{facilityId:1,id:110})
      assert.equal(waived.line.amountCents,8000);assert.equal(waived.line.paidCents,4000);assert.equal(waived.line.openCents,4000)
      const credit=await accountingLineDetail(db,{facilityId:1,id:105})
      assert.equal(credit.line.creditAppliedCents,3000);assert.equal(credit.line.openCents,7000)
      assert.deepEqual(credit.creditApplications.map(a=>[a.sourceChargeId,a.targetChargeId,a.amountCents]),[[106,105,3000]])
      const corrected=await accountingLineDetail(db,{facilityId:1,id:107})
      assert.equal(corrected.line.amountCents,10000);assert.equal(corrected.line.adjustmentCents,0);assert.equal(corrected.adjustments.length,2)
      const free=await accountingLineDetail(db,{facilityId:1,id:112})
      assert.equal(free.line.status,'paid');assert.equal(free.line.paidCents,0);assert.equal(free.line.openCents,0)
      assert.equal((await accountingLineDetail(db,{facilityId:1,id:115})).line.amountCents,-1000)
    })
    await t.test('cash receipts count once and pending payments never settle a bill',async()=>{
      const result=await listAccountingPayments(db,{facilityId:1,query:{pageSize:2}})
      assert.equal(result.total,8);assert.equal(result.summary.receiptsCents,26000)
      assert.equal(result.summary.refundsCents,4000);assert.equal(result.summary.netCashCents,22000)
      assert.equal(result.summary.filteredAppliedCents,20000);assert.equal(result.summary.unappliedCents,2000)
      const payment=await accountingPaymentDetail(db,{facilityId:1,id:401})
      assert.equal(payment.payment.amountCents,12000);assert.equal(payment.allocations.length,2)
      assert.deepEqual(payment.allocations.map(a=>a.chargeId).sort(),[101,102])
      const partial=await listAccountingPayments(db,{facilityId:1,query:{classId:502}})
      assert.equal(partial.total,1);assert.equal(partial.rows[0].amountCents,12000)
      assert.equal(partial.rows[0].filteredAppliedCents,2000)
      const refunds=await listAccountingPayments(db,{facilityId:1,query:{kind:'refund'}})
      assert.equal(refunds.total,2);assert.equal(refunds.summary.netCashCents,-4000)
    })
    await t.test('refund finalization marker changes settled cash while pending and failed refunds do not',async()=>{
      await db.query('SAVEPOINT refund_statuses')
      try {
        for(const [id,amount,status,extra] of [
          [503,300,'succeeded',{}],
          [504,400,'pending',{}],
          [505,500,'reconciliation_required',{stripe_refund_id:'re_fixture_finalized',error_message:'[stripe-refund-ledger-finalization-pending:fixture]'}],
          [506,600,'reconciliation_required',{stripe_refund_id:'re_fixture_unknown',error_message:'Processor outcome is unknown'}],
          [507,700,'failed',{}],
        ]) await insert('billing_refund',{id,family_billing_account_id:1001,payment_id:406,amount_cents:amount,external_status:status,...extra})
        const result=await listAccountingPayments(db,{facilityId:1,query:{pageSize:100}})
        assert.equal(result.summary.refundsCents,4800);assert.equal(result.summary.netCashCents,21200)
        const finalized=result.rows.find(row=>row.kind==='refund'&&row.id===505)
        const uncertain=result.rows.find(row=>row.kind==='refund'&&row.id===506)
        assert.equal(finalized.settled,true);assert.equal(uncertain.settled,false)
        const unallocated=await accountingPaymentDetail(db,{facilityId:1,id:406})
        assert.equal(unallocated.payment.refundedCents,800);assert.equal(unallocated.payment.unappliedCents,1200)
      } finally {await db.query('ROLLBACK TO SAVEPOINT refund_statuses')}
    })
    await t.test('history survives archive/orphan state while foreign source metadata stays isolated',async()=>{
      const archived=await accountingLineDetail(db,{facilityId:1,id:101})
      assert.equal(archived.line.classId,501);assert.equal(archived.line.memberName,'Archived Athlete')
      assert.equal(archived.line.className,'Archived class')
      const orphan=await accountingLineDetail(db,{facilityId:1,id:103})
      assert.equal(orphan.line.classId,null);assert.equal(orphan.line.className,'Removed historical class')
      const broken=await accountingLineDetail(db,{facilityId:1,id:116})
      assert.equal(broken.line.classId,null);assert.equal(broken.line.className,null)
      await assert.rejects(accountingLineDetail(db,{facilityId:2,id:101}),error=>error.statusCode===404)
      await assert.rejects(accountingPaymentDetail(db,{facilityId:2,id:401}),error=>error.statusCode===404)
      assert.equal((await listAccountingLines(db,{facilityId:2})).summary.billedCents,999999)
      const options=await accountingOptions(db,{facilityId:1})
      assert.ok(options.members.some(row=>Number(row.id)===301));assert.ok(options.classes.some(row=>Number(row.id)===501))
      assert.ok(options.members.every(row=>Number(row.id)!==401));assert.ok(options.classes.every(row=>Number(row.id)!==601))
    })
    await t.test('inclusive facility date range covers both ends of a 25-hour DST day',async()=>{
      const result=await listAccountingLines(db,{facilityId:1,query:{from:'2026-11-01',through:'2026-11-01',pageSize:100}})
      assert.deepEqual(result.rows.map(row=>row.id).sort((a,b)=>a-b),[118,119])
      assert.equal(result.summary.billedCents,200);assert.equal(result.timezone,'America/New_York')
      const paid=await listAccountingLines(db,{facilityId:1,query:{from:'2026-02-10',through:'2026-02-10',dateField:'paid',pageSize:100}})
      assert.deepEqual(paid.rows.map(row=>row.id).sort((a,b)=>a-b),[101,102,104,110])
      assert.equal(paid.summary.paidCents,20000)
    })
    await t.test('fully reversed receipts remain discoverable by their original paid date',async()=>{
      await db.query('SAVEPOINT fully_reversed_receipt')
      try {
        await insert('billing_payment_application',{id:608,billing_payment_id:401,billing_charge_id:101,amount_cents:10000,application_kind:'reversal',reverses_application_id:601})
        await insert('billing_refund',{id:508,family_billing_account_id:1001,payment_id:401,related_charge_id:101,
          amount_cents:10000,external_status:'succeeded',ledger_treatment:'return_payment',created_at:'2026-02-12T15:00:00Z'})
        const detail=await accountingLineDetail(db,{facilityId:1,id:101})
        assert.equal(detail.line.paidCents,0);assert.equal(detail.line.openCents,10000)
        assert.equal(detail.line.paymentCount,1);assert.equal(detail.line.lastPaidDate,'2026-02-10')
        const paid=await listAccountingLines(db,{facilityId:1,query:{from:'2026-02-10',through:'2026-02-10',dateField:'paid',pageSize:100}})
        assert.deepEqual(paid.rows.map(row=>row.id).sort((a,b)=>a-b),[101,102,104,110])
        assert.equal(paid.summary.paidCents,10000)
      } finally {await db.query('ROLLBACK TO SAVEPOINT fully_reversed_receipt')}
    })
    await t.test('drop-in attribution follows explicit scoped history without foreign or mismatched-member leakage',async()=>{
      await db.query('SAVEPOINT drop_in_attribution')
      try {
        for(const [id,formId,memberId] of [[951,702,302],[952,801,401]]) {
          await insert('drop_in_registration',{id,form_id:formId,slot_group_id:1,member_id:memberId,class_date:'2026-01-15',
            first_name:'Historical',last_name:'Drop-in',email:'dropin@example.test',status:'cancelled'})
        }
        await charge(121,2500,{source_type:'drop_in',source_id:'951',member_id:302})
        await charge(122,500,{source_type:'drop_in',source_id:'952',member_id:302})
        await charge(123,500,{source_type:'drop_in',source_id:'951',member_id:301})
        const detail=await accountingLineDetail(db,{facilityId:1,id:121})
        assert.equal(detail.line.classId,502);assert.equal(detail.line.className,'Other local class')
        for(const id of [122,123]) assert.equal((await accountingLineDetail(db,{facilityId:1,id})).line.classId,null)
        const filtered=await listAccountingLines(db,{facilityId:1,query:{classId:502,pageSize:100}})
        assert.deepEqual(filtered.rows.map(row=>row.id).sort((a,b)=>a-b),[102,121])
      } finally {await db.query('ROLLBACK TO SAVEPOINT drop_in_attribution')}
    })
    await t.test('CSV uses the same filtered totals and escapes formulas, quotes, and newlines',async()=>{
      const result=await exportAccountingCsv(db,{facilityId:1,query:{search:'=SUM(1,2)',pageSize:1}})
      assert.equal(result.total,1)
      assert.ok(result.csv.includes('"\'=SUM(1,2) ""quoted""\nsecond line"'))
      assert.ok(result.csv.endsWith('\r\n'))
      assert.ok(!result.csv.includes('Foreign bill'))
    })
    await t.test('CSV refuses more than 10000 matching cash rows instead of silently truncating',async()=>{
      await db.query('SAVEPOINT export_capacity')
      try {
        await db.query(`INSERT INTO billing_payment(id,family_billing_account_id,amount_cents,external_status,external_reference,paid_at)
          SELECT 10000+id,1001,1,'settled','export-cap-fixture','2026-03-01T12:00:00Z'::timestamptz FROM generate_series(1,10001) id`)
        await assert.rejects(exportAccountingCsv(db,{facilityId:1,query:{view:'payments',search:'export-cap-fixture'}}),
          error=>error.statusCode===409&&/10,000/.test(error.message))
      } finally {await db.query('ROLLBACK TO SAVEPOINT export_capacity')}
    })
  } finally {
    await db.query('ROLLBACK')
    await db.end()
  }
})
