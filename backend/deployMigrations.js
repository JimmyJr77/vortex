import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEPLOY_BILLING_MIGRATIONS,
  assertDeployBillingSchema,
} from './billing/billingSchemaReadiness.js'
import {
  DEPLOY_ACCESS_MIGRATIONS,
  assertDeployAccessSchema,
} from './platform/accessSchemaReadiness.js'

export const DEPLOY_MIGRATION_FILES = Object.freeze([
  ...DEPLOY_BILLING_MIGRATIONS,
  ...DEPLOY_ACCESS_MIGRATIONS,
])
export const DEPLOY_MIGRATION_LOCK_ID = 884679201

// A small number of billing migrations were edited in place before immutable
// follow-up migrations became the rule. Some databases therefore recorded a
// checksum for one of those exact, source-controlled historical files. Keep
// this compatibility inventory filename-scoped and pin the canonical file
// digest that may activate it: an unknown source checksum or a changed current
// file must still fail closed. Numeric variants normalize to their own exact
// historical SHA-256, preserving which migration bytes actually ran.
export const DEPLOY_MIGRATION_CHECKSUM_COMPATIBILITY = Object.freeze({
  '057_stripe_pending_enrollment.sql': Object.freeze({
    canonicalSha256: '5bab4f671953a4ba113d8a8b91f223b4e22f771b6467a78c502852fad0df52c4',
    historicalVariants: Object.freeze([
      // Added setup mode in ff8237d; superseded by migration 399.
      Object.freeze({
        legacyChecksum: '3788120324',
        sha256: 'edf084bb143c4365728ec6fbcd8c462b88698c86bf403129ef55a23669e7d1e4',
      }),
      // Added processing status in 92102b4; superseded by migration 400.
      Object.freeze({
        legacyChecksum: '322505987',
        sha256: 'ee89aad175bcc427b090cb80145a1502d11621fe98a89869fb8917db8b35e8c9',
      }),
    ]),
  }),
  '058_billing_stripe_links.sql': Object.freeze({
    canonicalSha256: '95ed6eaa12aaa8067c9a30e9280d088e876a8f5f159b20e30dba6646109c4c08',
    historicalVariants: Object.freeze([
      // Added invoice idempotency in 8bf9bfd; superseded by migration 799.
      Object.freeze({
        legacyChecksum: '2266470195',
        sha256: '1f0635f80093c1beea17030b9cfc4a469fc58de19bc06069663cb23678ba8dab',
      }),
    ]),
  }),
  // The first production deployment recorded this exact access migration
  // before its deterministic duplicate-username cleanup was added. A
  // follow-up migration handles those existing databases; fresh databases run
  // the current file directly.
  '800_canonical_identity_access_context.sql': Object.freeze({
    canonicalSha256: 'c17fc3e298b3e6bd51ea5e180cd0843733a7c973335a28e41b71e0563e8466f8',
    historicalVariants: Object.freeze([
      Object.freeze({
        legacyChecksum: '2766698630',
        sha256: '1f99fc49e2227e55f914c6dea3fa59932e6bcb402817fd05dbacf864367e7aa9',
      }),
    ]),
  }),
  // The original 802 deployment retired defaults but still left the retired
  // columns required. Migration 804 repairs that historical contract for
  // existing databases; fresh databases run the current 802 directly.
  '802_retire_legacy_member_status_derivation.sql': Object.freeze({
    canonicalSha256: 'e1ccb13419a5ea49f7532989e83c0ccce86501b3bbbad17213cd2410fbafda9c',
    historicalVariants: Object.freeze([
      Object.freeze({
        legacyChecksum: '3297345882',
        sha256: 'ac46f48d7e7ab47bf7e52c69822ffe79725755c826d7be072bc4aa9ef0c4932f',
      }),
    ]),
  }),
})

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

export function resolveHistoricalMigrationChecksumVariant(
  filename,
  canonicalChecksum,
  storedChecksum,
) {
  const compatibility = DEPLOY_MIGRATION_CHECKSUM_COMPATIBILITY[filename]
  if (!compatibility || compatibility.canonicalSha256 !== canonicalChecksum) return null
  const value = String(storedChecksum ?? '')
  const variant = compatibility.historicalVariants.find(({ legacyChecksum, sha256 }) => (
    value === legacyChecksum || value === sha256
  ))
  if (!variant) return null
  return {
    ...variant,
    storedFormat: value === variant.sha256 ? 'sha256' : 'legacy',
  }
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
    const storedChecksum = String(existing.checksum)
    const isCurrentLegacyChecksum = storedChecksum === legacyChecksum
    const historicalVariant = resolveHistoricalMigrationChecksumVariant(
      filename,
      checksum,
      storedChecksum,
    )
    if (historicalVariant?.storedFormat === 'sha256') {
      logger.info(`[migrate:deploy] accepted pinned historical SHA-256: ${filename}`)
      return 'skipped'
    }
    if (isCurrentLegacyChecksum || historicalVariant) {
      const upgradedChecksum = historicalVariant?.sha256 ?? checksum
      if (manageTransaction) await client.query('BEGIN')
      try {
        const upgraded = await client.query(
          `UPDATE schema_migrations
              SET checksum = $2
            WHERE filename = $1
              AND checksum = $3`,
          [filename, upgradedChecksum, storedChecksum],
        )
        if (upgraded.rowCount !== 1) {
          const race = new Error(`Deploy migration checksum changed while upgrading ${filename}`)
          race.code = 'DEPLOY_MIGRATION_CHECKSUM_MISMATCH'
          throw race
        }
        const verified = await client.query(
          `SELECT filename, checksum
             FROM schema_migrations
            WHERE filename = $1
            LIMIT 1`,
          [filename],
        )
        if (String(verified.rows[0]?.checksum ?? '') !== upgradedChecksum) {
          const race = new Error(`Deploy migration checksum changed while upgrading ${filename}`)
          race.code = 'DEPLOY_MIGRATION_CHECKSUM_MISMATCH'
          throw race
        }
        if (manageTransaction) await client.query('COMMIT')
      } catch (error) {
        if (manageTransaction) await client.query('ROLLBACK').catch(() => {})
        throw error
      }
      const checksumKind = historicalVariant ? 'historical legacy' : 'canonical legacy'
      logger.info(`${dryRun ? '[migrate:deploy:dry-run] would upgrade' : '[migrate:deploy] upgraded'} ${checksumKind} checksum to SHA-256: ${filename}`)
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
    const billingReadiness = await assertDeployBillingSchema(client)
    const accessReadiness = await assertDeployAccessSchema(client)
    const readiness = {
      ready: billingReadiness.ready && accessReadiness.ready,
      billing: billingReadiness,
      access: accessReadiness,
    }
    if (dryRun) {
      await client.query('ROLLBACK')
      dryRunTransactionOpen = false
    }
    return { applied, skipped, readiness, billingReadiness, accessReadiness, dryRun }
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
