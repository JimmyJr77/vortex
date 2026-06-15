export function allocateFreeSlotsInScope(signups, { freeSlotsPerUser, maxFreeSlotsTotal }) {
  const freePerUser = Number(freeSlotsPerUser ?? 0)
  const globalCap =
    maxFreeSlotsTotal != null && maxFreeSlotsTotal !== '' ? Number(maxFreeSlotsTotal) : null

  const perMemberCount = new Map()
  let globalFreeUsed = 0
  const freeByMember = new Map()

  const sorted = [...signups].sort((a, b) => {
    const ta = new Date(a.createdAt ?? a.created_at).getTime()
    const tb = new Date(b.createdAt ?? b.created_at).getTime()
    if (ta !== tb) return ta - tb
    return Number(a.id) - Number(b.id)
  })

  for (const signup of sorted) {
    const memberId = Number(signup.memberId ?? signup.member_id)
    const memberCount = (perMemberCount.get(memberId) || 0) + 1
    perMemberCount.set(memberId, memberCount)

    const withinUser = freePerUser > 0 && memberCount <= freePerUser
    const withinGlobal = globalCap == null || globalFreeUsed < globalCap
    if (withinUser && withinGlobal) {
      globalFreeUsed += 1
      freeByMember.set(memberId, (freeByMember.get(memberId) || 0) + 1)
    }
  }

  return {
    freeByMember,
    globalFreeUsed,
    globalFreeRemaining: globalCap == null ? null : Math.max(0, globalCap - globalFreeUsed),
  }
}

export function countFreeSlotsForMember(freeByMember, memberId) {
  return freeByMember.get(Number(memberId)) ?? 0
}

export async function loadSignupsForPricingScope(db, formRow) {
  if (!formRow) return []

  const programsId = formRow.programs_id != null ? Number(formRow.programs_id) : null
  const overrides = Boolean(formRow.pricing_overrides_program)
  const formId = Number(formRow.id)

  if (!overrides && programsId != null) {
    const res = await db.query(
      `
      SELECT s.id, s.member_id, s.created_at
      FROM scheduling_signup s
      JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
      WHERE sf.programs_id = $1
        AND s.orphaned_at IS NULL
        AND s.status IN ('confirmed', 'waitlisted')
      ORDER BY s.created_at ASC, s.id ASC
      `,
      [programsId],
    )
    return res.rows.map((row) => ({
      id: Number(row.id),
      memberId: Number(row.member_id),
      createdAt: row.created_at,
    }))
  }

  const res = await db.query(
    `
    SELECT s.id, s.member_id, s.created_at
    FROM scheduling_signup s
    WHERE s.form_id = $1
      AND s.orphaned_at IS NULL
      AND s.status IN ('confirmed', 'waitlisted')
    ORDER BY s.created_at ASC, s.id ASC
    `,
    [formId],
  )
  return res.rows.map((row) => ({
    id: Number(row.id),
    memberId: Number(row.member_id),
    createdAt: row.created_at,
  }))
}

export async function countAllocatedFreeSlotsForMember(
  db,
  formRow,
  memberId,
  effectiveDbRow,
  { extraMemberSignups = 0 } = {},
) {
  if (!memberId || !formRow) return 0

  const signups = await loadSignupsForPricingScope(db, formRow)
  if (extraMemberSignups > 0) {
    const now = new Date()
    for (let i = 0; i < extraMemberSignups; i += 1) {
      signups.push({
        id: -(i + 1),
        memberId: Number(memberId),
        createdAt: now,
      })
    }
  }

  const { freeByMember } = allocateFreeSlotsInScope(signups, {
    freeSlotsPerUser: effectiveDbRow?.free_slots_per_user,
    maxFreeSlotsTotal: effectiveDbRow?.max_free_slots_total,
  })
  return countFreeSlotsForMember(freeByMember, memberId)
}
