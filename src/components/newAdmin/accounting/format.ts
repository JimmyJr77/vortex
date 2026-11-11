import type { BillLine } from './types'

export function billCoveredCents(line: BillLine) {
  if (['historical', 'voided', 'credit'].includes(line.status)) return null
  return Math.max(0, line.amountCents - (line.remainingCents ?? line.openCents))
}

export function billDisplayStatus(line: BillLine) {
  if (billCoveredCents(line) == null) return line.status
  const remaining = line.remainingCents ?? line.openCents
  if (remaining === 0) return 'paid_or_credited'
  if (line.balancePeriod === 'upcoming') return 'upcoming'
  return remaining < line.amountCents ? 'partial' : 'open'
}

export const amount = (cents: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)

export function day(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function moment(value: string | null | undefined, timezone?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', ...(timezone ? { timeZone: timezone } : {}) }).format(date)
}

export const humanize = (value: string | null | undefined) => value ? value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase()) : '—'
