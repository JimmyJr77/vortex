import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import { getStripeClient, stripeEnabled } from '../../billing/stripeBilling.js'
import { billingDateString } from '../../billing/canonicalBillingMigrationState.js'
import {
  assertBillingMigrationRunContract,
} from '../../billing/canonicalBillingMigrationRepository.js'
import { DEPLOY_BILLING_MIGRATIONS } from '../../billing/billingSchemaReadiness.js'
import {
  adoptCanonicalHouseholdBillingMigration,
  advanceCanonicalBillingMigration,
  auditCanonicalBillingMigration,
  prepareCanonicalBillingMigration,
  repairCanonicalBillingMigration,
  repairMissingCanonicalBillingAccounts,
  repairWaivedAnnualMembershipsCanonicalMigration,
  rollbackCanonicalBillingMigration,
  verifyCanonicalBillingMigration,
} from '../../billing/canonicalBillingMigration.js'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const backendDirectory = path.resolve(scriptDirectory, '..', '..')
const migrationsDirectory = path.join(backendDirectory, 'migrations')
dotenv.config({ path: path.join(backendDirectory, '.env.local') })
dotenv.config({ path: path.join(backendDirectory, '.env') })

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length) ?? null
}

export function accountScope(command, apply) {
  const all = process.argv.includes('--all') || option('account') === 'all' || option('accounts') === 'all' || option('account-ids') === 'all'
  const valuesFor = (names) => process.argv.flatMap((entry) => {
    const name = names.find((candidate) => entry.startsWith(`--${candidate}=`))
    if (!name) return []
    return entry.slice(name.length + 3).split(',').map((value) => value.trim()).filter(Boolean)
  })
  const accountValues = valuesFor(['account', 'accounts', 'account-ids']).filter((value) => value !== 'all')
  const familyValues = valuesFor(['family', 'family-id', 'families', 'family-ids'])
  const normalized = (values, label) => {
    const invalid = values.filter((value) => !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0)
    if (invalid.length > 0) throw new Error(`${label} must contain only positive integer IDs: ${invalid.join(', ')}.`)
    return [...new Set(values.map(Number))].sort((a, b) => a - b)
  }
  const accountIds = normalized(accountValues, 'Billing account scope')
  const familyIds = normalized(familyValues, 'Family scope')
  if (all) {
    if (accountIds.length > 0 || familyIds.length > 0) throw new Error('--all cannot be combined with explicit account or family IDs.')
    if (apply) throw new Error('--all --apply is forbidden; every mutation requires explicit billing account or family IDs.')
    if (!['audit', 'verify'].includes(command)) throw new Error('--all is supported only for a read-only audit or verify command.')
    return { all: true, accountIds: [], familyIds: [] }
  }
  if (accountIds.length > 0 && familyIds.length > 0) {
    throw new Error('Account IDs and family IDs cannot be mixed in one migration command.')
  }
  if (familyIds.length > 0 && command !== 'repair') {
    throw new Error('Explicit family IDs are supported only by the local billing-account provisioning repair.')
  }
  if (familyIds.length > 0 && option('run') != null) {
    throw new Error('Family account provisioning creates and returns its own immutable run; omit --run. Ordinary account repair still requires --run and --account-ids.')
  }
  if (accountIds.length === 0 && familyIds.length === 0) {
    throw new Error('At least one explicit --account-ids=<id,id> or repair --family-ids=<id,id> scope is required.')
  }
  return { all: false, accountIds, familyIds }
}

function positiveOption(name, { required = false } = {}) {
  const raw = option(name)
  if (raw == null && !required) return null
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`--${name} must be a positive integer.`)
  return value
}

function ssl(connectionString) {
  if (process.env.DATABASE_SSL === 'false') return false
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false }
  const hostname = new URL(String(connectionString)).hostname
  return /(?:^|\.)(?:render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com)$/i.test(hostname)
    ? { rejectUnauthorized: false }
    : false
}

export function migrationHasFailure(report, {
  allowReviewedManualForwardAdoption = false,
} = {}) {
  return report?.cohortStopped === true || (report?.accounts ?? []).some((account) => {
    if (account.state === 'error' || account.state === 'missing') return true
    if (account.eligible !== false) return false
    if (!allowReviewedManualForwardAdoption) return true
    const blocking = (account.exceptions ?? []).filter((issue) => (
      ['blocking', 'critical'].includes(String(issue?.severity ?? ''))
    ))
    return !(
      account.sourceCollectionMode === 'manual'
      && account.payerValidationStatus === 'verified'
      && account.parityStatus === 'matched'
      && blocking.length > 0
      && blocking.every((issue) => issue.code === 'manual_collection_requires_review')
    )
  })
}

export function resolveCanonicalDatabaseUrl(environment = process.env) {
  const candidates = ['EXTERNAL_DB_URL', 'DATABASE_URL', 'DB_URL']
    .map((name) => ({ name, value: String(environment[name] ?? '').trim() }))
    .filter((entry) => entry.value)
  if (candidates.length === 0) throw new Error('EXTERNAL_DB_URL, DATABASE_URL, or DB_URL is required.')
  if (new Set(candidates.map((entry) => entry.value)).size !== 1) {
    throw new Error(`Database URL variables disagree: ${candidates.map((entry) => entry.name).join(', ')}.`)
  }
  return candidates[0].value
}

