import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../../newAdmin/migrationAudit.js'
import { loadEnrollmentOrder, saveEnrollmentOrder } from '../enrollmentOrder.js'
import { listPublicClassesOffered } from '../listPublicClassesOffered.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('enrollment catalog order persists for public readers, scopes edits, and seeds development progression', { skip: !connectionString }, async () => {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    const command = { BEGIN: 'SAVEPOINT save_order', COMMIT: 'RELEASE SAVEPOINT save_order', ROLLBACK: 'ROLLBACK TO SAVEPOINT save_order' }
    const pool = { connect: async () => ({ query: (sql, args) => db.query(command[sql] || sql,args), release() {} }) }
    const facility = (await db.query("INSERT INTO facility(name) VALUES('Enrollment order fixture') RETURNING id")).rows[0].id
    const otherFacility = (await db.query("INSERT INTO facility(name) VALUES('Other enrollment fixture') RETURNING id")).rows[0].id
    const addProgram = async (name, display, owner=facility, description=null) => Number((await db.query('INSERT INTO programs(facility_id,name,display_name,is_active,description) VALUES($1,$2,$3,TRUE,$4) RETURNING id', [owner,name,display,description])).rows[0].id)
    const development = await addProgram('DEV_FIXTURE','Development Gymnastics')
    const team = await addProgram('TEAM_FIXTURE','Vortex Gymnastics Team',facility,'VTG is the official artistic gymnastics team of Vortex Gymnastics')
    const other = await addProgram('OTHER_FIXTURE','Other facility program',otherFacility)
    const addClass = async (parent,name,owner=facility) => Number((await db.query("INSERT INTO program(facility_id,programs_id,name,display_name,category,is_active) VALUES($1,$2,$3,$3,(enum_range(NULL::program_category))[1],TRUE) RETURNING id",[owner,parent,name])).rows[0].id)
    const classNames=['Vortex A4 Elite','Cyclones','Tornadoes','Twisters (Preschool)','Dirt Devils (Mommy & Me / 2-3 yrs old)']
    const classIds=[]
    for (const name of classNames) classIds.push(await addClass(development,name))
    const teamClass=await addClass(team,'Team training')
    const otherClass=await addClass(other,'Other facility class',otherFacility)
    const migration=await readFile(new URL('../../migrations/858_enrollment_catalog_order.sql',import.meta.url),'utf8')
    await db.query(migration)
    const initial=await loadEnrollmentOrder(db,facility)
    assert.deepEqual(initial.programs.map(row=>row.id),[development,team])
    assert.deepEqual(initial.programs[0].classes.map(row=>row.displayName),[...classNames].reverse())
    assert.equal((await db.query('SELECT description FROM programs WHERE id=$1',[team])).rows[0].description,'VGT is the official artistic gymnastics team of Vortex Gymnastics')
    const submitted={programs:[{id:team,classIds:[teamClass]},{id:development,classIds}]}
    await assert.rejects(saveEnrollmentOrder(pool,facility,{programs:[...submitted.programs,{id:other,classIds:[otherClass]}]}),{statusCode:409})
    await assert.rejects(saveEnrollmentOrder(pool,facility,{programs:[{id:team,classIds:[classIds[0]]},{id:development,classIds}]}),{statusCode:409})
    await assert.rejects(saveEnrollmentOrder(pool,facility,{programs:[{id:team,classIds:[teamClass,teamClass]}]}),{statusCode:400})
    assert.deepEqual(await loadEnrollmentOrder(db,facility),initial)
    assert.deepEqual(await saveEnrollmentOrder(pool,facility,submitted),{saved:true})
    assert.deepEqual((await loadEnrollmentOrder(db,facility)).programs.map(row=>row.id),[team,development])
    assert.deepEqual((await loadEnrollmentOrder(db,facility)).programs[1].classes.map(row=>row.id),classIds)
    assert.equal((await db.query('SELECT enrollment_sort_order FROM program WHERE id=$1',[otherClass])).rows[0].enrollment_sort_order,null)
    const publicResult=await listPublicClassesOffered(db)
    const visible=publicResult.programs.filter(row=>[team,development].includes(row.id))
    assert.deepEqual(visible.map(row=>row.id),[team,development])
    assert.deepEqual(visible.map(row=>row.enrollmentSortOrder),[0,1])
    assert.deepEqual(visible[1].classes.map(row=>row.id),classIds)
    await db.query(migration)
    assert.deepEqual((await loadEnrollmentOrder(db,facility)).programs[1].classes.map(row=>row.id),classIds,'migration must not reset saved admin order')
    await addClass(development,'New class after editor opened')
    await assert.rejects(saveEnrollmentOrder(pool,facility,submitted),{statusCode:409})
    assert.equal((await loadEnrollmentOrder(db,facility)).programs[0].id,team,'stale catalog save rolls back')
  } finally {
    await db.query('ROLLBACK').catch(()=>{})
    await db.end()
  }
})
