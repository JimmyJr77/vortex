import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import pg from 'pg'
import { resolveEffectiveFormPricing, loadEffectivePricingForForm } from '../../programs/pricingDefaults.js'
import { hydrateProgramPricingRow } from '../../programs/programPricingOptions.js'
import { saveClass,saveClassPrice } from '../classPricing.js'
import { listClasses } from '../reads.js'

const url=process.env.NEW_ADMIN_TEST_DATABASE_URL
if(url && (!['localhost','127.0.0.1'].includes(new URL(url).hostname) || !new URL(url).pathname.startsWith('/vortex_new_admin_dev'))) throw new Error('Isolated local test database required')
test('class pricing migration preserves all prices and billing records; canonical edits are atomic', {skip:!url}, async()=>{
  const pool=new pg.Pool({connectionString:url})
  const client=await pool.connect()
  // Keep the entire rehearsal, including DDL, inside a rolled-back transaction.
  const transactionPool={connect:async()=>({query:(sql,params)=>client.query(sql==='BEGIN'?'SAVEPOINT class_save':sql==='COMMIT'?'RELEASE SAVEPOINT class_save':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT class_save':sql,params),release:()=>{}})}
  const ledger=async()=>{
    const result={}
    for(const table of ['scheduling_signup','billing_subscription','billing_charge','enrollment_price_adjustment']) {
      result[table]=(await client.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(to_jsonb(t)::text,',' ORDER BY id),'')) AS digest FROM ${table} t`)).rows[0]
    }
    return result
  }
  try {
    await client.query('BEGIN')
    const beforeLedger=await ledger()
    const forms=(await client.query('SELECT to_jsonb(f) AS form,to_jsonb(p) AS program FROM scheduling_form f LEFT JOIN program c ON c.id=f.program_id LEFT JOIN programs p ON p.id=c.programs_id')).rows
    const before=new Map(forms.map(row=>[row.form.id,resolveEffectiveFormPricing(hydrateProgramPricingRow(row.program),row.form)]))
    const migration=await fs.readFile(new URL('../../migrations/848_class_owned_pricing.sql',import.meta.url),'utf8')
    await client.query(migration)
    await client.query(migration)
    for(const row of (await client.query('SELECT * FROM scheduling_form')).rows) {
      if(!before.has(row.id)) continue
      const after=(await loadEffectivePricingForForm(client,row)).effective
      assert.deepEqual(after,before.get(row.id),`pricing changed for form ${row.id}`)
    }
    const facility=(await client.query("INSERT INTO facility(name,timezone) VALUES('Class pricing rehearsal','America/New_York') RETURNING id")).rows[0].id
    const parent=(await client.query("INSERT INTO programs(facility_id,name,display_name,pricing_slot_cost_monthly_cents,pricing_cost_amount_cents,pricing_cost_unit) VALUES($1,'PRICE_TEST','Pricing test',15000,15000,'per_month') RETURNING id",[facility])).rows[0].id
    const details={displayName:'Price test',programsId:Number(parent),monthlyPriceCents:12000,isActive:true}
    const created=await saveClass(transactionPool,facility,null,details)
    const row=(await listClasses(client,facility)).rows.find(row=>row.id===created.id)
    assert.equal(row.monthlyPriceCents,12000)
    const form=(await client.query('SELECT * FROM scheduling_form WHERE program_id=$1',[created.id])).rows[0]
    await saveClass(transactionPool,facility,created.id,{...details,displayName:'Renamed'})
    const renamed=(await client.query('SELECT * FROM scheduling_form WHERE id=$1',[form.id])).rows[0]
    assert.equal(renamed.title,'Renamed')
    assert.deepEqual({...renamed,title:form.title,updated_at:form.updated_at},form,'metadata edit changed pricing')
    await saveClass(transactionPool,facility,created.id,{...details,monthlyPriceCents:0})
    assert.equal((await listClasses(client,facility)).rows[0].monthlyPriceCents,0,'zero must not fall back to program price')
    const metadata=(await client.query('SELECT to_jsonb(p) AS data FROM program p WHERE id=$1',[created.id])).rows[0].data
    await saveClassPrice(transactionPool,facility,created.id,{monthlyPriceCents:13500})
    assert.equal((await listClasses(client,facility)).rows[0].monthlyPriceCents,13500,'Pricing changes immediately appear in Classes & schedules')
    assert.deepEqual((await client.query('SELECT to_jsonb(p) AS data FROM program p WHERE id=$1',[created.id])).rows[0].data,metadata,'price-only saves do not overwrite class metadata')
    const sharedForm=(await client.query('SELECT * FROM scheduling_form WHERE id=$1',[form.id])).rows[0]
    assert.equal((await loadEffectivePricingForForm(client,sharedForm)).effective.costAmountCents,13500,'old admin and registration pricing see the same saved price')
    await client.query("UPDATE scheduling_form SET cost_amount_cents=14500,slot_cost_monthly_cents=14500,cost_unit='per_month' WHERE id=$1",[form.id])
    assert.equal((await listClasses(client,facility)).rows[0].monthlyPriceCents,14500,'legacy class-price edits flow back into the shared listing')
    await saveClass(transactionPool,facility,created.id,{...details,monthlyPriceCents:0})
    await assert.rejects(saveClassPrice(transactionPool,facility+999999,created.id,{monthlyPriceCents:100}),/not found/)
    await assert.rejects(saveClassPrice(transactionPool,facility,created.id,{monthlyPriceCents:-1}),/greater than or equal/)
    await assert.rejects(saveClass(transactionPool,facility+999999,created.id,details),/not found/)
    const expensive=await saveClass(transactionPool,facility,null,{...details,displayName:'A high price',monthlyPriceCents:19000})
    const cheap=await saveClass(transactionPool,facility,null,{...details,displayName:'Z low price',monthlyPriceCents:9000})
    const sorted=await listClasses(client,facility,{sort:'cost',direction:'desc',pageSize:1,page:2})
    assert.equal(sorted.rows[0].id,cheap.id,'cost sorting must happen before pagination')
    assert.equal(sorted.total,3)
    assert.equal((await listClasses(client,facility,{sort:'cost',direction:'desc',pageSize:1,page:1})).rows[0].id,expensive.id)
    assert.equal((await listClasses(client,facility,{sort:'class',direction:'desc',pageSize:1})).rows[0].id,cheap.id)

    assert.deepEqual(await ledger(),beforeLedger,'migration or edits changed enrollment/billing records')
  } finally {await client.query('ROLLBACK');client.release();await pool.end()}
})
