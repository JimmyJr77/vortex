export function inputError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode })
}

export function id(value, label = 'ID') {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw inputError(`Invalid ${label}.`)
  return parsed
}

export function pagination(query = {}) {
  const page = query.page == null || query.page === '' ? 1 : id(query.page, 'page')
  const pageSize = query.pageSize == null || query.pageSize === '' ? 25 : Math.min(100, id(query.pageSize, 'page size'))
  if (page > 1000000) throw inputError('Page is too large.')
  return { page, pageSize, offset: (page - 1) * pageSize }
}

export function pageResult(rows, total, paging) {
  return { rows, total: Number(total), page: paging.page, pageSize: paging.pageSize,
    totalPages: Math.ceil(Number(total) / paging.pageSize) }
}

export function searchValue(value) {
  return `%${String(value ?? '').trim().slice(0, 200).replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
}

export const date = (value) => value == null ? null : (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10)

export function memberRow(row) {
  return { id: Number(row.id), firstName: row.first_name, lastName: row.last_name,
    email: row.email, phone: row.phone, dateOfBirth: date(row.date_of_birth), isActive: row.is_active,
    familyId: row.family_id == null ? null : Number(row.family_id),
    appUserId: row.app_user_id == null ? null : Number(row.app_user_id) }
}

export function handler(fn) {
  return async (req, res) => {
    try {
      const data = await fn(req, res)
      if (!res.headersSent) res.json({ success: true, data })
    } catch (error) {
      const status = error.code === '23505' ? 409 : Number(error.statusCode) || 500
      if (status >= 500) console.error('[new-admin]', error)
      res.status(status).json({ success: false, message: status === 409 && error.code === '23505'
        ? 'A record with this email already exists. Review and link the existing record explicitly.'
        : status >= 500 ? 'Unable to complete this request.' : error.message })
    }
  }
}
