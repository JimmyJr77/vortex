import { isValidCalendarDate } from '../members/dateOnlyAge.js'
import { inputError } from './common.js'

export function inquiryInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw inputError('Invalid inquiry details.')
  const result = {}
  if (Object.hasOwn(value, 'athleteAge')) {
    const age = value.athleteAge == null || value.athleteAge === '' ? null : Number(value.athleteAge)
    if (age != null && (!Number.isInteger(age) || age < 0 || age > 120)) throw inputError('Enter a valid originally reported age.')
    result.athleteAge = age
  }
  if (Object.hasOwn(value, 'childAges')) {
    if (!Array.isArray(value.childAges) || value.childAges.length > 20 || value.childAges.some(age => !Number.isInteger(age) || age < 0 || age > 120)) throw inputError('Enter valid originally reported child ages.')
    result.childAges = value.childAges
  }
  for (const key of ['interests', 'classTypes']) {
    if (!Object.hasOwn(value, key)) continue
    const values = typeof value[key] === 'string' ? value[key].split(',') : value[key]
    if (!Array.isArray(values) || values.length > 40 || values.some(item => typeof item !== 'string' || item.length > 200)) throw inputError(`Invalid ${key}.`)
    result[key] = values.map(item => item.trim()).filter(Boolean)
  }
  for (const key of ['submitterRole', 'source', 'interest']) {
    if (!Object.hasOwn(value, key)) continue
    if (typeof value[key] !== 'string' || value[key].length > 500) throw inputError(`Invalid ${key}.`)
    result[key] = value[key].trim() || null
  }
  if (Object.hasOwn(value, 'campers')) {
    if (!Array.isArray(value.campers) || value.campers.length > 20) throw inputError('Enter at most 20 children.')
    result.campers = value.campers.map(child => {
      if (!child || typeof child !== 'object') throw inputError('Invalid child details.')
      const normalized = {}
      for (const key of ['firstName', 'lastName', 'dateOfBirth', 'gender']) {
        const text = String(child[key] ?? '').trim()
        if (text.length > 100) throw inputError('Child details are too long.')
        normalized[key] = text
      }
      if (normalized.dateOfBirth && (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.dateOfBirth) || !isValidCalendarDate(normalized.dateOfBirth) || normalized.dateOfBirth > new Date().toISOString().slice(0, 10))) throw inputError('Enter a valid birthday that is not in the future.')
      if (!['', 'male', 'female'].includes(normalized.gender)) throw inputError('Select male or female, or leave gender blank.')
      return normalized
    })
  }
  return result
}
