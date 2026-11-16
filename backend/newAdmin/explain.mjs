import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import {listAccountDirectory} from '../accounts/accountDirectory.js'
import {listClasses} from './reads.js'
import {listLeads} from './leads.js'
import {validateRehearsalDatabaseUrl} from './migrationAudit.js'

const connectionString=validateRehearsalDatabaseUrl(process.env.NEW_ADMIN_DATABASE_URL||'')
const output=process.argv[2]||'docs/new-admin-query-plans.json'
const client=new pg.Client({connectionString})
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]
function nodes(plan,result=[]) {
  result.push({type:plan['Node Type'],relation:plan['Relation Name'],index:plan['Index Name'],rows:plan['Actual Rows'],loops:plan['Actual Loops'],sharedHitBlocks:plan['Shared Hit Blocks'],sharedReadBlocks:plan['Shared Read Blocks']})
  for(const child of plan.Plans||[])nodes(child,result)
  return result
}
await client.connect()
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  const fixture=await client.query("SELECT facility_id FROM app_user WHERE username='admin2' AND email='admin2@new-admin.example.test'")
  if(fixture.rows.length!==1) throw new Error('Seed the isolated New Admin database before measuring query plans.')
  const facilityId=Number(fixture.rows[0].facility_id)
  const counts=await client.query(`SELECT (SELECT count(*)::int FROM member WHERE facility_id=$1) members,
    (SELECT count(*)::int FROM registrations WHERE facility_id=$1) leads,
    (SELECT count(*)::int FROM program WHERE facility_id=$1) classes,
    (SELECT count(*)::int FROM scheduling_signup s JOIN member m ON m.id=s.member_id WHERE m.facility_id=$1) enrollments`,[facilityId])
  const results=[]
  for(const [name,load] of [
    ['directory',db=>listAccountDirectory(db,{facilityId,query:{pageSize:25}})],
    ['leads',db=>listLeads(db,facilityId,{pageSize:25})],
    ['classes',db=>listClasses(db,facilityId,{pageSize:25})],
  ]) {
    const statements=[]
    const db={query:async(query,values)=>{
      const statement=typeof query==='string'?{text:query,values}:query
      statements.push(statement)
      return client.query(statement)
    }}
    await load(db)
    for(let index=0;index<statements.length;index++) {
      const query=statements[index],samples=[]
      let plan
      for(let sample=0;sample<5;sample++) {
        plan=(await client.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${query.text}`,query.values)).rows[0]['QUERY PLAN'][0]
        samples.push({planningMs:plan['Planning Time'],executionMs:plan['Execution Time']})
      }
      results.push({name:`${name} ${index===0?'page':'count/facets'}`,parameters:query.values,planningMedianMs:median(samples.map(s=>s.planningMs)),executionMedianMs:median(samples.map(s=>s.executionMs)),samples,nodes:nodes(plan.Plan)})
    }
  }
  const indexes=(await client.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=ANY($1::text[]) ORDER BY tablename,indexname",[['member','family_member','scheduling_signup','scheduling_form','scheduling_slot_group','registrations']])).rows
  await client.query('COMMIT')
  const report={measuredAt:new Date().toISOString(),environment:'Loopback PostgreSQL, fictional development database, repeatable-read read-only transaction. Existing statistics; no planner overrides. One list warmup and five EXPLAIN ANALYZE runs per actual application SQL statement. SQL execution excludes API authentication, transport, and rendering.',counts:counts.rows[0],results,indexes}
  await fs.mkdir(path.dirname(output),{recursive:true})
  await fs.writeFile(output,JSON.stringify(report,null,2)+'\n')
  process.stdout.write(JSON.stringify({output,counts:report.counts,results:results.map(({name,planningMedianMs,executionMedianMs})=>({name,planningMedianMs,executionMedianMs}))},null,2)+'\n')
} catch(error) {await client.query('ROLLBACK');throw error}
finally {await client.end()}
