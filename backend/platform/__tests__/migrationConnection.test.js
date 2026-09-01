import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMigrationPoolConfig,
  resolveMigrationConnectionString,
} from '../../migrationConnection.js'

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

test('an explicit connection URL cannot be overridden by dotenv host fields', () => {
  assert.deepEqual(
    buildMigrationPoolConfig({
      connectionString: 'postgresql://postgres:test@127.0.0.1:5432/disposable',
      environment: {
        DB_HOST: 'production.example.com',
        DB_NAME: 'production',
        DB_USER: 'production_user',
      },
      ssl: false,
    }),
    {
      connectionString: 'postgresql://postgres:test@127.0.0.1:5432/disposable',
      ssl: false,
    },
  )
})

test('discrete local database fields remain available without a connection URL', () => {
  assert.deepEqual(
    buildMigrationPoolConfig({
      environment: {
        DB_HOST: 'postgres',
        DB_PORT: '5544',
        DB_NAME: 'vortex_test',
        DB_USER: 'test_user',
        DB_PASSWORD: 'test_password',
      },
      ssl: false,
    }),
    {
      host: 'postgres',
      port: 5544,
      database: 'vortex_test',
      user: 'test_user',
      password: 'test_password',
      ssl: false,
    },
  )
})
