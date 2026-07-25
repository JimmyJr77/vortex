import fs from 'fs'

const migrationUrl = new URL('../migrations/247_marketing_visibility_hub.sql', import.meta.url)

export async function initMarketingTables(pool) {
  await pool.query(fs.readFileSync(migrationUrl, 'utf8'))
  console.log('✅ Marketing visibility tables initialized')
}
