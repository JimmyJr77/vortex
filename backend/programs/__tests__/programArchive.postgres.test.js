import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import pg from 'pg'

test('program and class archiving depend on current students, preserving enrollment history', {
  skip: process.env.RUN_ARCHIVE_LOCAL_TEST !== 'true',
}, async () => {
  const db = new pg.Client({ connectionString: `postgresql://${os.userInfo().username}@127.0.0.1:5432/postgres` })
  await db.connect()
  try {
    await db.query('BEGIN')
    await db.query(`CREATE SCHEMA archive_regression_test;
      SET LOCAL search_path TO archive_regression_test;
      CREATE TABLE programs (id bigint PRIMARY KEY, facility_id bigint, archived boolean DEFAULT false);
      CREATE TABLE program (id bigint PRIMARY KEY, programs_id bigint, facility_id bigint,
        archived boolean DEFAULT false, is_active boolean DEFAULT true, updated_at timestamptz);
      CREATE TABLE scheduling_form (id bigint PRIMARY KEY, program_id bigint);
      CREATE TABLE scheduling_signup (id bigint PRIMARY KEY, form_id bigint, status text,
        archived_at timestamptz, orphaned_at timestamptz);`)
    for (const file of ['847_program_archive_guard.sql', '852_enrollment_archive_guards.sql']) {
      await db.query(await fs.readFile(new URL(`../../migrations/${file}`, import.meta.url), 'utf8'))
    }
    await db.query(`INSERT INTO programs(id,facility_id) VALUES (1,1),(2,2);
      INSERT INTO program(id,programs_id,facility_id) VALUES (10,1,1),(20,2,2);
      INSERT INTO scheduling_form VALUES (100,10),(200,20);
      INSERT INTO scheduling_signup(id,form_id,status) VALUES (1000,100,'confirmed'),(2000,200,'confirmed');`)
    const blocked = async sql => {
      await db.query('SAVEPOINT rejected')
      await assert.rejects(db.query(sql), /Disenroll active students/)
      await db.query('ROLLBACK TO SAVEPOINT rejected')
    }
    for (const status of ['confirmed', 'active', 'paused']) {
      await db.query('UPDATE scheduling_signup SET status=$1 WHERE id=1000', [status])
      await blocked('UPDATE program SET archived=true WHERE id=10')
      await blocked('UPDATE programs SET archived=true WHERE id=1')
    }
    for (const status of ['cancelled', 'canceled', 'completed', 'disenrolled', 'waitlisted', 'pending_setup']) {
      await db.query('UPDATE scheduling_signup SET status=$1 WHERE id=1000', [status])
      await db.query('SAVEPOINT allowed')
      await db.query('UPDATE program SET archived=true,is_active=false WHERE id=10')
      await db.query('ROLLBACK TO SAVEPOINT allowed')
      await db.query('UPDATE programs SET archived=true WHERE id=1')
      const rows = (await db.query('SELECT id,archived,is_active FROM program ORDER BY id')).rows
      assert.deepEqual(rows.map(r => [r.archived, r.is_active]), [[true,false],[false,true]])
      assert.equal((await db.query('SELECT count(*)::int AS n FROM scheduling_signup')).rows[0].n, 2)
      await db.query('ROLLBACK TO SAVEPOINT allowed')
    }
    for (const column of ['archived_at', 'orphaned_at']) {
      await db.query('SAVEPOINT historical')
      await db.query(`UPDATE scheduling_signup SET status='confirmed', ${column}=now() WHERE id=1000`)
      await db.query('UPDATE programs SET archived=true WHERE id=1')
      await db.query('ROLLBACK TO SAVEPOINT historical')
    }
    await db.query('DELETE FROM scheduling_signup WHERE id=1000')
    await db.query('UPDATE programs SET archived=true WHERE id=1')
    await assert.rejects(db.query('UPDATE program SET archived=false,is_active=true WHERE id=10'), /Restore the program/)
  } finally {
    await db.query('ROLLBACK')
    await db.end()
  }
})
