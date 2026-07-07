#!/usr/bin/env node
/**
 * Refresh scripts/golden-prescription-scenario.json body from a saved requirements row.
 * Usage: DATABASE_URL=... node scripts/sync-golden-from-saved-requirements.mjs ["Test 3 - Reqs only"]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { loadSavedRequirementsBody, snapshotToPrescribeBody } from './needsEngineSnapshotToPrescribeBody.js'
import { requireDatabaseUrl } from './resolveDatabaseUrl.js'

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../backend/package.json'))
const pg = require('pg')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scenarioPath = path.join(__dirname, 'golden-prescription-scenario.json')
const savedName = process.argv[2] ?? 'Test 3 - Reqs only'

async function main() {
  const { connectionString } = requireDatabaseUrl()

  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    const loaded = await loadSavedRequirementsBody(pool, savedName)
    const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'))

    scenario.name = `Saved: ${loaded.savedName}`
    scenario.savedRequirementsName = loaded.savedName
    scenario.savedRequirementsId = loaded.savedId
    scenario.savedRequirementsUpdatedAt = loaded.savedUpdatedAt
    scenario.description = `Golden scenario synced from coaching.coach_needs_engine_requirements (“${loaded.savedName}”).`
    scenario.body = loaded.body
    scenario.snapshot = loaded.snapshot

    fs.writeFileSync(scenarioPath, `${JSON.stringify(scenario, null, 2)}\n`)
    console.log(`Updated ${scenarioPath} from "${loaded.savedName}" (id ${loaded.savedId}, updated ${loaded.savedUpdatedAt})`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
