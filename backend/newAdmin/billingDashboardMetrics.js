const amount = value => Number(value ?? 0)
const monthOffset = (today, offset) => new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + offset, 1)).toISOString().slice(0, 7)
const sum = (rows, key) => rows.reduce((total, row) => total + amount(row[key]), 0)

function dimensions(row, date) {
  const gender = String(row?.gender ?? '').trim().toLowerCase()
  const birth = String(row?.date_of_birth ?? '').slice(0, 10)
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(birth) && Number.isFinite(Date.parse(`${birth}T12:00:00Z`))
    && new Date(`${birth}T12:00:00Z`).toISOString().slice(0, 10) === birth && birth <= date
  const age = valid ? Number(date.slice(0, 4)) - Number(birth.slice(0, 4)) - (date.slice(5) < birth.slice(5) ? 1 : 0) : null
  return {
    class: row?.class_name || 'Unassigned',
    gender: /^(m|male|boy)$/.test(gender) ? 'Boys' : /^(f|female|girl)$/.test(gender) ? 'Girls' : 'Other / unspecified',
    age: age == null || age > 120 ? 'Unspecified' : `Age ${age}`,
  }
}

// Allocate integer cents exactly, preserving the cash total in every breakdown.
// Unsupported attribution stays unassigned instead of duplicating a family
// payment across every sibling or class.
function split(cents, weights) {
  const total = weights.reduce((value, row) => value + row.weight, 0)
  if (!total) return [{ cents, row: null }]
  const sign = Math.sign(cents), value = Math.abs(cents)
  const parts = weights.map((item, index) => {
    const raw = value * item.weight / total
    return { cents: Math.floor(raw), fraction: raw % 1, index, row: item.row }
  })
  let remainder = value - sum(parts, 'cents')
  for (const part of [...parts].sort((a, b) => b.fraction - a.fraction || a.index - b.index)) {
    if (remainder-- > 0) part.cents++
  }
  return parts.map(part => ({ cents: part.cents * sign, row: part.row }))
}

