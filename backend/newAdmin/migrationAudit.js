import crypto from 'node:crypto'
import { id,inputError } from './common.js'

const TABLES=['member','app_user','app_user_role','family','family_member','parent_guardian_authority','family_billing_account',
  'programs','program','scheduling_form','scheduling_offering','scheduling_slot_group','scheduling_time_slot','scheduling_signup','drop_in_registration','registrations',
  'billing_charge','billing_subscription','billing_monthly_invoice','billing_monthly_invoice_line','billing_statement','billing_statement_line',
  'billing_payment','billing_payment_application','billing_payment_attempt','billing_payment_attempt_charge','billing_refund','billing_pause_credit','billing_charge_credit_application',
  'enrollment_price_adjustment','drop_in_credit_adjustment','billing_account_activity','billing_enrollment_deletion',
  'stripe_webhook_event','stripe_pending_enrollment','stripe_customer_projection','stripe_catalog_item','stripe_dispute_case']
const quote=value=>`"${String(value).replaceAll('"','""')}"`

/** Consistent read-only evidence; schema introspection is appropriate in tooling. */
export async function migrationSnapshot(pool) {
  const client=await pool.connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const schema=await client.query(`SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[]) ORDER BY table_name,ordinal_position`,[TABLES])
    const tables={}
    for(const table of TABLES) {
      const columns=schema.rows.filter(row=>row.table_name===table)
      if(!columns.length) continue
      const count=await client.query(`SELECT COUNT(*)::text AS count FROM ${quote(table)}`)
      const entry={count:count.rows[0].count}
      // Hash complete canonical relationship identity, status, money and processor
      // references. Ownership additions alone are intentionally excluded.
      const selected=columns.filter(c=>c.column_name==='id'||c.column_name.endsWith('_id')||c.column_name.endsWith('_date')||['status','is_active','is_selected','currency','source_type','billing_interval','archived_at','orphaned_at','role','effect','first_name','last_name','email','phone','family_name','username','password_hash','name','display_name'].includes(c.column_name)||c.column_name.endsWith('_cents')||/stripe_|external_.*id/.test(c.column_name))
        .filter(c=>!(table==='registrations'&&['facility_id','converted_member_id','converted_by_user_id'].includes(c.column_name)))
      if(selected.length) {
        const expression=selected.map(c=>quote(c.column_name)).join(',')
        const digest=await client.query(`SELECT md5(COALESCE(string_agg(row_text,E'\n' ORDER BY row_text),'')) AS fingerprint FROM (SELECT jsonb_build_array(${expression})::text AS row_text FROM ${quote(table)}) q`)
        entry.fingerprint=digest.rows[0].fingerprint
      }
      const cents=columns.filter(c=>c.column_name.endsWith('_cents')&&['integer','bigint','numeric','smallint'].includes(c.data_type))
      if(cents.length) {
        const account=columns.some(c=>c.column_name==='family_billing_account_id')?'family_billing_account_id::text':"'all'::text"
        const currency=columns.some(c=>c.column_name==='currency')?"COALESCE(currency::text,'unspecified')":"'unspecified'::text"
        const totals=await client.query(`SELECT ${account} AS account,${currency} AS currency,${cents.map(c=>`COALESCE(SUM(${quote(c.column_name)}),0)::text AS ${quote(c.column_name)}`).join(',')} FROM ${quote(table)} GROUP BY 1,2 ORDER BY 1,2`)
        entry.financialTotals=totals.rows
      }
      tables[table]=entry
    }
    const anomalies=await client.query(`SELECT 'cross_facility_family' AS kind,m.id::text AS id FROM family_member fm JOIN family f ON f.id=fm.family_id JOIN member m ON m.id=fm.member_id WHERE m.facility_id<>f.facility_id
      UNION ALL SELECT 'multiple_active_families',member_id::text FROM family_member WHERE is_active=TRUE GROUP BY member_id HAVING COUNT(*)>1
      UNION ALL SELECT 'invalid_payer',b.id::text FROM family_billing_account b JOIN family f ON f.id=b.family_id LEFT JOIN member m ON m.id=b.payer_member_id WHERE b.payer_member_id IS NOT NULL AND (m.id IS NULL OR m.facility_id<>f.facility_id OR NOT EXISTS(SELECT 1 FROM family_member fm WHERE fm.family_id=f.id AND fm.member_id=m.id AND fm.is_active=TRUE))
      UNION ALL SELECT 'cross_facility_enrollment',s.id::text FROM scheduling_signup s JOIN member m ON m.id=s.member_id JOIN scheduling_form sf ON sf.id=s.form_id JOIN program p ON p.id=sf.program_id WHERE p.facility_id<>m.facility_id
      UNION ALL SELECT 'missing_enrollment_member',s.id::text FROM scheduling_signup s LEFT JOIN member m ON m.id=s.member_id WHERE m.id IS NULL
      UNION ALL SELECT 'invalid_signup_group',s.id::text FROM scheduling_signup s LEFT JOIN scheduling_slot_group g ON g.id=s.slot_group_id WHERE g.id IS NULL OR g.form_id<>s.form_id
      UNION ALL SELECT 'invalid_signup_slot',s.id::text FROM scheduling_signup s JOIN scheduling_time_slot ts ON ts.id=s.time_slot_id WHERE ts.form_id<>s.form_id OR ts.slot_group_id IS DISTINCT FROM s.slot_group_id
      UNION ALL SELECT 'cross_facility_guardian',a.child_member_id::text FROM parent_guardian_authority a JOIN member parent ON parent.id=a.parent_member_id JOIN member child ON child.id=a.child_member_id WHERE parent.facility_id<>child.facility_id
      ORDER BY kind,id`)
    await client.query('COMMIT')
    return {version:1,capturedAt:new Date().toISOString(),tables,missingTables:TABLES.filter(table=>!tables[table]),anomalies:anomalies.rows}
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}

