/** Local, display-only card details. Never calls the processor or changes billing. */
export async function loadWorkspacePaymentMethod(db, account, hasProjection) {
  const empty = { available: false, paymentMethod: null, syncedAt: null }
  if (!account.stripe_customer_id) return { ...empty, syncStatus: 'not_linked' }
  if (Number(account.stripe_customer_owner_count) !== 1) return { ...empty, syncStatus: 'failed' }
  if (!hasProjection) return { ...empty, syncStatus: 'pending' }
  const { rows } = await db.query(`SELECT synced_at,sync_status,customer_deleted,payment_method_brand,payment_method_last4
    FROM stripe_customer_projection WHERE family_billing_account_id=$1 AND stripe_customer_id=$2`, [account.id, account.stripe_customer_id])
  const row = rows[0]
  if (!row?.synced_at) return { ...empty, syncStatus: 'pending' }
  const syncedAt = new Date(row.synced_at).toISOString()
  return { ...empty, syncedAt,
    syncStatus: row.sync_status === 'failed' ? 'failed' : Date.now() - Date.parse(syncedAt) > 36 * 60 * 60 * 1000 ? 'stale' : 'current',
    paymentMethod: row.customer_deleted ? null : { brand: row.payment_method_brand, last4: row.payment_method_last4 } }
}
