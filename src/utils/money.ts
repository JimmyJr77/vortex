const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/** Format an integer number of cents as USD (e.g. 1234 -> "$12.34"). */
export function formatCents(cents: number | null | undefined): string {
  return USD.format((Number(cents) || 0) / 100)
}

/** Format a dollar amount as USD (e.g. 12.5 -> "$12.50"). */
export function formatDollars(amount: number | null | undefined): string {
  return USD.format(Number(amount) || 0)
}
