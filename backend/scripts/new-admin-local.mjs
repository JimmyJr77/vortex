import { spawn } from 'node:child_process'
import pg from 'pg'
import { backendDirectory, localDevelopmentConfig, localChildEnvironment } from '../newAdmin/localDevelopment.js'

const command = process.argv[2] || 'setup'
if (!['setup', 'reset', 'serve'].includes(command)) throw new Error('Use setup, reset, or serve.')
const config = localDevelopmentConfig()
const childEnvironment = localChildEnvironment(config)

async function run(script, args = []) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: backendDirectory, env: childEnvironment, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`)))
  })
}

if (command === 'serve') {
  await run('server.js')
} else {
  const adminUrl = new URL(config.connectionString)
  adminUrl.pathname = '/postgres'
  const admin = new pg.Client({ connectionString: adminUrl.toString(), ssl: false })
  await admin.connect()
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [config.database])
    // DROP DATABASE avoids exhausting PostgreSQL's relation lock table while
    // cascading through this application's many schemas. Deliberately omit
    // FORCE: stop the local server first, rather than terminating active work.
    if (exists.rowCount && command === 'reset') await admin.query(`DROP DATABASE "${config.database}"`)
    if (!exists.rowCount || command === 'reset') await admin.query(`CREATE DATABASE "${config.database}"`)
  } finally { await admin.end() }
  await run('run-migration.js', ['--local-admin'])
  await run('scripts/seed-new-admin-local.mjs')
  console.log(`Local New Admin is ready in ${config.database}. Run npm run new-admin:serve, then npm run new-admin:ui.`)
}
