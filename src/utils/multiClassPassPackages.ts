import { randomUUID } from './uuid'

export interface MultiClassPassPackage {
  id: string
  classCount: number
  priceCents: number
  enabled: boolean
  label: string
}

export function defaultMultiClassPassPackages(): MultiClassPassPackage[] {
  return []
}

export function normalizeMultiClassPassPackages(raw: unknown): MultiClassPassPackage[] {
  if (!Array.isArray(raw)) return []
  const out: MultiClassPassPackage[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const classCount = Math.max(1, Math.round(Number((item as MultiClassPassPackage).classCount) || 0))
    const priceCents = Math.max(0, Math.round(Number((item as MultiClassPassPackage).priceCents) || 0))
    const id = String((item as MultiClassPassPackage).id || randomUUID())
    const label =
      typeof (item as MultiClassPassPackage).label === 'string' &&
      (item as MultiClassPassPackage).label.trim()
        ? (item as MultiClassPassPackage).label.trim()
        : `${classCount}-Class Pass`
    out.push({
      id,
      classCount,
      priceCents,
      enabled: Boolean((item as MultiClassPassPackage).enabled),
      label,
    })
  }
  return out
}

export function enabledMultiClassPassPackages(packages: MultiClassPassPackage[]): MultiClassPassPackage[] {
  return packages.filter((p) => p.enabled && p.classCount > 0)
}

export function formatMultiClassPassSummary(packages: MultiClassPassPackage[]): string {
  const enabled = enabledMultiClassPassPackages(packages)
  if (enabled.length === 0) return '—'
  return enabled
    .slice(0, 3)
    .map((p) => `${p.label} ($${(p.priceCents / 100).toFixed(2)})`)
    .join(' · ')
}