async function targetMonthForRun(pool, runId) {
  const result = await pool.query(
    `SELECT target_month FROM billing_migration_run WHERE id = $1 LIMIT 1`,
    [runId],
  )
  const target = result.rows[0]?.target_month
  return billingDateString(target)
}

export async function computeBillingDeployManifestChecksum({
  directory = migrationsDirectory,
  filenames = DEPLOY_BILLING_MIGRATIONS,
} = {}) {
  const manifest = []
  for (const filename of filenames) {
    const contents = await fs.readFile(path.join(directory, filename))
    const checksum = crypto.createHash('sha256').update(contents).digest('hex')
    manifest.push(`${filename}\0${checksum}`)
  }
  return crypto.createHash('sha256').update(manifest.join('\n')).digest('hex')
}

export function billingMigrationReleaseVersion(environment = process.env, packageVersion = null) {
  const value = environment.BILLING_MIGRATION_RELEASE_VERSION
    || environment.RENDER_GIT_COMMIT
    || environment.GIT_COMMIT
    || environment.SOURCE_VERSION
    || environment.VERCEL_GIT_COMMIT_SHA
    || environment.npm_package_version
    || packageVersion
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    throw new Error('Apply migrations require BILLING_MIGRATION_RELEASE_VERSION or a deployment commit/version.')
  }
  return normalized
}

async function currentApplyProvenance(environment = process.env) {
  const packageDocument = await fs.readFile(path.join(backendDirectory, 'package.json'), 'utf8')
    .then((value) => JSON.parse(value))
  return {
    codeVersion: billingMigrationReleaseVersion(environment, packageDocument.version),
    manifestChecksum: await computeBillingDeployManifestChecksum(),
  }
}

async function migrationRunForCli(pool, runId) {
  return pool.query(
    `SELECT * FROM billing_migration_run WHERE id = $1 LIMIT 1`,
    [runId],
  ).then((result) => result.rows[0] ?? null)
}

