import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Reconcile money already received before preparing and collecting the ledger.
// Each worker retains its account locks, reservations and duplicate checks.
// A reconciliation failure stops collection; unresolved individual accounts
// are also quarantined by the recurring worker's account-level guards.
async function run(relativePath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL(relativePath, import.meta.url)), ...args], {
      stdio: 'inherit', env: process.env,
    })
    child.on('error', reject)
    child.on('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)))
  })
}

try {
  const reconciliation = await run('./runStripeReconciliation.js')
  if (reconciliation) {
    console.error(`[billing:daily] reconciliation stage exited with status ${reconciliation}; collection was not started.`)
    process.exitCode = reconciliation
  } else {
    const collection = await run('../scheduling/runRecurringCharges.js', ['--collect'])
    if (collection) {
      console.error(`[billing:daily] recurring collection stage exited with status ${collection}; review the quarantined account details above.`)
    }
    process.exitCode = collection
  }
} catch (error) {
  console.error('[billing:daily] failed:', error.message)
  process.exitCode = 1
}
