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
const formerActionAllowed=(method,path)=>method==='GET'||/\/(logout|access|payment-authorization|w2-electronic\/(?:proof|consent)|filing-identity\/review|requests|requests\/[^/]+\/cancel|(?:pay-rates|pay-schedule-notices|salary-changes|check-receipts)\/[^/]+\/acknowledge)$/.test(path)

// Call inside the write transaction. Middleware authorization may predate a
// rehire, logout, password reset or separation while the request waits on locks.
export async function lockPayrollEmployeeSession(db,session,{method='POST',path='' }={}){
 const fail=(message,status)=>Object.assign(new Error(message),{status})
 if(!session)throw fail('Employee payroll session required.',401)
 await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[session.facility_id])
 const employee=(await db.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[session.facility_id,session.employee_id])).rows[0]
 const current=(await db.query('SELECT id FROM payroll_employee_session WHERE id=$1 AND facility_id=$2 AND employee_id=$3 AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE',[session.session_id,session.facility_id,session.employee_id])).rows[0]
 if(!employee||!current)throw fail('Employee payroll session is invalid or expired. Sign in again.',401)
 if(employee.employment_status==='TERMINATED'&&!formerActionAllowed(method,path))throw fail('Former employees cannot change work or onboarding records.',403)
 return employee
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
          AND e.employment_status IN ('ONBOARDING','ACTIVE','LEAVE','TERMINATED')
        LIMIT 1`, [hashPayrollToken(raw)])
      if (!rows[0]) return res.status(401).json({ success: false, message: 'Employee payroll session is invalid or expired.' })
      if(rows[0].employment_status==='TERMINATED' && !formerActionAllowed(req.method,req.path))return res.status(403).json({success:false,message:'Former employees can access records, acknowledge pay notices, manage sign-in, and contact payroll. Work and onboarding changes are disabled.'})
      req.payrollEmployee = rows[0]
      await pool.query('UPDATE payroll_employee_session SET last_used_at=now() WHERE id=$1', [rows[0].session_id])
      return next()
    } catch (error) {
      console.error('[payroll-employee] authentication failed:', error)
      return res.status(500).json({ success: false, message: 'Unable to verify employee payroll session.' })
    }
  }
}
