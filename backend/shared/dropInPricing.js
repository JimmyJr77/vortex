export function calculateDropInPrice({ monthlyCents, annualMember, discountPercent = 0, isFree = false }) {
  const divisor = annualMember ? 4 : 3
  const baseCents = Math.max(0, Math.round(Number(monthlyCents || 0) / divisor))
  const safeDiscount = annualMember
    ? Math.min(100, Math.max(0, Number(discountPercent || 0)))
    : 0
  const discountCents = Math.round(baseCents * safeDiscount / 100)
  return {
    baseCents,
    discountPercent: safeDiscount,
    discountCents,
    totalCents: isFree ? 0 : Math.max(0, baseCents - discountCents),
  }
}
