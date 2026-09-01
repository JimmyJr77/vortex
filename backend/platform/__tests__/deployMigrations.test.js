import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  DEPLOY_MIGRATION_FILES,
  DEPLOY_MIGRATION_LOCK_ID,
  legacyMigrationChecksum,
  migrationChecksum,
  runDeployMigrations,
} from '../../deployMigrations.js'

async function migrationDirectory() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vortex-deploy-migrations-'))
  for (const [index, filename] of DEPLOY_MIGRATION_FILES.entries()) {
    await fs.writeFile(path.join(directory, filename), `SELECT ${index + 1};\n`)
  }
  return directory
}

function fakeMigrationClient() {
  const applied = new Map()
  const calls = []
  let transactionSnapshot = null
  return {
    applied,
    calls,
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('pg_advisory_lock') || text.includes('pg_advisory_unlock')) return { rows: [] }
      if (text === 'BEGIN') {
        transactionSnapshot = new Map(applied)
        return { rows: [] }
      }
      if (text === 'COMMIT') {
        transactionSnapshot = null
        return { rows: [] }
      }
      if (text === 'ROLLBACK') {
        if (transactionSnapshot) {
          applied.clear()
          for (const [filename, checksum] of transactionSnapshot) applied.set(filename, checksum)
        }
        transactionSnapshot = null
        return { rows: [] }
      }
      if (text.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) return { rows: [] }
      if (text.includes('SELECT filename, checksum')) {
        const checksum = applied.get(params[0])
        return { rows: checksum === undefined ? [] : [{ filename: params[0], checksum }] }
      }
      if (text.includes('INSERT INTO schema_migrations')) {
        applied.set(params[0], params[1])
        return { rows: [] }
      }
      if (text.includes('UPDATE schema_migrations')) {
        applied.set(params[0], params[1])
        return { rows: [] }
      }
      if (text.includes('FROM schema_migrations')) {
        return { rows: [...applied.keys()].map((filename) => ({ filename })) }
      }
      if (
        text.includes('to_regclass')
        || text.includes('information_schema.columns')
        || text.includes('pg_attrdef')
        || text.includes('pg_trigger')
        || text.includes('pg_proc')
        || text.includes('pg_constraint')
      ) return { rows: [] }
      if (/^SELECT \d+;/.test(text)) {
        return { rows: [] }
      }
      throw new Error(`Unexpected deploy migration query: ${text}`)
    },
  }
}

test('deploy migration runner applies only the fixed allowlist and is idempotent', async (t) => {
  const migrationsDirectory = await migrationDirectory()
  t.after(() => fs.rm(migrationsDirectory, { recursive: true, force: true }))
  const client = fakeMigrationClient()
  const logger = { info() {} }

  const first = await runDeployMigrations(client, { migrationsDirectory, logger })
  assert.deepEqual(first.applied, DEPLOY_MIGRATION_FILES)
  assert.deepEqual(first.skipped, [])
  assert.equal(first.readiness.ready, true)

  const migrationSqlCalls = () => client.calls.filter(({ text }) => /^SELECT \d+;/.test(text)).length
  assert.equal(migrationSqlCalls(), DEPLOY_MIGRATION_FILES.length)
  const second = await runDeployMigrations(client, { migrationsDirectory, logger })
  assert.deepEqual(second.applied, [])
  assert.deepEqual(second.skipped, DEPLOY_MIGRATION_FILES)
  assert.equal(migrationSqlCalls(), DEPLOY_MIGRATION_FILES.length)
  assert.ok(client.calls.some(({ text, params }) => (
    text.includes('pg_advisory_lock') && params[0] === DEPLOY_MIGRATION_LOCK_ID
  )))
})

test('deploy migration dry run validates readiness and rolls every change back', async (t) => {
  const migrationsDirectory = await migrationDirectory()
  t.after(() => fs.rm(migrationsDirectory, { recursive: true, force: true }))
  const client = fakeMigrationClient()

  const result = await runDeployMigrations(client, {
    migrationsDirectory,
    logger: { info() {} },
    dryRun: true,
  })

  assert.equal(result.dryRun, true)
  assert.deepEqual(result.applied, DEPLOY_MIGRATION_FILES)
  assert.equal(result.readiness.ready, true)
  assert.equal(client.applied.size, 0)
  assert.equal(client.calls.filter(({ text }) => text === 'BEGIN').length, 1)
  assert.equal(client.calls.filter(({ text }) => text === 'ROLLBACK').length, 1)
  assert.equal(client.calls.filter(({ text }) => text === 'COMMIT').length, 0)
})

test('deploy migration checksums are SHA-256 digests', () => {
  assert.match(migrationChecksum('SELECT 1;\n'), /^[0-9a-f]{64}$/)
  assert.notEqual(migrationChecksum('SELECT 1;\n'), migrationChecksum('SELECT 2;\n'))
})

test('deploy migration runner fails closed on checksum drift and releases its lock', async (t) => {
  const migrationsDirectory = await migrationDirectory()
  t.after(() => fs.rm(migrationsDirectory, { recursive: true, force: true }))
  const client = fakeMigrationClient()
  const filename = DEPLOY_MIGRATION_FILES[0]
  client.applied.set(filename, migrationChecksum('different migration text'))

  await assert.rejects(
    runDeployMigrations(client, { migrationsDirectory, logger: { info() {} } }),
    (error) => error.code === 'DEPLOY_MIGRATION_CHECKSUM_MISMATCH',
  )
  assert.ok(client.calls.some(({ text }) => text.includes('pg_advisory_unlock')))
})

test('deploy migration runner transactionally upgrades only an exact legacy checksum', async (t) => {
  const migrationsDirectory = await migrationDirectory()
  t.after(() => fs.rm(migrationsDirectory, { recursive: true, force: true }))
  const client = fakeMigrationClient()
  for (const [index, filename] of DEPLOY_MIGRATION_FILES.entries()) {
    const sql = `SELECT ${index + 1};\n`
    client.applied.set(filename, migrationChecksum(sql))
  }
  const legacyFilename = DEPLOY_MIGRATION_FILES[0]
  const legacySql = 'SELECT 1;\n'
  const legacyChecksum = legacyMigrationChecksum(legacySql)
  client.applied.set(legacyFilename, legacyChecksum)

  const result = await runDeployMigrations(client, {
    migrationsDirectory,
    logger: { info() {} },
  })

  assert.deepEqual(result.applied, [])
  assert.deepEqual(result.skipped, DEPLOY_MIGRATION_FILES)
  assert.equal(client.applied.get(legacyFilename), migrationChecksum(legacySql))
  assert.ok(client.calls.some(({ text, params }) => (
    text.includes('AND checksum = $3') && params[2] === legacyChecksum
  )))
})

test('deploy migration runner fails closed when an allowlisted file is missing', async (t) => {
  const migrationsDirectory = await migrationDirectory()
  t.after(() => fs.rm(migrationsDirectory, { recursive: true, force: true }))
  await fs.unlink(path.join(migrationsDirectory, DEPLOY_MIGRATION_FILES[1]))

  await assert.rejects(
    runDeployMigrations(fakeMigrationClient(), { migrationsDirectory, logger: { info() {} } }),
    (error) => error.code === 'DEPLOY_MIGRATION_MISSING',
  )
})
