import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config({path: new URL('../.env.local', import.meta.url).pathname, quiet:true})
const apply = process.argv.includes('--apply')
const db = new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000})
const fields = {
  scheduling_form:['start_date','end_date'],
  scheduling_offering:['start_date','end_date'],
  scheduling_slot_group:['active_start','active_end'],
  scheduling_time_slot:['active_start','active_end','start_date','end_date'],
}
const tables = ['program','scheduling_signup',...Object.keys(fields)]
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
async function snapshot() {
  const result = {}
  for (const table of tables) result[table]=(await db.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY id`)).rows.map(r=>r.row)
  return result
}
try {
  await db.connect()
  await db.query('BEGIN')
  await db.query("SET LOCAL lock_timeout = '5s'")
  await db.query(`LOCK TABLE ${tables.join(',')} IN SHARE ROW EXCLUSIVE MODE`)
  const before = await snapshot()
  const ids = before.scheduling_form.filter(f=>f.program_id != null && f.deleted_at == null).map(f=>f.id)
  const target = (table,row) => ids.includes(table === 'scheduling_form' ? row.id : row.form_id)
  const planned = Object.fromEntries(Object.entries(fields).map(([table,cols])=>[table,before[table].filter(r=>target(table,r)&&cols.some(c=>r[c]!=null)).length]))
  console.log(JSON.stringify({mode:apply?'apply':'rehearsal',classes:ids.length,enrollments:before.scheduling_signup.length,planned}))
  if(apply) {
    const backup = `/private/tmp/vortex-class-dates-${Date.now()}.json`
    await fs.writeFile(backup,JSON.stringify(Object.fromEntries(Object.entries(fields).map(([table,cols])=>[table,before[table].filter(r=>target(table,r)).map(r=>Object.fromEntries(['id',...cols].map(c=>[c,r[c]])))])),null,2),{mode:0o600})
    console.log('Date backup:',backup)
  }
  await db.query(await fs.readFile(new URL('../migrations/851_optional_class_dates.sql',import.meta.url),'utf8'))
  for(const [table,cols] of Object.entries(fields)) {
    await db.query(`UPDATE ${table} SET ${cols.map(c=>`${c}=NULL`).join(',')} WHERE ${table==='scheduling_form'?'id':'form_id'} = ANY($1::bigint[]) AND (${cols.map(c=>`${c} IS NOT NULL`).join(' OR ')})`,[ids])
  }
  const after=await snapshot()
  for(const table of tables) {
    const expected=before[table].map(r=>fields[table]&&target(table,r)?{...r,...Object.fromEntries(fields[table].map(c=>[c,null]))}:r)
    if(digest(expected)!==digest(after[table])) throw new Error(`Unexpected changes in ${table}; rolling back`)
  }
  await db.query(apply?'COMMIT':'ROLLBACK')
  console.log(apply?'Committed: date boundaries cleared; all enrollment and non-date fields unchanged.':'Rehearsal passed and rolled back: all enrollment and non-date fields unchanged.')
} catch(e) {await db.query('ROLLBACK').catch(()=>{});console.error(e.message);process.exitCode=1} finally {await db.end()}