export function buildBillingDashboard({ today, payments = [], refunds = [], allocations = [], lines = [], accounts = [] }) {
  const quarterOffset = (Number(today.slice(5, 7)) - 1) % 3
  const historyLength = 13 + quarterOffset
  const historyMonths = Array.from({ length: historyLength }, (_, index) => ({ key: monthOffset(today, index - historyLength + 1), partial: index === historyLength - 1,
    receiptsCents: 0, refundsCents: 0, netCents: 0, breakdowns: { class: Object.create(null), gender: Object.create(null), age: Object.create(null) } }))
  const byMonth = new Map(historyMonths.map(row => [row.key, row]))
  const byPayment = new Map(payments.map(row => [String(row.id), row]))
  const byAllocation = new Map()
  for (const row of allocations) {
    if (amount(row.amount_cents) <= 0) continue
    const key = String(row.billing_payment_id), rows = byAllocation.get(key) ?? []
    rows.push({ row, weight: amount(row.amount_cents) }); byAllocation.set(key, rows)
  }
  const paymentWeights = payment => {
    if (!payment) return []
    const allocated = byAllocation.get(String(payment.id)) ?? []
    const remainder = amount(payment.amount_cents) - allocated.reduce((total, row) => total + row.weight, 0)
    return remainder > 0 ? [...allocated, { row: payment, weight: remainder }] : allocated
  }
  const record = (row, cents, kind, weights) => {
    const date = row.occurred_date
    if (!date || date > today) return
    const month = byMonth.get(date.slice(0, 7))
    if (!month) return
    month[kind === 'payment' ? 'receiptsCents' : 'refundsCents'] += Math.abs(cents)
    month.netCents += cents
    const parts = weights.length ? split(cents, weights) : [{ cents, row }]
    for (const part of parts) {
      for (const [group, label] of Object.entries(dimensions(part.row, date))) {
        month.breakdowns[group][label] = (month.breakdowns[group][label] ?? 0) + part.cents
      }
    }
  }
  for (const row of payments) record(row, amount(row.amount_cents), 'payment', paymentWeights(row))
  for (const row of refunds) {
    const weights = row.has_charge ? [{ row, weight: 1 }] : paymentWeights(byPayment.get(String(row.payment_id)))
    record(row, -amount(row.amount_cents), 'refund', weights)
  }
  // Keep the chart and rolling averages on their existing 12-month window while
  // retaining the extra one or two months needed for four complete quarters.
  const months = historyMonths.slice(-13)
  const completed = months.slice(0, 12), lastThree = completed.slice(-3)
  const quarters = Array.from({length:5}, (_, index) => {
    const offset = -12 - quarterOffset + index * 3
    const start = monthOffset(today, offset), end = monthOffset(today, index === 4 ? 0 : offset + 2)
    const rows = historyMonths.filter(row => row.key >= start && row.key <= end)
    return { start, end, partial: index === 4, receiptsCents: sum(rows, 'receiptsCents'),
      refundsCents: sum(rows, 'refundsCents'), netCents: sum(rows, 'netCents') }
  })
  const balances = new Map(accounts.map(row => [String(row.id), { accountId: Number(row.id), familyId: Number(row.family_id),
    familyName: row.family_name || `Family ${row.family_id}`, balanceCents: amount(row.balance_cents),
    overdueCents: 0, currentCents: 0, futureCents: 0, creditCents: Math.max(0, -amount(row.balance_cents)), lines: [] }]))
  for (const row of lines) balances.get(String(row.account_id))?.lines.push(row)
  for (const account of balances.values()) {
    // Account-level unapplied cash/credits reduce debt oldest first for display.
    // This is a projection only: it never creates an allocation or collects money.
    const open = sum(account.lines, 'open_cents')
    let credit = Math.max(0, open - Math.max(0, account.balanceCents))
    for (const row of account.lines.sort((a, b) => a.service_month.localeCompare(b.service_month) || Number(a.id) - Number(b.id))) {
      const applied = Math.min(credit, amount(row.open_cents)); credit -= applied
      const remaining = amount(row.open_cents) - applied
      const bucket = row.service_month < today.slice(0, 7) ? 'overdueCents' : row.service_month === today.slice(0, 7) ? 'currentCents' : 'futureCents'
      account[bucket] += remaining
    }
    delete account.lines
  }
  const rows = [...balances.values()]
  return { asOf: today, months, quarters, summary: {
    twelveMonthIncomeCents: sum(completed, 'netCents'), averageMonthlyIncomeCents: sum(completed, 'netCents') / 12,
    threeMonthIncomeCents: sum(lastThree, 'netCents'), threeMonthAverageCents: sum(lastThree, 'netCents') / 3,
    sixMonthAverageCents: sum(completed.slice(-6), 'netCents') / 6,
    nineMonthAverageCents: sum(completed.slice(-9), 'netCents') / 9,
    lastMonthIncomeCents: completed.at(-1).netCents,
  }, unpaid: rows.filter(row => row.overdueCents > 0 || row.currentCents > 0).sort((a, b) => b.overdueCents + b.currentCents - a.overdueCents - a.currentCents),
  credits: rows.filter(row => row.creditCents > 0).sort((a, b) => b.creditCents - a.creditCents),
  notes: [
    'Revenue is successful payments minus successful refunds, dated in the facility time zone. Quarterly cards show the previous four full calendar quarters and the current quarter to date. Monthly cards show the previous four completed months and the current month to date.',
    'Monthly averages use the previous 3, 6, 9 or 12 completed calendar months, including months with no recorded revenue as $0. The previous-12-month total excludes the current month. The graph shows the previous 12 months plus this month to date.',
    'Jackrabbit and Vortex transactions come from the shared account tables. Historical imports contribute to income; only the current billing ledger determines debt and available account credit.',
    'Class and student breakdowns follow recorded payment allocations. Refunds follow their linked charge or payment. Category views show revenue with recorded class or student details; All includes the full income total. Age is measured on the transaction date.',
    'Unpaid amounts use each charge’s service month (or billed month when absent), after payments and corrections. Unapplied account funds reduce the oldest remaining debt first for display. Future bills are excluded. Credits show the net credit balance after all recorded bills. Opening this dashboard does not collect or reallocate money.',
  ] }
}
