import fs from 'node:fs/promises'
export async function installSharedAccountRecords(db) {
  await db.query(await fs.readFile(new URL('../../migrations/843_shared_account_records.sql', import.meta.url), 'utf8'))
}
