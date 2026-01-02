// This script runs the Module 0 migration by importing server.js
// It uses the same database connection that server.js uses
import './server.js'

// The migration will run automatically when initDatabase() is called
// This script just needs to start the server briefly to trigger initDatabase
// Then exit after a few seconds

setTimeout(() => {
  console.log('\n✅ Migration should have completed. Check the logs above.')
  process.exit(0)
}, 5000)