export function requireTargetMonth(value) {
  const text = String(value ?? '')
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`
  if (!/^\d{4}-\d{2}-01$/.test(text)) {
    throw new Error('--target-month must use YYYY-MM or YYYY-MM-01.')
  }
  return text
}

export function assertMigrationTargetMonthPolicy(command, {
  apply = false,
  explicitTargetMonth = null,
} = {}) {
  if (command === 'repair-waived-memberships' && apply && explicitTargetMonth != null) {
    throw new Error(
      '--target-month is forbidden for applied waived-membership repair; '
      + 'the target month is derived from the immutable migration run.',
    )
  }
}

async function stripeFor(command, apply) {
  if (!stripeEnabled()) {
    if (apply || ['adopt', 'advance', 'verify', 'rollback'].includes(command)) {
      throw new Error(`${command} requires STRIPE_ENABLED=true and STRIPE_SECRET_KEY.`)
    }
    return null
  }
  return getStripeClient()
}

/** Shared dry-run-first entrypoint used by the canonical migration commands. */
export async function runCanonicalBillingMigrationCli(command) {
  const supported = new Set([
    'audit',
    'repair',
    'repair-waived-memberships',
    'prepare',
    'adopt',
    'advance',
    'verify',
    'rollback',
  ])
  if (!supported.has(command)) throw new Error(`Unsupported canonical billing migration command: ${command}.`)
  const apply = process.argv.includes('--apply')
  const forwardAdoptionBootstrap = process.argv.includes('--forward-adoption')
  if (forwardAdoptionBootstrap && command !== 'audit') {
    throw new Error('--forward-adoption is supported only by the audit command that creates its immutable run.')
  }
  if (
    forwardAdoptionBootstrap
    && !String(option('cohort') ?? '').startsWith('forward-adoption')
  ) {
    throw new Error('--forward-adoption requires --cohort=forward-adoption-....')
  }
  if (forwardAdoptionBootstrap && option('run') != null) {
    throw new Error('--forward-adoption creates its immutable audit run; omit --run and resume with the same idempotency key.')
  }
  if (process.argv.includes('--dry-run') && apply) throw new Error('Choose either --apply or --dry-run, not both.')
  if (apply && option('as-of')) throw new Error('--as-of is allowed only for a dry run.')
  const explicitTargetMonth = option('target-month')
  assertMigrationTargetMonthPolicy(command, { apply, explicitTargetMonth })
  const scope = accountScope(command, apply)
  const familyProvisioning = command === 'repair' && scope.familyIds.length > 0
  if (familyProvisioning && option('run') != null) {
    throw new Error('Family account provisioning creates and returns its own immutable run; omit --run. Ordinary account repair still requires --run and --account-ids.')
  }
  const dryRepairWithoutRun = !apply && ['repair', 'repair-waived-memberships'].includes(command)
  const runRequired = !familyProvisioning && command !== 'audit' && !dryRepairWithoutRun
  const runId = positiveOption('run', { required: runRequired })
  const connectionString = resolveCanonicalDatabaseUrl(process.env)
  const pool = new pg.Pool({ connectionString, ssl: ssl(connectionString) })
  let dryClient = null
  try {
    if (!apply) {
      dryClient = await pool.connect()
      await dryClient.query('BEGIN TRANSACTION READ ONLY')
      await dryClient.query("SET LOCAL statement_timeout = '60s'")
    }
    const db = dryClient ?? pool
    let accountIds = scope.accountIds
    if (scope.all && command === 'verify') {
      accountIds = await db.query(
        `SELECT family_billing_account_id
           FROM billing_account_migration
          WHERE billing_migration_run_id = $1
          ORDER BY family_billing_account_id`,
        [runId],
      ).then((result) => result.rows.map((row) => Number(row.family_billing_account_id)))
    }
    if (
      accountIds.length === 0
      && !familyProvisioning
      && !(scope.all && command === 'audit')
    ) {
      throw new Error('The requested scope contains no billing accounts.')
    }
    let targetMonth = explicitTargetMonth
    if (!targetMonth && runId) targetMonth = await targetMonthForRun(db, runId)
    if (['audit', 'repair', 'repair-waived-memberships'].includes(command)) {
      targetMonth = requireTargetMonth(targetMonth)
    }
    const now = option('as-of') ? new Date(option('as-of')) : new Date()
    if (Number.isNaN(now.getTime())) throw new Error('--as-of must be a valid ISO timestamp.')
    const stripe = familyProvisioning ? null : await stripeFor(command, apply)
    const provenance = apply ? await currentApplyProvenance(process.env) : null
    if (apply && runId != null) {
      const run = await migrationRunForCli(db, runId)
      assertBillingMigrationRunContract(run, {
        accountIds,
        requireRunning: true,
        requireExactAccountScope: command === 'repair-waived-memberships',
        codeVersion: provenance.codeVersion,
        manifestChecksum: provenance.manifestChecksum,
      })
    }
    let report
    if (command === 'audit') {
      report = await auditCanonicalBillingMigration(db, {
        accountIds,
        includeAllActiveFamilies: scope.all,
        targetMonth,
        stripe,
        now,
        apply,
        runId,
        idempotencyKey: option('idempotency-key'),
        codeVersion: provenance?.codeVersion ?? null,
        manifestChecksum: provenance?.manifestChecksum ?? null,
        cohort: option('cohort') || 'manual',
        forwardAdoption: forwardAdoptionBootstrap,
      })
    } else if (familyProvisioning) {
      report = await repairMissingCanonicalBillingAccounts(db, {
        familyIds: scope.familyIds,
        targetMonth,
        now,
        apply,
        idempotencyKey: option('idempotency-key'),
        codeVersion: provenance?.codeVersion ?? null,
        manifestChecksum: provenance?.manifestChecksum ?? null,
        cohort: option('cohort') || 'family-account-bootstrap',
      })
    } else if (command === 'repair') {
      report = await repairCanonicalBillingMigration(db, {
        runId,
        accountIds,
        targetMonth,
        stripe,
        now,
        apply,
      })
    } else if (command === 'repair-waived-memberships') {
      report = await repairWaivedAnnualMembershipsCanonicalMigration(db, {
        runId,
        accountIds,
        // Apply mode derives this only from the immutable run in the service.
        targetMonth: apply ? null : targetMonth,
        stripe,
        now,
        apply,
      })
    } else if (command === 'prepare') {
      report = await prepareCanonicalBillingMigration(db, { runId, accountIds, stripe, now, apply })
    } else if (command === 'adopt') {
      report = await adoptCanonicalHouseholdBillingMigration(db, {
        runId,
        accountIds,
        stripe,
        now,
        apply,
      })
    } else if (command === 'advance') {
      report = await advanceCanonicalBillingMigration(db, { runId, accountIds, stripe, now, apply })
    } else if (command === 'verify') {
      report = await verifyCanonicalBillingMigration(db, { runId, accountIds, stripe, now, apply })
    } else {
      report = await rollbackCanonicalBillingMigration(db, { runId, accountIds, stripe, apply })
    }
    if (dryClient) await dryClient.query('COMMIT')
    console.log(JSON.stringify(report, null, 2))
    if (apply && migrationHasFailure(report, {
      allowReviewedManualForwardAdoption: forwardAdoptionBootstrap,
    })) process.exitCode = 1
    if (!apply) console.error('Dry run only. Re-run with --apply after reviewing this report and enabling the required safety flags.')
    return report
  } catch (error) {
    if (dryClient) await dryClient.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    dryClient?.release()
    await pool.end()
  }
}

export function runAndReportCanonicalBillingMigration(command) {
  runCanonicalBillingMigrationCli(command).catch((error) => {
    console.error(`[billing:migration:${command}]`, error?.message ?? error)
    process.exitCode = 1
  })
}
