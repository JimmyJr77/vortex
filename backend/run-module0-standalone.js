// Standalone script to run Module 0 migration
// This imports and calls initDatabase from server.js without starting the server

process.env.RUN_MIGRATION_ONLY = 'true'

import { initDatabase } from './server.js'

async function runMigration() {
  try {
    console.log('\n🚀 Running Module 0 Migration...\n')
    await initDatabase()
    console.log('\n✅ Module 0 migration completed!\n')
    
    // Give a moment for any async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000))
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message)
    if (error.stack) {
      console.error('Stack:', error.stack)
    }
    process.exit(1)
  }
}

runMigration()

