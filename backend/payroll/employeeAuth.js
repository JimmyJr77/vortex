import crypto from 'node:crypto'

export function createPayrollToken() {
  return crypto.randomBytes(32).toString('base64url')
}
export function hashPayrollToken(token) {
  return crypto.createHash('sha256').update(String(token ?? '')).digest('hex')
}

function bearerToken(req) {
  const header = String(req.headers?.authorization ?? '')
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

export function payrollEmployeeAuth(pool) {
  return async (req, res, next) => {
    const raw = bearerToken(req)
    if (!raw) return res.status(401).json({ success: false, message: 'Employee payroll session required.' })
    try {
      const { rows } = await pool.query(`SELECT s.id AS session_id, s.facility_id, s.employee_id,
          e.employment_status, e.legal_first_name, e.legal_last_name
        FROM payroll_employee_session s
        JOIN payroll_employee e ON e.id=s.employee_id AND e.facility_id=s.facility_id
        WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > now()
          AND e.employment_status IN ('ONBOARDING','ACTIVE','LEAVE')
        LIMIT 1`, [hashPayrollToken(raw)])
      if (!rows[0]) return res.status(401).json({ success: false, message: 'Employee payroll session is invalid or expired.' })
      req.payrollEmployee = rows[0]
      await pool.query('UPDATE payroll_employee_session SET last_used_at=now() WHERE id=$1', [rows[0].session_id])
      return next()
    } catch (error) {
      console.error('[payroll-employee] authentication failed:', error)
      return res.status(500).json({ success: false, message: 'Unable to verify employee payroll session.' })
    }
  }
}