export function compareSnapshots(before,after) {
  const differences=[]
  for(const key of new Set([...Object.keys(before.tables||{}),...Object.keys(after.tables||{})])) {
    if(JSON.stringify(before.tables?.[key])!==JSON.stringify(after.tables?.[key])) differences.push({table:key,before:before.tables?.[key],after:after.tables?.[key]})
  }
  if(JSON.stringify(before.anomalies)!==JSON.stringify(after.anomalies)) differences.push({anomaliesBefore:before.anomalies,anomaliesAfter:after.anomalies})
  if(JSON.stringify(before.missingTables)!==JSON.stringify(after.missingTables)) differences.push({missingTablesBefore:before.missingTables,missingTablesAfter:after.missingTables})
  return {matches:differences.length===0,differences}
}

export function validateRehearsalDatabaseUrl(connectionString,{nodeEnv=process.env.NODE_ENV}={}) {
  if(nodeEnv==='production') throw inputError('Rehearsal tooling cannot run in production.')
  const url=new URL(connectionString)
  if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.search||url.hash||!/^vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(url.pathname.slice(1)))) {
    throw inputError('Use a loopback vortex_new_admin_dev[_suffix] PostgreSQL URL without query or fragment overrides.')
  }
  return url.toString()
}

export async function planLeadOwnership(db,{facilityId,leadIds=[]}={}) {
  const facilities=await db.query('SELECT id FROM facility ORDER BY id')
  const facility=facilityId==null?null:id(facilityId,'facility')
  if(facility&&!facilities.rows.some(f=>Number(f.id)===facility)) throw inputError('Target facility does not exist.')
  const explicitIds=leadIds.map(value=>id(value,'lead'))
  if(facility&&facilities.rows.length>1&&!explicitIds.length) throw inputError('Multiple facilities exist: supply explicit reviewed lead IDs; bulk ownership cannot be inferred.')
  const rows=await db.query(`SELECT id,facility_id,updated_at FROM registrations WHERE facility_id IS NULL AND ($1::int[] IS NULL OR id=ANY($1::int[])) ORDER BY id`,[explicitIds.length?explicitIds:null])
  return {facilityId:facility,assignable:facility?rows.rows.map(row=>Number(row.id)):[],quarantined:facility?[]:rows.rows.map(row=>Number(row.id)),requestedIds:explicitIds}
}

export async function applyLeadOwnership(pool,options) {
  const client=await pool.connect(),batchId=crypto.randomUUID()
  try {
    await client.query('BEGIN')
    const plan=await planLeadOwnership(client,options)
    if(!plan.facilityId) throw inputError('An explicit facility mapping is required before apply.')
    const rows=await client.query(`SELECT id,updated_at FROM registrations WHERE id=ANY($1::int[]) AND facility_id IS NULL ORDER BY id FOR UPDATE`,[plan.assignable])
    for(const row of rows.rows) {
      // Keep PostgreSQL's microsecond precision so an unchanged row can be
      // safely restored; round-tripping updated_at through a JS Date loses it.
      await client.query(`INSERT INTO new_admin_lead_ownership_audit(batch_id,registration_id,old_facility_id,new_facility_id,record_updated_at)
        SELECT $1,id,NULL,$3,updated_at FROM registrations WHERE id=$2`,[batchId,row.id,plan.facilityId])
      await client.query('UPDATE registrations SET facility_id=$2 WHERE id=$1 AND facility_id IS NULL',[row.id,plan.facilityId])
    }
    await client.query('COMMIT')
    return {...plan,batchId,appliedIds:rows.rows.map(row=>Number(row.id))}
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}

export async function configurePublicLeadFacility(db,facilityId) {
  const facility=id(facilityId,'facility')
  const result=await db.query(`INSERT INTO new_admin_public_lead_facility(singleton,facility_id)
    SELECT TRUE,id FROM facility WHERE id=$1
    ON CONFLICT(singleton) DO UPDATE SET facility_id=EXCLUDED.facility_id,configured_at=now() RETURNING facility_id`,[facility])
  if(!result.rows[0]) throw inputError('Target facility does not exist.')
  return {publicLeadFacilityId:Number(result.rows[0].facility_id)}
}

export async function rollbackLeadOwnership(pool,batchId) {
  if(!/^[0-9a-f-]{36}$/i.test(batchId||'')) throw inputError('A valid ownership batch UUID is required.')
  const client=await pool.connect()
  try {
    await client.query('BEGIN')
    const result=await client.query(`WITH restored AS (
      UPDATE registrations r SET facility_id=a.old_facility_id FROM new_admin_lead_ownership_audit a
      WHERE a.batch_id=$1 AND a.registration_id=r.id AND a.rolled_back_at IS NULL
        AND r.facility_id=a.new_facility_id AND r.updated_at IS NOT DISTINCT FROM a.record_updated_at
        AND r.converted_member_id IS NULL RETURNING r.id
    ) UPDATE new_admin_lead_ownership_audit a SET rolled_back_at=now() FROM restored WHERE a.batch_id=$1 AND a.registration_id=restored.id RETURNING a.registration_id`,[batchId])
    const retained=await client.query('SELECT registration_id FROM new_admin_lead_ownership_audit WHERE batch_id=$1 AND rolled_back_at IS NULL',[batchId])
    await client.query('COMMIT')
    return {restoredIds:result.rows.map(r=>Number(r.registration_id)),concurrentOrConvertedIds:retained.rows.map(r=>Number(r.registration_id))}
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
