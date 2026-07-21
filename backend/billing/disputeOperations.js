const CLOSED = new Set(['won', 'lost'])

function stripeId(value) { return typeof value === 'string' ? value : value?.id ?? null }

export async function syncDisputeCase(pool, dispute) {
  if (!dispute?.id) return null
  const chargeId = stripeId(dispute.charge)
  let accountId = null
  if (chargeId) {
    const mapped = await pool.query(
      `SELECT family_billing_account_id FROM billing_payment WHERE stripe_charge_id=$1 LIMIT 1`, [chargeId],
    ).catch(() => ({ rows: [] }))
    accountId = mapped.rows[0]?.family_billing_account_id ?? null
  }
  const dueBy = Number(dispute.evidence_details?.due_by || 0)
  const evidenceStatus = CLOSED.has(dispute.status) ? dispute.status : undefined
  const result = await pool.query(
    `INSERT INTO stripe_dispute_case
     (stripe_dispute_id,stripe_charge_id,family_billing_account_id,amount_cents,currency,reason,status,response_due_at,evidence_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,CASE WHEN $8>0 THEN to_timestamp($8) ELSE NULL END,COALESCE($9,'not_started'))
     ON CONFLICT (stripe_dispute_id) DO UPDATE SET
       stripe_charge_id=EXCLUDED.stripe_charge_id,
       family_billing_account_id=COALESCE(stripe_dispute_case.family_billing_account_id,EXCLUDED.family_billing_account_id),
       amount_cents=EXCLUDED.amount_cents,currency=EXCLUDED.currency,reason=EXCLUDED.reason,status=EXCLUDED.status,
       response_due_at=EXCLUDED.response_due_at,
       evidence_status=COALESCE($9,stripe_dispute_case.evidence_status),updated_at=now()
     RETURNING *`,
    [dispute.id, chargeId, accountId, Number(dispute.amount||0), dispute.currency||null, dispute.reason||null, dispute.status||'unknown', dueBy, evidenceStatus],
  )
  return result.rows[0]
}

export async function listDisputeCases(pool) {
  const result = await pool.query(
    `SELECT d.*,f.family_name FROM stripe_dispute_case d
     LEFT JOIN family_billing_account fba ON fba.id=d.family_billing_account_id
     LEFT JOIN family f ON f.id=fba.family_id
     ORDER BY CASE WHEN d.status IN ('won','lost') THEN 1 ELSE 0 END,d.response_due_at NULLS LAST,d.created_at DESC`,
  )
  return result.rows
}

export async function updateDisputeEvidence(pool,{id,evidenceStatus,evidenceNote,userId}) {
  if (!['not_started','collecting','ready','submitted'].includes(evidenceStatus)) throw new Error('Invalid evidence status.')
  if (!String(evidenceNote||'').trim()) throw new Error('An evidence note is required.')
  const result=await pool.query(
    `UPDATE stripe_dispute_case SET evidence_status=$2,evidence_note=$3,updated_by_user_id=$4,updated_at=now()
     WHERE id=$1 AND status NOT IN ('won','lost') RETURNING *`,
    [id,evidenceStatus,String(evidenceNote).trim(),userId],
  )
  if(!result.rows[0]) throw new Error('Open dispute case not found.')
  return result.rows[0]
}
