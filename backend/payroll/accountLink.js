import jwt from 'jsonwebtoken'
import {createPayrollToken, hashPayrollToken, lockPayrollEmployeeSession, payrollEmployeeAuth} from './employeeAuth.js'

const fail = (message, status = 409) => Object.assign(new Error(message), {status})

async function accountIdentity(db, token, secret) {
  if (!secret) throw fail('Existing-account sign-in is not configured.', 503)
  let claims
  try { claims = jwt.verify(String(token || ''), secret, {algorithms: ['HS256']}) }
  catch { throw fail('Sign in to your existing Vortex account again.', 401) }
  if (!Number.isSafeInteger(Number(claims.userId)) || !claims.email) throw fail('Sign in to your existing Vortex account again.', 401)
  const user = (await db.query(`SELECT id,facility_id,email FROM app_user
    WHERE id=$1 AND is_active=TRUE AND lower(btrim(email))=lower(btrim($2)) FOR UPDATE`, [claims.userId, claims.email])).rows[0]
  if (!user) throw fail('Your existing Vortex account is no longer available. Sign in again.', 401)
  return user
}

export function registerPayrollAccountLink(app, pool, {jwtSecret, loadPortal}) {
  const auth = payrollEmployeeAuth(pool)
  app.get('/api/payroll/employee/account-link', auth, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    try {
      const link = (await pool.query(`SELECT linked_email AS email,created_at FROM payroll_employee_account_link
        WHERE employee_id=$1 AND facility_id=$2`, [req.payrollEmployee.employee_id, req.payrollEmployee.facility_id])).rows[0]
      res.json({success: true, data: {linked: Boolean(link), email: link?.email ?? null}})
    } catch { res.status(500).json({success: false, message: 'Unable to read account link.'}) }
  })

  app.post('/api/payroll/employee/account-link', auth, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      await lockPayrollEmployeeSession(db, req.payrollEmployee, req)
      if (req.body?.confirmed !== true) throw fail('Confirm linking this account to your payroll profile.', 400)
      const user = await accountIdentity(db, req.body.accountToken, jwtSecret)
      const {facility_id: facility, employee_id: employee} = req.payrollEmployee
      if (Number(user.facility_id) !== Number(facility)) throw fail('This account belongs to a different workplace.', 403)
      const prior = (await db.query('SELECT user_id FROM payroll_employee_account_link WHERE employee_id=$1', [employee])).rows[0]
      if (prior && Number(prior.user_id) !== Number(user.id)) throw fail('A different account is already linked. Contact your hiring admin.')
      if (!prior) {
        await db.query(`INSERT INTO payroll_employee_account_link(employee_id,facility_id,user_id,linked_email)
          VALUES($1,$2,$3,$4)`, [employee, facility, user.id, user.email])
        await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id)
          VALUES($1,$2,'EMPLOYEE_ACCOUNT_LINKED','employee',$3)`, [facility, user.id, String(employee)])
      }
      await db.query('COMMIT')
      res.json({success: true, data: {linked: true, email: user.email}})
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      res.status(error.code === '23505' ? 409 : error.status || 500).json({success: false,
        message: error.code === '23505' ? 'That account is already linked to another employee at this workplace.' : error.status ? error.message : 'Unable to link the account.'})
    } finally { db.release() }
  })

  app.post('/api/payroll/employee/account-session', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      const facility = Number(req.body?.facilityId)
      if (!Number.isSafeInteger(facility) || facility < 1) throw fail('Enter your workplace number.', 400)
      await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE', [facility])
      const user = await accountIdentity(db, req.body.accountToken, jwtSecret)
      if (Number(user.facility_id) !== facility) throw fail('This account is not linked to payroll at this workplace.', 403)
      const employee = (await db.query(`SELECT e.id FROM payroll_employee_account_link l
        JOIN payroll_employee e ON e.id=l.employee_id AND e.facility_id=l.facility_id
        WHERE l.facility_id=$1 AND l.user_id=$2 AND e.employment_status IN ('ONBOARDING','ACTIVE','LEAVE','TERMINATED') FOR UPDATE OF e`, [facility, user.id])).rows[0]
      if (!employee) throw fail('Open your hiring invitation first, then link this account in your payroll profile.', 403)
      const sessionToken = createPayrollToken()
      const session = (await db.query(`INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at)
        VALUES($1,$2,$3,now()+interval '30 days') RETURNING expires_at`, [facility, employee.id, hashPayrollToken(sessionToken)])).rows[0]
      await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id)
        VALUES($1,$2,'EMPLOYEE_ACCOUNT_SIGN_IN','employee',$3)`, [facility, user.id, String(employee.id)])
      const data = await loadPortal(db, facility, employee.id)
      await db.query('COMMIT')
      res.json({success: true, data: {...data, sessionToken, expiresAt: session.expires_at}})
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      res.status(error.status || 500).json({success: false, message: error.status ? error.message : 'Unable to sign in to payroll.'})
    } finally { db.release() }
  })
}
