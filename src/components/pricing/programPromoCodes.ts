export function normalizeProgramPromoCodes(codes: unknown): string[] {
  if (!Array.isArray(codes)) return []
  return codes.map((code) => String(code).trim().toUpperCase()).filter(Boolean)
}
