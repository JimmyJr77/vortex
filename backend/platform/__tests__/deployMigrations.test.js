import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  DEPLOY_MIGRATION_CHECKSUM_COMPATIBILITY,
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
        if (params.length >= 3 && applied.get(params[0]) !== params[2]) {
          return { rows: [], rowCount: 0 }
        }
        applied.set(params[0], params[1])
        return { rows: [], rowCount: 1 }
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
        || text.includes('FROM facility')
        || text.includes('FROM app_user au')
        || text.includes('FROM member m')
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

test('deploy checksum compatibility inventory is exact, filename-scoped, and canonically pinned', async () => {
  assert.deepEqual(DEPLOY_MIGRATION_CHECKSUM_COMPATIBILITY, {
    '057_stripe_pending_enrollment.sql': {
      canonicalSha256: '5bab4f671953a4ba113d8a8b91f223b4e22f771b6467a78c502852fad0df52c4',
      historicalVariants: [
        {
          legacyChecksum: '3788120324',
          sha256: 'edf084bb143c4365728ec6fbcd8c462b88698c86bf403129ef55a23669e7d1e4',
        },
        {
          legacyChecksum: '322505987',
          sha256: 'ee89aad175bcc427b090cb80145a1502d11621fe98a89869fb8917db8b35e8c9',
        },
      ],
    },
    '058_billing_stripe_links.sql': {
      canonicalSha256: '95ed6eaa12aaa8067c9a30e9280d088e876a8f5f159b20e30dba6646109c4c08',
      historicalVariants: [
        {
          legacyChecksum: '2266470195',
          sha256: '1f0635f80093c1beea17030b9cfc4a469fc58de19bc06069663cb23678ba8dab',
        },
      ],
    },
  })

  for (const [filename, compatibility] of Object.entries(DEPLOY_MIGRATION_CHECKSUM_COMPATIBILITY)) {
    const sql = await fs.readFile(new URL(`../../migrations/${filename}`, import.meta.url), 'utf8')
    assert.equal(migrationChecksum(sql), compatibility.canonicalSha256, filename)
  }
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

test('deploy upgrades the restored base 057 and 058 legacy rows to their immutable SHA-256 digests', async (t) => {
  const migrationsDirectory = await migrationDirectory()
  t.after(() => fs.rm(migrationsDirectory, { recursive: true, force: true }))
  const historicalFiles = new Map([
    ['057_stripe_pending_enrollment.sql', '4195216797'],
    ['058_billing_stripe_links.sql', '924214856'],
  ])
  for (const filename of historicalFiles.keys()) {
    await fs.copyFile(
      new URL(`../../migrations/${filename}`, import.meta.url),
      path.join(migrationsDirectory, filename),
    )
  }

  const client = fakeMigrationClient()
  for (const [index, filename] of DEPLOY_MIGRATION_FILES.entries()) {
    const sql = await fs.readFile(path.join(migrationsDirectory, filename), 'utf8')
    client.applied.set(filename, migrationChecksum(sql || `SELECT ${index + 1};\n`))
  }
  for (const [filename, checksum] of historicalFiles) client.applied.set(filename, checksum)

  const result = await runDeployMigrations(client, {
    migrationsDirectory,
    logger: { info() {} },
  })

  assert.deepEqual(result.applied, [])
  assert.deepEqual(result.skipped, DEPLOY_MIGRATION_FILES)
  for (const [filename, legacyChecksum] of historicalFiles) {
    const sql = await fs.readFile(path.join(migrationsDirectory, filename), 'utf8')
    assert.equal(client.applied.get(filename), migrationChecksum(sql), filename)
    assert.ok(client.calls.some(({ text, params }) => (
      text.includes('AND checksum = $3')
      && params[0] === filename
      && params[2] === legacyChecksum
    )), filename)
  }
})

test('deploy transactionally upgrades every approved historical checksum variant', async (t) => {
  const migrationsDirectory = await migrationDirectory()
  t.after(() => fs.rm(migrationsDirectory, { recursive: true, force: true }))
  for (const filename of Object.keys(DEPLOY_MIGRATION_CHECKSUM_COMPATIBILITY)) {
    await fs.copyFile(
      new URL(`../../migrations/${filename}`, import.meta.url),
      path.join(migrationsDirectory, filename),
    )
  }

  for (const [historicalFilename, compatibility] of Object.entries(
    DEPLOY_MIGRATION_CHECKSUM_COMPATIBILITY,
  )) {
    for (const historicalVariant of compatibility.historicalVariants) {
      for (const historicalChecksum of [
        historicalVariant.legacyChecksum,
        historicalVariant.sha256,
      ]) {
        const client = fakeMigrationClient()
        for (const filename of DEPLOY_MIGRATION_FILES) {
          const sql = await fs.readFile(path.join(migrationsDirectory, filename), 'utf8')
          client.applied.set(filename, migrationChecksum(sql))
        }
        client.applied.set(historicalFilename, historicalChecksum)

        const result = await runDeployMigrations(client, {
          migrationsDirectory,
          logger: { info() {} },
        })

        assert.deepEqual(result.applied, [])
        assert.deepEqual(result.skipped, DEPLOY_MIGRATION_FILES)
        assert.equal(
          client.applied.get(historicalFilename),
          historicalVariant.sha256,
          `${historicalFilename}:${historicalChecksum}`,
        )
        if (historicalChecksum === historicalVariant.legacyChecksum) {
          assert.ok(client.calls.some(({ text, params }) => (
            text.includes('AND checksum = $3')
            && params[0] === historicalFilename
            && params[1] === historicalVariant.sha256
            && params[2] === historicalChecksum
          )), `${historicalFilename}:${historicalChecksum}`)
        } else {
          assert.equal(client.calls.some(({ text, params }) => (
            text.includes('UPDATE schema_migrations')
            && params[0] === historicalFilename
          )), false, `${historicalFilename}:${historicalChecksum}`)
        }
      }
    }
  }
})

test('deploy rejects an approved checksum under the wrong filename or changed canonical target', async (t) => {
  const migrationsDirectory = await migrationDirectory()
  t.after(() => fs.rm(migrationsDirectory, { recursive: true, force: true }))
  for (const filename of Object.keys(DEPLOY_MIGRATION_CHECKSUM_COMPATIBILITY)) {
    await fs.copyFile(
      new URL(`../../migrations/${filename}`, import.meta.url),
      path.join(migrationsDirectory, filename),
    )
  }

  const wrongFilenameClient = fakeMigrationClient()
  wrongFilenameClient.applied.set('057_stripe_pending_enrollment.sql', '2266470195')
  await assert.rejects(
    runDeployMigrations(wrongFilenameClient, {
      migrationsDirectory,
      logger: { info() {} },
    }),
    (error) => error.code === 'DEPLOY_MIGRATION_CHECKSUM_MISMATCH',
  )

  const changedTargetClient = fakeMigrationClient()
  for (const filename of DEPLOY_MIGRATION_FILES) {
    const sql = await fs.readFile(path.join(migrationsDirectory, filename), 'utf8')
    changedTargetClient.applied.set(filename, migrationChecksum(sql))
  }
  changedTargetClient.applied.set('058_billing_stripe_links.sql', '2266470195')
  await fs.appendFile(path.join(migrationsDirectory, '058_billing_stripe_links.sql'), '\n')

  await assert.rejects(
    runDeployMigrations(changedTargetClient, {
      migrationsDirectory,
      logger: { info() {} },
    }),
    (error) => error.code === 'DEPLOY_MIGRATION_CHECKSUM_MISMATCH',
  )
})

test('deploy fails closed if an approved historical checksum changes before its CAS upgrade', async (t) => {
  const migrationsDirectory = await migrationDirectory()
  t.after(() => fs.rm(migrationsDirectory, { recursive: true, force: true }))
  const historicalFilename = '058_billing_stripe_links.sql'
  await fs.copyFile(
    new URL(`../../migrations/${historicalFilename}`, import.meta.url),
    path.join(migrationsDirectory, historicalFilename),
  )

  const client = fakeMigrationClient()
  for (const filename of DEPLOY_MIGRATION_FILES) {
    const sql = await fs.readFile(path.join(migrationsDirectory, filename), 'utf8')
    client.applied.set(filename, migrationChecksum(sql))
  }
  client.applied.set(historicalFilename, '2266470195')

  const query = client.query.bind(client)
  let injectedRace = false
  client.query = async (sql, params = []) => {
    const text = String(sql)
    if (!injectedRace && text.includes('UPDATE schema_migrations')) {
      injectedRace = true
      client.applied.set(historicalFilename, 'concurrent-checksum-change')
    }
    return query(sql, params)
  }

  await assert.rejects(
    runDeployMigrations(client, { migrationsDirectory, logger: { info() {} } }),
    (error) => error.code === 'DEPLOY_MIGRATION_CHECKSUM_MISMATCH',
  )
  assert.equal(injectedRace, true)
  assert.ok(client.calls.some(({ text, params }) => (
    text.includes('AND checksum = $3')
    && params[0] === historicalFilename
    && params[2] === '2266470195'
  )))
})

test('deploy migration runner fails closed if a legacy checksum changes before its CAS upgrade', async (t) => {
  const migrationsDirectory = await migrationDirectory()
  t.after(() => fs.rm(migrationsDirectory, { recursive: true, force: true }))
  const client = fakeMigrationClient()
  for (const [index, filename] of DEPLOY_MIGRATION_FILES.entries()) {
    const sql = `SELECT ${index + 1};\n`
    client.applied.set(filename, migrationChecksum(sql))
  }
  const legacyFilename = DEPLOY_MIGRATION_FILES[0]
  client.applied.set(legacyFilename, legacyMigrationChecksum('SELECT 1;\n'))

  const query = client.query.bind(client)
  let injectedRace = false
  client.query = async (sql, params = []) => {
    const text = String(sql)
    if (!injectedRace && text.includes('UPDATE schema_migrations')) {
      injectedRace = true
      client.applied.set(legacyFilename, 'concurrent-checksum-change')
    }
    return query(sql, params)
  }

  await assert.rejects(
    runDeployMigrations(client, { migrationsDirectory, logger: { info() {} } }),
    (error) => error.code === 'DEPLOY_MIGRATION_CHECKSUM_MISMATCH',
  )
  assert.equal(injectedRace, true)
  assert.ok(client.calls.some(({ text, params }) => (
    text.includes('AND checksum = $3')
    && params[2] === legacyMigrationChecksum('SELECT 1;\n')
  )))
  assert.ok(client.calls.some(({ text }) => text.includes('pg_advisory_unlock')))
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
