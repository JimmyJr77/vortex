import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEPLOY_BILLING_MIGRATIONS,
  assertDeployBillingSchema,
} from './billing/billingSchemaReadiness.js'

export const DEPLOY_MIGRATION_FILES = DEPLOY_BILLING_MIGRATIONS
export const DEPLOY_MIGRATION_LOCK_ID = 884679201

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultMigrationsDirectory = path.join(moduleDirectory, 'migrations')

export function migrationChecksum(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex')
}

export function legacyMigrationChecksum(text) {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return String(hash)
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      checksum TEXT,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

async function applyMigration(client, {
  filename,
  migrationsDirectory,
  logger,
  manageTransaction = true,
  dryRun = false,
}) {
  const migrationPath = path.join(migrationsDirectory, filename)
  let sql
  try {
    sql = await fs.readFile(migrationPath, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') {
      const missing = new Error(`Required deploy migration is missing: ${filename}`)
      missing.code = 'DEPLOY_MIGRATION_MISSING'
      throw missing
    }
    throw error
  }

  const checksum = migrationChecksum(sql)
  const existingResult = await client.query(
    `SELECT filename, checksum
       FROM schema_migrations
      WHERE filename = $1
      LIMIT 1`,
    [filename],
  )
  const existing = existingResult.rows[0] ?? null
  if (existing?.checksum != null && String(existing.checksum) !== checksum) {
    const legacyChecksum = legacyMigrationChecksum(sql)
    if (String(existing.checksum) === legacyChecksum) {
      if (manageTransaction) await client.query('BEGIN')
      try {
        await client.query(
          `UPDATE schema_migrations
              SET checksum = $2
            WHERE filename = $1
              AND checksum = $3`,
          [filename, checksum, legacyChecksum],
        )
        const verified = await client.query(
          `SELECT filename, checksum
             FROM schema_migrations
            WHERE filename = $1
            LIMIT 1`,
          [filename],
        )
        if (String(verified.rows[0]?.checksum ?? '') !== checksum) {
          const race = new Error(`Deploy migration checksum changed while upgrading ${filename}`)
          race.code = 'DEPLOY_MIGRATION_CHECKSUM_MISMATCH'
          throw race
        }
        if (manageTransaction) await client.query('COMMIT')
      } catch (error) {
        if (manageTransaction) await client.query('ROLLBACK').catch(() => {})
        throw error
      }
      logger.info(`${dryRun ? '[migrate:deploy:dry-run] would upgrade' : '[migrate:deploy] upgraded'} legacy checksum: ${filename}`)
      return 'skipped'
    }
    const mismatch = new Error(
      `Deploy migration checksum mismatch for ${filename}: database=${existing.checksum}, file=${checksum}`,
    )
    mismatch.code = 'DEPLOY_MIGRATION_CHECKSUM_MISMATCH'
    throw mismatch
  }
  if (existing?.checksum != null) {
    logger.info(`[migrate:deploy] already applied: ${filename}`)
    return 'skipped'
  }

  if (manageTransaction) await client.query('BEGIN')
  try {
    await client.query(sql)
    if (existing) {
      await client.query(
        `UPDATE schema_migrations
            SET checksum = $2
          WHERE filename = $1`,
        [filename, checksum],
      )
    } else {
      await client.query(
        `INSERT INTO schema_migrations (filename, checksum)
         VALUES ($1, $2)`,
        [filename, checksum],
      )
    }
    if (manageTransaction) await client.query('COMMIT')
    logger.info(`${dryRun ? '[migrate:deploy:dry-run] would apply' : '[migrate:deploy] applied'}: ${filename}`)
    return 'applied'
  } catch (error) {
    if (manageTransaction) await client.query('ROLLBACK').catch(() => {})
    throw error
  }
}

export async function runDeployMigrations(client, {
  migrationsDirectory = defaultMigrationsDirectory,
  logger = console,
  dryRun = false,
} = {}) {
  const applied = []
  const skipped = []
  let lockAcquired = false
  let dryRunTransactionOpen = false
  try {
    await client.query('SELECT pg_advisory_lock($1)', [DEPLOY_MIGRATION_LOCK_ID])
    lockAcquired = true
    if (dryRun) {
      await client.query('BEGIN')
      dryRunTransactionOpen = true
    }
    await ensureMigrationTable(client)
    for (const filename of DEPLOY_MIGRATION_FILES) {
      const result = await applyMigration(client, {
        filename,
        migrationsDirectory,
        logger,
        manageTransaction: !dryRun,
        dryRun,
      })
      if (result === 'applied') applied.push(filename)
      else skipped.push(filename)
    }
    const readiness = await assertDeployBillingSchema(client)
    if (dryRun) {
      await client.query('ROLLBACK')
      dryRunTransactionOpen = false
    }
    return { applied, skipped, readiness, dryRun }
  } catch (error) {
    if (dryRunTransactionOpen) {
      await client.query('ROLLBACK').catch(() => {})
      dryRunTransactionOpen = false
    }
    throw error
  } finally {
    if (lockAcquired) {
      await client.query('SELECT pg_advisory_unlock($1)', [DEPLOY_MIGRATION_LOCK_ID]).catch(() => {})
    }
  }
}
