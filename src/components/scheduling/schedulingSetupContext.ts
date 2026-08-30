export function formatSetupContextLine(parts: Array<string | null | undefined>): string {
  return parts.filter((part) => part != null && String(part).trim() !== '').join(' · ')
}
