import { createPayrollToken, hashPayrollToken, payrollEmployeeAuth } from './employeeAuth.js'

const ACTIVITIES = ['INSTRUCTION', 'PLANNING', 'SETUP', 'MEETING', 'ADMIN', 'OTHER']
const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max)
const activity = (value) => ACTIVITIES.includes(value) ? value : 'INSTRUCTION'

function publicEmployee(row) {
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    legalFirstName: row.legal_first_name,
    legalMiddleName: row.legal_middle_name || '',
    legalLastName: row.legal_last_name,
    preferredName: row.preferred_name || '',
    jobTitle: row.job_title,
    employmentStatus: row.employment_status,
    hourlyRateCents: row.hourly_rate_cents,
    hireDate: row.hire_date,
    primaryWorkLocation: row.primary_work_location || '',
    personalEmail: row.personal_email || '',
    phone: row.phone || '',
    w4Status: row.w4_status,
    stateWithholdingStatus: row.state_withholding_status,
    i9Status: row.i9_status,
    directDepositStatus: row.direct_deposit_status,
  }
}

async function employeePortalData(pool, facilityId, employeeId) {
  const [employeeResult, documentResult, shiftResult, timeResult, leaveResult, payStatementResult] = await Promise.all([
    pool.query('SELECT * FROM payroll_employee WHERE id=$1 AND facility_id=$2', [employeeId, facilityId]),
    pool.query(`SELECT document_type, status, completed_at, expires_on, notes
      FROM payroll_employee_document WHERE employee_id=$1 AND facility_id=$2 ORDER BY document_type`, [employeeId, facilityId]),
    pool.query(`SELECT id, scheduled_start, scheduled_end, activity_type, location, status, notes
      FROM payroll_shift WHERE employee_id=$1 AND facility_id=$2 AND scheduled_start >= now() - interval '7 days'
      ORDER BY scheduled_start LIMIT 90`, [employeeId, facilityId]),
    pool.query(`SELECT id, clock_in, clock_out, unpaid_break_minutes, activity_type, source, status,
        evidence_note, employee_attested_at,
        CASE WHEN clock_out IS NULL THEN NULL ELSE GREATEST(0, ROUND(EXTRACT(EPOCH FROM (clock_out-clock_in))/60)::int-unpaid_break_minutes) END AS worked_minutes
      FROM payroll_time_entry WHERE employee_id=$1 AND facility_id=$2 AND clock_in >= now() - interval '90 days'
      ORDER BY clock_in DESC LIMIT 180`, [employeeId, facilityId]),
    pool.query(`SELECT COALESCE(SUM(minutes),0)::int AS balance_minutes
      FROM payroll_leave_transaction WHERE employee_id=$1 AND facility_id=$2 AND leave_type='MD_SICK_SAFE'`, [employeeId, facilityId]),
    pool.query(`SELECT re.*, p.period_start,p.period_end,p.pay_date,
        ps.legal_business_name,ps.business_address,ps.ein_last4
      FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id
      JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_settings ps ON ps.facility_id=r.facility_id
      WHERE re.employee_id=$1 AND r.facility_id=$2 AND r.status='FINALIZED'
      ORDER BY p.pay_date DESC LIMIT 36`, [employeeId, facilityId]),
  ])
  return {
    employee: publicEmployee(employeeResult.rows[0]),
    documents: documentResult.rows,
    shifts: shiftResult.rows,
    timeEntries: timeResult.rows,
    sickLeaveBalanceMinutes: leaveResult.rows[0].balance_minutes,
    payStatements: payStatementResult.rows,
    onboardingMaterials: [
      { key: 'W4', label: 'Federal Form W-4', url: 'https://www.irs.gov/pub/irs-pdf/fw4.pdf' },
      { key: 'I9', label: 'USCIS Form I-9 and instructions', url: 'https://www.uscis.gov/i-9' },
      { key: 'STATE_WITHHOLDING', label: 'Maryland Form MW507', url: 'https://www.marylandcomptroller.gov/forms/current_forms/MW507.pdf' },
      { key: 'MD_SICK_SAFE', label: 'Maryland sick and safe leave', url: 'https://labor.maryland.gov/paidleave/' },
    ],
  }
}

