import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import pg from 'pg'
import { configureBillingWorkerPool, assertBillingConnectionHealthy } from '../billingDatabaseRecovery.js'
import { createRecurringBillingProgress } from '../recurringBillingProgress.js'
import { generateRecurringCharges } from '../../scheduling/generateRecurringCharges.js'

const url = process.env.BILLING_WORKER_TEST_DATABASE_URL
test('recurring worker PostgreSQL connection-loss and progress regressions', { skip: !url }, async t => {
  const target = new URL(url)
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(target.hostname))
  assert.ok(['/vortex_billing_test','/vortex_migration_ci'].includes(target.pathname))
  assert.equal(target.search, '')
  const schema = `worker_${randomUUID().replaceAll('-', '')}`
  const admin = new pg.Client({ connectionString: url })
  await admin.connect()
  await admin.query(`CREATE SCHEMA ${schema}`)
  await admin.query(`SET search_path TO ${schema}`)
  await admin.query('CREATE TABLE family_billing_account(id bigint PRIMARY KEY,is_active boolean NOT NULL)')
  await admin.query('INSERT INTO family_billing_account VALUES (8,true),(9,true),(10,false)')
  await admin.query(`CREATE TABLE stripe_billing_alert(stripe_event_id text UNIQUE,family_billing_account_id bigint,
    alert_type text,severity text,message text,details jsonb,resolved_at timestamptz,action_status text DEFAULT 'open',updated_at timestamptz DEFAULT now())`)
  await admin.query(await fs.readFile(new URL('../../migrations/839_recurring_billing_progress.sql', import.meta.url), 'utf8'))
  const pool = configureBillingWorkerPool(new pg.Pool({ connectionString: url, options: `-c search_path=${schema}`, max: 3 }), { log: () => {} })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end() })
  const start = () => createRecurringBillingProgress(pool, { asOf: new Date('2026-11-01T07:15:00Z'), collectPayments: true })

  await t.test('all accounts are durable before work and unfinished rows survive a new worker', async () => {
    const first = await start()
    await first.record({ accountId: 8, status: 'running' })
    const next = await start()
    assert.notEqual(first.runId, next.runId)
    const rows = (await admin.query('SELECT family_billing_account_id,status FROM billing_recurring_account_progress WHERE run_id=$1 ORDER BY family_billing_account_id', [first.runId])).rows
    assert.deepEqual(rows, [{ family_billing_account_id: '8', status: 'running' }, { family_billing_account_id: '9', status: 'pending' }])
    assert.equal(await first.finish('completed'), 'failed')
    await next.finish('interrupted', {}, new Error('test shutdown'))
  })

  await t.test('replayed progress writes keep one row and one attempt count', async () => {
    const run = await start()
    for (let i = 0; i < 2; i++) await run.record({ accountId: 8, status: 'completed', attempt: 2, result: { invoiceStatus: 'paid' } })
    await run.record({ accountId: 9, status: 'skipped' })
    const rows = (await admin.query('SELECT attempt_count,result FROM billing_recurring_account_progress WHERE run_id=$1 AND family_billing_account_id=8', [run.runId])).rows
    assert.deepEqual(rows, [{ attempt_count: 2, result: { invoiceStatus: 'paid' } }])
    assert.equal(await run.finish('completed'), 'completed')
  })

  await t.test('an account hold is visible before later accounts run and cannot produce a clean completion', async () => {
    const run = await start()
    await run.record({ accountId: 8, status: 'blocked', result: { code: 'review_needed', message: 'Synthetic hold' } })
    const alert = (await admin.query('SELECT message,details FROM stripe_billing_alert WHERE family_billing_account_id=8')).rows[0]
    assert.equal(alert.message, 'Synthetic hold')
    assert.equal(alert.details.runId, run.runId)
    assert.equal((await admin.query('SELECT status FROM billing_recurring_account_progress WHERE run_id=$1 AND family_billing_account_id=9', [run.runId])).rows[0].status, 'pending')
    await run.record({ accountId: 9, status: 'completed' })
    assert.equal(await run.finish('completed'), 'failed')
  })

  await t.test('a missing run cannot silently authorize work or report success', async () => {
    const run = await start()
    await admin.query('DELETE FROM billing_recurring_account_progress WHERE run_id=$1', [run.runId])
    await admin.query('DELETE FROM billing_recurring_run WHERE id=$1', [run.runId])
    await assert.rejects(run.record({ accountId: 8, status: 'running' }), /progress was not saved/)
    await assert.rejects(run.finish('completed'), /completion was not saved/)
  })

  await t.test('a real database termination releases the broken session, reconciles, and finishes later accounts', async () => {
    const run = await start()
    const accounts = [8,9].map(id => ({ id, facility_timezone: 'America/New_York' }))
    const inventoryPool = {
      query: async () => ({ rows: accounts }),
      connect: pool.connect.bind(pool),
    }
    let killedPid
    let calls = 0
    const simulatedPayments = []
    const reconciled = []
    const result = await generateRecurringCharges(inventoryPool, {
      asOf: new Date('2026-11-01T07:15:00Z'), collectPayments: true,
      onProgress: run.record,
      accountReconciler: async (client, { accountId }) => {
        assert.notEqual((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid, killedPid)
        reconciled.push(accountId)
      },
      accountProcessor: async (client, account) => {
        if (++calls === 1) {
          killedPid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
          const disconnected = new Promise(resolve => client.once('error', resolve))
          // Terminate only this test's checked-out session, while no query is
          // active: precisely the production failure during a Stripe await.
          await admin.query('SELECT pg_terminate_backend($1)', [killedPid])
          await disconnected
        }
        assertBillingConnectionHealthy(client)
        simulatedPayments.push(account.id)
        return { invoiceOutcome: { status: 'paid' } }
      },
    })
    assert.deepEqual(reconciled, [8])
    assert.deepEqual(simulatedPayments, [8,9])
    assert.deepEqual(result.completedAccountIds, [8,9])
    const rows = (await admin.query('SELECT family_billing_account_id,status,attempt_count FROM billing_recurring_account_progress WHERE run_id=$1 ORDER BY family_billing_account_id', [run.runId])).rows
    assert.deepEqual(rows, [
      { family_billing_account_id: '8', status: 'completed', attempt_count: 2 },
      { family_billing_account_id: '9', status: 'completed', attempt_count: 1 },
    ])
    assert.equal(await run.finish('completed'), 'completed')
  })
})
