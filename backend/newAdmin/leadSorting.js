import { inputError } from './common.js'

const fields = Object.freeze({
  name: null,
  inquiryDate: 'r.created_at',
  freeTrialDate: 'trial_history.first_trial_date',
  conversionDate: 'lead_metadata.converted_at',
})

export function leadOrderBy(query = {}) {
  const sortBy = query.sortBy || 'inquiryDate'
  if (!Object.hasOwn(fields, sortBy)) throw inputError('Invalid lead sort field.')
  const direction = String(query.sortDirection || (sortBy === 'name' ? 'asc' : 'desc')).toLowerCase()
  if (!['asc', 'desc'].includes(direction)) throw inputError('Invalid lead sort direction.')
  const order = direction.toUpperCase()
  const primary = sortBy === 'name'
    ? `NULLIF(lower(btrim(r.last_name)),'') ${order} NULLS LAST, NULLIF(lower(btrim(r.first_name)),'') ${order} NULLS LAST`
    : `${fields[sortBy]} ${order} NULLS LAST`
  return `${primary},r.id ${order}`
}