export function registerPayrollEmployeeRoutes(app, pool) {
  const auth = payrollEmployeeAuth(pool)

  app.post('/api/payroll/employee/invitations/redeem', async (req, res) => {
    const raw = clean(req.body?.token, 200)
    if (!raw) return res.status(400).json({ success: false, message: 'Invitation token is required.' })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const invitationResult = await client.query(`SELECT i.*, e.employment_status
        FROM payroll_employee_invitation i JOIN payroll_employee e ON e.id=i.employee_id
        WHERE i.token_hash=$1 AND i.revoked_at IS NULL AND i.redeemed_at IS NULL
          AND i.expires_at > now() AND e.employment_status IN ('ONBOARDING','ACTIVE','LEAVE')
        FOR UPDATE OF i`, [hashPayrollToken(raw)])
      const invitation = invitationResult.rows[0]
      if (!invitation) {
        await client.query('ROLLBACK')
        return res.status(410).json({ success: false, message: 'This payroll invitation is invalid, expired, or already used.' })
      }
      const sessionToken = createPayrollToken()
      const sessionResult = await client.query(`INSERT INTO payroll_employee_session
        (facility_id,employee_id,token_hash,expires_at) VALUES ($1,$2,$3,now()+interval '30 days') RETURNING expires_at`, [invitation.facility_id, invitation.employee_id, hashPayrollToken(sessionToken)])
      await client.query('UPDATE payroll_employee_invitation SET redeemed_at=now() WHERE id=$1', [invitation.id])
      await client.query(`INSERT INTO payroll_audit_log (facility_id,action,entity_type,entity_id,after_data)
        VALUES ($1,'INVITATION_REDEEMED','employee_session',$2,$3)`, [invitation.facility_id, String(invitation.employee_id), { invitationId: invitation.id }])
      const data = await employeePortalData(client, invitation.facility_id, invitation.employee_id)
      await client.query('COMMIT')
      return res.json({ success: true, data: { ...data, sessionToken, expiresAt: sessionResult.rows[0].expires_at } })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      console.error('[payroll-employee] invitation redemption failed:', error)
      return res.status(500).json({ success: false, message: 'Unable to redeem payroll invitation.' })
    } finally { client.release() }
  })

  app.get('/api/payroll/employee/me', auth, async (req, res) => {
    try {
      const data = await employeePortalData(pool, req.payrollEmployee.facility_id, req.payrollEmployee.employee_id)
      res.json({ success: true, data })
    } catch (error) {
      console.error('[payroll-employee] portal load failed:', error)
      res.status(500).json({ success: false, message: 'Unable to load employee payroll portal.' })
    }
  })

  app.patch('/api/payroll/employee/profile', auth, async (req, res) => {
    try {
      const { rows } = await pool.query(`UPDATE payroll_employee SET preferred_name=$1, phone=$2, updated_at=now()
        WHERE id=$3 AND facility_id=$4 RETURNING *`, [clean(req.body?.preferredName, 120) || null, clean(req.body?.phone, 40) || null, req.payrollEmployee.employee_id, req.payrollEmployee.facility_id])
      res.json({ success: true, data: publicEmployee(rows[0]) })
    } catch (error) {
      console.error('[payroll-employee] profile update failed:', error)
      res.status(500).json({ success: false, message: 'Unable to update profile.' })
    }
  })

  app.post('/api/payroll/employee/clock', auth, async (req, res) => {
    const action = req.body?.action
    if (!['IN', 'OUT'].includes(action)) return res.status(400).json({ success: false, message: 'IN or OUT action is required.' })
    const facilityId = req.payrollEmployee.facility_id
    const employeeId = req.payrollEmployee.employee_id
    try {
      if (action === 'IN') {
        const { rows } = await pool.query(`INSERT INTO payroll_time_entry
          (facility_id,employee_id,clock_in,activity_type,source,status,evidence_note)
          VALUES ($1,$2,now(),$3,'EMPLOYEE_CLOCK','UNVERIFIED','Employee self-service clock') RETURNING *`, [facilityId, employeeId, activity(req.body?.activityType)])
        await pool.query(`INSERT INTO payroll_audit_log (facility_id,action,entity_type,entity_id,after_data)
          VALUES ($1,'EMPLOYEE_CLOCK_IN','time_entry',$2,$3)`, [facilityId, String(rows[0].id), { employeeId }])
        return res.status(201).json({ success: true, data: rows[0] })
      }
      const { rows } = await pool.query(`UPDATE payroll_time_entry SET clock_out=now(), updated_at=now()
        WHERE id=(SELECT id FROM payroll_time_entry WHERE facility_id=$1 AND employee_id=$2 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1)
        RETURNING *`, [facilityId, employeeId])
      if (!rows[0]) return res.status(409).json({ success: false, message: 'No open clock entry exists.' })
      await pool.query(`INSERT INTO payroll_audit_log (facility_id,action,entity_type,entity_id,after_data)
        VALUES ($1,'EMPLOYEE_CLOCK_OUT','time_entry',$2,$3)`, [facilityId, String(rows[0].id), { employeeId }])
      return res.json({ success: true, data: rows[0] })
    } catch (error) {
      if (error?.code === '23505') return res.status(409).json({ success: false, message: 'You are already clocked in.' })
      console.error('[payroll-employee] clock action failed:', error)
      return res.status(500).json({ success: false, message: 'Unable to record clock action.' })
    }
  })

  app.post('/api/payroll/employee/time-entries/:id/attest', auth, async (req, res) => {
    if (req.body?.confirmed !== true) return res.status(400).json({ success: false, message: 'Explicit confirmation is required.' })
    try {
      const { rows } = await pool.query(`UPDATE payroll_time_entry SET status='EMPLOYEE_ATTESTED', employee_attested_at=now(), updated_at=now()
        WHERE id=$1 AND employee_id=$2 AND facility_id=$3 AND clock_out IS NOT NULL AND status='UNVERIFIED' RETURNING *`, [req.params.id, req.payrollEmployee.employee_id, req.payrollEmployee.facility_id])
      if (!rows[0]) return res.status(409).json({ success: false, message: 'Only your closed, unverified time entry can be attested.' })
      await pool.query(`INSERT INTO payroll_audit_log (facility_id,action,entity_type,entity_id,after_data)
        VALUES ($1,'EMPLOYEE_ATTESTED','time_entry',$2,$3)`, [req.payrollEmployee.facility_id, String(rows[0].id), { employeeId: req.payrollEmployee.employee_id }])
      res.json({ success: true, data: rows[0] })
    } catch (error) {
      console.error('[payroll-employee] attestation failed:', error)
      res.status(500).json({ success: false, message: 'Unable to attest time entry.' })
    }
  })

  app.post('/api/payroll/employee/logout', auth, async (req, res) => {
    try {
      await pool.query('UPDATE payroll_employee_session SET revoked_at=now() WHERE id=$1', [req.payrollEmployee.session_id])
      res.json({ success: true })
    } catch (error) {
      console.error('[payroll-employee] logout failed:', error)
      res.status(500).json({ success: false, message: 'Unable to end session.' })
    }
  })
}
