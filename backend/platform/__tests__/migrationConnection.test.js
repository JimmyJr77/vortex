import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveMigrationConnectionString } from '../../migrationConnection.js'

test('explicit migration connection wins over dotenv-loaded connection keys', () => {
  assert.equal(
    resolveMigrationConnectionString(
      {
        DB_URL: 'postgresql://disposable.example/vortex_disposable',
      },
      {
        DATABASE_URL: 'postgresql://external.example/vortex_external',
        EXTERNAL_DB_URL: 'postgresql://external.example/vortex_external_legacy',
        DB_URL: 'postgresql://disposable.example/vortex_disposable',
      },
    ),
    'postgresql://disposable.example/vortex_disposable',
  )
})

test('migration connection preserves key priority within each environment source', () => {
  assert.equal(
    resolveMigrationConnectionString(
      {
        DATABASE_URL: 'postgresql://explicit.example/database',
        DB_URL: 'postgresql://explicit.example/db',
      },
      {
        DATABASE_URL: 'postgresql://loaded.example/database',
      },
    ),
    'postgresql://explicit.example/database',
  )

  assert.equal(
    resolveMigrationConnectionString(
      {},
      {
        DATABASE_URL: 'postgresql://loaded.example/database',
        EXTERNAL_DB_URL: 'postgresql://loaded.example/external',
        DB_URL: 'postgresql://loaded.example/db',
      },
    ),
    'postgresql://loaded.example/database',
  )
})

test('migration connection returns null when no connection variable is configured', () => {
  assert.equal(resolveMigrationConnectionString({}, {}), null)
})
