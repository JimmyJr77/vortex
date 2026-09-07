import rateLimit from 'express-rate-limit'
import { createHash } from 'node:crypto'
import { isLlmConfigured, llmGenerateText } from '../platform/aiService.js'
import { buildPayrollPreview, calculateMarylandSickAccrualMinutes, calculateWorkedMinutes, generateSemimonthlyPeriods, workweekStartFor } from './payrollEngine.js'
import { createPayrollToken, hashPayrollToken } from './employeeAuth.js'
import { publicAppUrl } from '../email/publicAppUrl.js'
import { sendEmail } from '../email/sendEmail.js'

const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max)
const integer = (value) => Number.isInteger(Number(value)) ? Number(value) : null
const isoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? String(value) : null
const isoTimestamp = (value) => {
  const parsed = new Date(value)
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null
}
const allowed = (value, values, fallback) => values.includes(value) ? value : fallback
const PAYROLL_SOURCE_HOSTS = new Set(['irs.gov', 'www.irs.gov', 'dol.gov', 'www.dol.gov', 'uscis.gov', 'www.uscis.gov', 'ssa.gov', 'www.ssa.gov', 'labor.maryland.gov', 'www.labor.maryland.gov', 'paidleave.maryland.gov', 'www.paidleave.maryland.gov', 'marylandcomptroller.gov', 'www.marylandcomptroller.gov', 'services.marylandcomptroller.gov', 'mdnewhire.com', 'www.mdnewhire.com', 'wcc.state.md.us', 'www.wcc.state.md.us'])

function payrollError(res, error, message) {
  console.error(`[payroll] ${message}:`, error)
  return res.status(500).json({ success: false, message })
}

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function sendCsv(res, filename, rows) {
  const csv = csvText(rows)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(csv)
}

function csvText(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

function reviewableSourceUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && PAYROLL_SOURCE_HOSTS.has(url.hostname) ? url : null
  } catch { return null }
}

async function fetchOfficialText(sourceUrl) {
  let current = reviewableSourceUrl(sourceUrl)
  if (!current) throw new Error('Source host is not allowed')
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(12_000), headers: { 'User-Agent': 'VortexPayrollComplianceReview/1.0' } })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      const redirected = location ? reviewableSourceUrl(new URL(location, current).toString()) : null
      if (!redirected) throw new Error('Source redirected outside the official allowlist')
      current = redirected
      continue
    }
    if (!response.ok) throw new Error(`Official source returned ${response.status}`)
    const contentType = response.headers.get('content-type') ?? ''
    const contentLength = Number(response.headers.get('content-length') ?? 0)
    if (contentLength > 3_000_000) throw new Error('Official source exceeds the review size limit')
    if (contentType.includes('application/pdf')) {
      const bytes = Buffer.from(await response.arrayBuffer())
      return { url: current.toString(), text: '', hash: createHash('sha256').update(bytes).digest('hex') }
    }
    if (!contentType.includes('text/') && !contentType.includes('application/json')) throw new Error('Source format is not supported for automated review')
    const raw = (await response.text()).slice(0, 250_000)
    const text = raw.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return { url: current.toString(), text: text.slice(0, 60_000), hash: createHash('sha256').update(text).digest('hex') }
  }
  throw new Error('Too many official-source redirects')
}

export async function reviewPayrollComplianceSources(pool, facilityId, { taskId = null, checkedBy = null, limit = 10 } = {}) {
  const params = [facilityId]
  let filter = `status <> 'NOT_APPLICABLE' AND source_url IS NOT NULL AND (next_review_on IS NULL OR next_review_on <= CURRENT_DATE)`
  if (taskId) { params.push(taskId); filter = 'id=$2 AND source_url IS NOT NULL' }
  const { rows: tasks } = await pool.query(`SELECT * FROM payroll_compliance_task WHERE facility_id=$1 AND ${filter} ORDER BY next_review_on NULLS FIRST LIMIT ${Math.max(1, Math.min(25, Number(limit) || 10))}`, params)
  const reviews = []
  for (const task of tasks) {
    try {
      const source = await fetchOfficialText(task.source_url)
      const previous = await pool.query(`SELECT content_sha256 FROM payroll_compliance_source_review WHERE compliance_task_id=$1 AND content_sha256 IS NOT NULL ORDER BY checked_at DESC LIMIT 1`, [task.id])
      const priorHash = previous.rows[0]?.content_sha256
      const result = !priorHash ? 'BASELINE' : priorHash === source.hash ? 'NO_CHANGE' : 'REVIEW_REQUIRED'
      let summary = result === 'BASELINE' ? 'Baseline captured. A human must still verify the requirement.' : result === 'NO_CHANGE' ? 'The normalized official-source content is unchanged from the previous capture.' : 'The official-source content changed. Review the source before updating this task or any payroll rule.'
      if (result === 'REVIEW_REQUIRED' && isLlmConfigured()) {
        const aiSummary = await llmGenerateText({
          system: 'Compare an existing payroll compliance task to current text fetched from its official source. Identify only potentially material differences or missing details. Do not declare legal compliance, invent a requirement, calculate tax, or recommend silently changing software rules. Respond in at most 120 words and tell a human to verify the source.',
          prompt: `Stored task: ${JSON.stringify({ title: task.title, description: task.description, dueDate: task.due_date, jurisdiction: task.jurisdiction })}\nCurrent official-source text: ${source.text.slice(0, 18000)}`,
          maxTokens: 220,
        })
        if (aiSummary) summary = aiSummary
      }
      const inserted = await pool.query(`INSERT INTO payroll_compliance_source_review
        (facility_id,compliance_task_id,checked_url,content_sha256,result,advisory_summary,model_used,checked_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [facilityId, task.id, source.url, source.hash, result, summary, isLlmConfigured() ? 'configured-payroll-advisor' : null, checkedBy])
      reviews.push(inserted.rows[0])
      if (result === 'REVIEW_REQUIRED') await pool.query(`INSERT INTO payroll_alert (facility_id,dedupe_key,severity,title,message)
        VALUES ($1,$2,'CRITICAL',$3,$4) ON CONFLICT (facility_id,dedupe_key) DO UPDATE SET status='OPEN',message=EXCLUDED.message,created_at=now(),dismissed_at=NULL,dismissed_by=NULL`, [facilityId, `source-change-${task.id}-${source.hash}`, `Official payroll source changed: ${task.title}`, summary])
    } catch (sourceError) {
      const summary = `Could not check source: ${sourceError instanceof Error ? sourceError.message : 'unknown error'}`.slice(0, 500)
      const inserted = await pool.query(`INSERT INTO payroll_compliance_source_review
        (facility_id,compliance_task_id,checked_url,result,advisory_summary,checked_by)
        VALUES ($1,$2,$3,'FETCH_FAILED',$4,$5) RETURNING *`, [facilityId, task.id, task.source_url, summary, checkedBy])
      reviews.push(inserted.rows[0])
      await pool.query(`INSERT INTO payroll_alert (facility_id,dedupe_key,severity,title,message)
        VALUES ($1,$2,'WARNING',$3,$4) ON CONFLICT (facility_id,dedupe_key) DO UPDATE SET status='OPEN',message=EXCLUDED.message,created_at=now(),dismissed_at=NULL,dismissed_by=NULL`, [facilityId, `source-fetch-${task.id}-${new Date().toISOString().slice(0, 10)}`, `Payroll source check failed: ${task.title}`, summary])
    }
  }
  return reviews
}

async function audit(pool, req, action, entityType, entityId, beforeData, afterData) {
  await pool.query(
    `INSERT INTO payroll_audit_log
       (facility_id, actor_user_id, action, entity_type, entity_id, before_data, after_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [req.canonicalAccess.facilityId, req.adminId, action, entityType, String(entityId ?? ''), beforeData, afterData],
  )
}

function mapEmployee(row) {
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    legalFirstName: row.legal_first_name,
    legalMiddleName: row.legal_middle_name || '',
    legalLastName: row.legal_last_name,
    preferredName: row.preferred_name || '',
    jobTitle: row.job_title,
    employmentStatus: row.employment_status,
    workerClassification: row.worker_classification,
    overtimeClassification: row.overtime_classification,
    payType: row.pay_type,
    hourlyRateCents: row.hourly_rate_cents,
    annualSalaryCents: row.annual_salary_cents,
    hireDate: row.hire_date,
    workState: row.work_state,
    residenceState: row.residence_state,
    primaryWorkLocation: row.primary_work_location || '',
    personalEmail: row.personal_email || '',
    phone: row.phone || '',
    w4Status: row.w4_status,
    stateWithholdingStatus: row.state_withholding_status,
    i9Status: row.i9_status,
    directDepositStatus: row.direct_deposit_status,
    sickLeavePolicy: row.sick_leave_policy,
    notes: row.notes || '',
  }
}

function mapSettings(row) {
  return {
    legalBusinessName: row.legal_business_name,
    businessAddress: row.business_address || '',
    einLast4: row.ein_last4,
    einStatus: row.ein_status,
    workweekStartsOn: row.workweek_starts_on,
    payFrequency: row.pay_frequency,
    semimonthlyFirstDay: row.semimonthly_first_day,
    semimonthlySecondDay: row.semimonthly_second_day,
    timezone: row.timezone,
    stateCode: row.state_code,
    mdCrnStatus: row.md_crn_status,
    mdUiStatus: row.md_ui_status,
    workersCompStatus: row.workers_comp_status,
    payrollExecutionMode: row.payroll_execution_mode,
  }
}

async function dashboardData(pool, facilityId) {
  const [settingsResult, employeeResult, documentResult, historicalResult, shiftResult, timeResult, periodResult, runResult, runEmployeeResult, complianceResult, clockResult, sourceReviewResult, invitationResult, adjustmentResult, leaveResult, mappingResult, alertResult, exportResult] = await Promise.all([
    pool.query('SELECT * FROM payroll_settings WHERE facility_id=$1', [facilityId]),
    pool.query('SELECT * FROM payroll_employee WHERE facility_id=$1 ORDER BY employment_status, legal_last_name, legal_first_name', [facilityId]),
    pool.query(`SELECT d.* FROM payroll_employee_document d WHERE d.facility_id=$1 ORDER BY d.employee_id, d.document_type`, [facilityId]),
    pool.query(`SELECT h.*, e.legal_first_name, e.legal_last_name FROM payroll_historical_payment h JOIN payroll_employee e ON e.id=h.employee_id WHERE h.facility_id=$1 ORDER BY payment_date DESC`, [facilityId]),
    pool.query(`SELECT s.*, e.legal_first_name, e.legal_last_name FROM payroll_shift s JOIN payroll_employee e ON e.id=s.employee_id WHERE s.facility_id=$1 AND s.scheduled_start >= now() - interval '14 days' ORDER BY s.scheduled_start LIMIT 120`, [facilityId]),
    pool.query(`SELECT t.*, e.legal_first_name, e.legal_last_name, CASE WHEN t.clock_out IS NULL THEN NULL ELSE GREATEST(0, ROUND(EXTRACT(EPOCH FROM (t.clock_out-t.clock_in))/60)::int-t.unpaid_break_minutes) END AS worked_minutes FROM payroll_time_entry t JOIN payroll_employee e ON e.id=t.employee_id WHERE t.facility_id=$1 ORDER BY t.clock_in DESC LIMIT 180`, [facilityId]),
    pool.query(`SELECT * FROM payroll_pay_period WHERE facility_id=$1 ORDER BY pay_date DESC LIMIT 24`, [facilityId]),
    pool.query(`SELECT r.*, p.period_start, p.period_end, p.pay_date FROM payroll_run r LEFT JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 ORDER BY r.created_at DESC LIMIT 24`, [facilityId]),
    pool.query(`SELECT re.*, e.employee_number, e.legal_first_name, e.legal_last_name
      FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id
      JOIN payroll_employee e ON e.id=re.employee_id
      WHERE r.facility_id=$1 ORDER BY re.payroll_run_id DESC, e.legal_last_name`, [facilityId]),
    pool.query(`SELECT * FROM payroll_compliance_task WHERE facility_id=$1 ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END, due_date NULLS LAST`, [facilityId]),
    pool.query(`SELECT COUNT(*)::int AS count FROM payroll_time_entry WHERE facility_id=$1 AND clock_out IS NULL`, [facilityId]),
    pool.query(`SELECT DISTINCT ON (compliance_task_id) compliance_task_id, result, advisory_summary, checked_at
      FROM payroll_compliance_source_review WHERE facility_id=$1 ORDER BY compliance_task_id, checked_at DESC`, [facilityId]),
    pool.query(`SELECT DISTINCT ON (employee_id) id, employee_id, recipient_email, expires_at, sent_at, redeemed_at, revoked_at, created_at
      FROM payroll_employee_invitation WHERE facility_id=$1 ORDER BY employee_id, created_at DESC`, [facilityId]),
    pool.query(`SELECT a.*, e.legal_first_name, e.legal_last_name FROM payroll_recurring_adjustment a
      JOIN payroll_employee e ON e.id=a.employee_id WHERE a.facility_id=$1 ORDER BY a.status, a.active_from DESC`, [facilityId]),
    pool.query(`SELECT employee_id, leave_type, COALESCE(SUM(minutes),0)::int AS balance_minutes
      FROM payroll_leave_transaction WHERE facility_id=$1 GROUP BY employee_id, leave_type`, [facilityId]),
    pool.query('SELECT * FROM payroll_accounting_mapping WHERE facility_id=$1', [facilityId]),
    pool.query(`SELECT * FROM payroll_alert WHERE facility_id=$1 AND status='OPEN' ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END, created_at DESC LIMIT 40`, [facilityId]),
    pool.query(`SELECT * FROM payroll_export_log WHERE facility_id=$1 ORDER BY exported_at DESC LIMIT 40`, [facilityId]),
  ])
  const settings = settingsResult.rows[0] ? mapSettings(settingsResult.rows[0]) : null
  const employees = employeeResult.rows.map(mapEmployee)
  const tasks = complianceResult.rows.map((row) => ({
    id: row.id, employeeId: row.employee_id, taskKey: row.task_key, title: row.title,
    category: row.category, jurisdiction: row.jurisdiction, dueDate: row.due_date,
    status: row.status, severity: row.severity, description: row.description,
    sourceUrl: row.source_url, sourceAuthority: row.source_authority,
    lastVerifiedOn: row.last_verified_on, nextReviewOn: row.next_review_on,
    completionNote: row.completion_note || '', completedAt: row.completed_at,
  }))
  const required = tasks.filter((task) => task.status !== 'NOT_APPLICABLE')
  const complete = required.filter((task) => task.status === 'COMPLETE').length
  return {
    settings,
    employees,
    documents: documentResult.rows,
    historicalPayments: historicalResult.rows,
    shifts: shiftResult.rows,
    timeEntries: timeResult.rows,
    payPeriods: periodResult.rows,
    payrollRuns: runResult.rows,
    payrollRunEmployees: runEmployeeResult.rows,
    complianceTasks: tasks,
    sourceReviews: sourceReviewResult.rows,
    invitations: invitationResult.rows,
    adjustments: adjustmentResult.rows,
    leaveBalances: leaveResult.rows,
    accountingMapping: mappingResult.rows[0] ?? null,
    alerts: alertResult.rows,
    exportLogs: exportResult.rows,
    summary: {
      activeEmployees: employees.filter((item) => item.employmentStatus === 'ACTIVE').length,
      openCriticalTasks: tasks.filter((item) => item.severity === 'CRITICAL' && !['COMPLETE', 'NOT_APPLICABLE'].includes(item.status)).length,
      openClocks: clockResult.rows[0].count,
      setupScore: required.length ? Math.round((complete / required.length) * 100) : 0,
      historicalGrossCents: historicalResult.rows.reduce((sum, row) => sum + Number(row.gross_amount_cents), 0),
      unreconciledPayments: historicalResult.rows.filter((row) => row.reconciliation_status !== 'RECONCILED').length,
      sourcesDueForReview: tasks.filter((task) => task.nextReviewOn && new Date(task.nextReviewOn) <= new Date()).length,
    },
    aiEnabled: isLlmConfigured(),
  }
}

async function loadPreview(pool, facilityId, payPeriodId) {
  const [settingsResult, employeesResult, entriesResult, tasksResult, ytdResult, periodResult, adjustmentResult, leaveAccrualResult] = await Promise.all([
    pool.query('SELECT * FROM payroll_settings WHERE facility_id=$1', [facilityId]),
    pool.query(`SELECT * FROM payroll_employee WHERE facility_id=$1 AND employment_status='ACTIVE'`, [facilityId]),
    pool.query(`SELECT t.*,
        t.clock_in >= (p.period_start::timestamp AT TIME ZONE ps.timezone) AS in_period
      FROM payroll_time_entry t
      JOIN payroll_pay_period p ON p.id=$2 AND p.facility_id=$1
      JOIN payroll_settings ps ON ps.facility_id=p.facility_id
      WHERE t.facility_id=$1
        AND t.clock_in >= ((p.period_start - 6)::timestamp AT TIME ZONE ps.timezone)
        AND t.clock_in < ((p.period_end + 1)::timestamp AT TIME ZONE ps.timezone)
      ORDER BY t.clock_in`, [facilityId, payPeriodId]),
    pool.query(`SELECT * FROM payroll_compliance_task WHERE facility_id=$1`, [facilityId]),
    pool.query(`WITH target AS (SELECT pay_date FROM payroll_pay_period WHERE id=$2 AND facility_id=$1), wages AS (
        SELECT employee_id, gross_amount_cents AS amount FROM payroll_historical_payment
        WHERE facility_id=$1 AND EXTRACT(YEAR FROM payment_date)=EXTRACT(YEAR FROM (SELECT pay_date FROM target))
        UNION ALL
        SELECT re.employee_id, (re.regular_pay_cents+re.overtime_pay_cents+re.other_taxable_pay_cents) AS amount
        FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id JOIN payroll_pay_period p ON p.id=r.pay_period_id
        WHERE r.facility_id=$1 AND r.status='FINALIZED' AND EXTRACT(YEAR FROM p.pay_date)=EXTRACT(YEAR FROM (SELECT pay_date FROM target))
      ) SELECT employee_id, COALESCE(SUM(amount),0)::bigint AS ytd FROM wages GROUP BY employee_id`, [facilityId, payPeriodId]),
    pool.query('SELECT * FROM payroll_pay_period WHERE id=$1 AND facility_id=$2', [payPeriodId, facilityId]),
    pool.query(`SELECT a.* FROM payroll_recurring_adjustment a JOIN payroll_pay_period p ON p.id=$2 AND p.facility_id=$1
      WHERE a.facility_id=$1 AND a.status='ACTIVE' AND a.active_from <= p.period_end
        AND (a.active_to IS NULL OR a.active_to >= p.period_start) ORDER BY a.employee_id, a.id`, [facilityId, payPeriodId]),
    pool.query(`SELECT l.employee_id, COALESCE(SUM(l.minutes),0)::int AS accrued
      FROM payroll_leave_transaction l JOIN payroll_pay_period p ON p.id=$2 AND p.facility_id=$1
      WHERE l.facility_id=$1 AND l.minutes > 0 AND EXTRACT(YEAR FROM l.transaction_date)=EXTRACT(YEAR FROM p.pay_date)
      GROUP BY l.employee_id`, [facilityId, payPeriodId]),
  ])
  if (!periodResult.rows[0]) return null
  const settings = mapSettings(settingsResult.rows[0])
  const employees = employeesResult.rows.map(mapEmployee)
  const mappedEntries = entriesResult.rows.map((row) => ({
    id: row.id, employeeId: row.employee_id, clockIn: row.clock_in, clockOut: row.clock_out,
    unpaidBreakMinutes: row.unpaid_break_minutes, status: row.status, inPeriod: row.in_period,
  }))
  const entries = mappedEntries.filter((entry) => entry.inPeriod)
  const priorApprovedMinutesByEmployee = {}
  const priorCarryInWarnings = []
  for (const entry of mappedEntries.filter((item) => !item.inPeriod)) {
    if (!entry.clockOut || entry.status !== 'APPROVED') {
      priorCarryInWarnings.push({ code: 'PRIOR_WORKWEEK_TIME_UNVERIFIED', severity: 'critical', message: 'Time before this pay period falls in an overlapping workweek and is not approved.', blocking: true, employeeId: entry.employeeId })
      continue
    }
    const employeeWeeks = priorApprovedMinutesByEmployee[entry.employeeId] ?? {}
    const week = workweekStartFor(entry.clockIn, settings.workweekStartsOn)
    employeeWeeks[week] = Number(employeeWeeks[week] ?? 0) + calculateWorkedMinutes(entry.clockIn, entry.clockOut, entry.unpaidBreakMinutes)
    priorApprovedMinutesByEmployee[entry.employeeId] = employeeWeeks
  }
  const tasks = tasksResult.rows.map((row) => ({ taskKey: row.task_key, title: row.title, status: row.status, severity: row.severity }))
  const ytdByEmployee = Object.fromEntries(ytdResult.rows.map((row) => [row.employee_id, Number(row.ytd)]))
  const adjustments = adjustmentResult.rows.map((row) => ({ employeeId: row.employee_id, kind: row.kind, name: row.name, amountCents: Number(row.amount_cents), taxTreatmentVerified: row.tax_treatment_verified }))
  const yearAccruedByEmployee = Object.fromEntries(leaveAccrualResult.rows.map((row) => [row.employee_id, Number(row.accrued)]))
  const preview = buildPayrollPreview({ settings, employees, entries, complianceTasks: tasks, ytdByEmployee, priorApprovedMinutesByEmployee, adjustments })
  for (const employeePreview of preview.employees) {
    employeePreview.sickLeaveAccrualMinutes = calculateMarylandSickAccrualMinutes({
      workedMinutes: employeePreview.regularMinutes + employeePreview.overtimeMinutes,
      payFrequency: settings.payFrequency,
      yearAccruedMinutes: Number(yearAccruedByEmployee[employeePreview.employeeId] ?? 0),
    })
  }
  preview.warnings.push(...priorCarryInWarnings)
  preview.canApprove = preview.warnings.every((item) => !item.blocking)
  return { period: periodResult.rows[0], preview }
}

async function refreshPayrollRunTotals(client, runId, facilityId) {
  const totals = await client.query(`SELECT
      COALESCE(SUM(re.regular_pay_cents+re.overtime_pay_cents+re.other_taxable_pay_cents),0)::bigint AS gross,
      COALESCE(SUM(re.reimbursement_cents),0)::bigint AS reimbursements,
      COALESCE(SUM(re.other_deductions_cents),0)::bigint AS deductions,
      COALESCE(SUM(COALESCE(re.federal_income_tax_cents,0)+COALESCE(re.state_income_tax_cents,0)+re.social_security_tax_cents+re.medicare_tax_cents+re.additional_medicare_tax_cents),0)::bigint AS employee_taxes,
      CASE WHEN COUNT(*) FILTER (WHERE re.net_pay_cents IS NULL)>0 THEN NULL ELSE COALESCE(SUM(re.net_pay_cents),0)::bigint END AS net
    FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id
    WHERE re.payroll_run_id=$1 AND r.facility_id=$2`, [runId, facilityId])
  const row = totals.rows[0]
  const result = await client.query(`UPDATE payroll_run SET gross_pay_cents=$1,reimbursement_cents=$2,
    deduction_cents=$3,employee_tax_cents=$4,net_pay_cents=COALESCE($5,0),updated_at=now()
    WHERE id=$6 AND facility_id=$7 RETURNING *`, [row.gross, row.reimbursements, row.deductions, row.employee_taxes, row.net, runId, facilityId])
  return result.rows[0]
}

export function registerPayrollRoutes(app, pool) {
  const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: Number(process.env.PAYROLL_AI_HOURLY_LIMIT) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Payroll AI hourly limit reached. The rules dashboard remains available.' },
  })

  app.get('/api/admin/payroll/dashboard', async (req, res) => {
    try {
      res.json({ success: true, data: await dashboardData(pool, req.canonicalAccess.facilityId) })
    } catch (error) { payrollError(res, error, 'Unable to load payroll') }
  })

  app.post('/api/admin/payroll/employees', async (req, res) => {
    const body = req.body ?? {}
    const rate = integer(body.hourlyRateCents)
    if (!clean(body.legalFirstName, 120) || !clean(body.legalLastName, 120) || !isoDate(body.hireDate) || rate === null || rate < 0) {
      return res.status(400).json({ success: false, message: 'Legal name, hire date, and a valid hourly rate are required.' })
    }
    try {
      const { rows } = await pool.query(`
        INSERT INTO payroll_employee (
          facility_id, employee_number, legal_first_name, legal_middle_name, legal_last_name,
          preferred_name, job_title, employment_status, pay_type, hourly_rate_cents, hire_date,
          work_state, residence_state, primary_work_location, personal_email, phone, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'HOURLY',$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *
      `, [req.canonicalAccess.facilityId, clean(body.employeeNumber, 40), clean(body.legalFirstName, 120), clean(body.legalMiddleName, 120) || null, clean(body.legalLastName, 120), clean(body.preferredName, 120) || null, clean(body.jobTitle, 160) || 'Employee', allowed(body.employmentStatus, ['ONBOARDING', 'ACTIVE'], 'ONBOARDING'), rate, body.hireDate, clean(body.workState, 2).toUpperCase() || 'MD', clean(body.residenceState, 2).toUpperCase() || 'MD', clean(body.primaryWorkLocation, 500) || null, clean(body.personalEmail, 320).toLowerCase() || null, clean(body.phone, 40) || null, clean(body.notes, 3000) || null])
      await audit(pool, req, 'CREATE', 'employee', rows[0].id, null, rows[0])
      res.status(201).json({ success: true, data: mapEmployee(rows[0]) })
    } catch (error) { payrollError(res, error, 'Unable to create employee') }
  })

  app.patch('/api/admin/payroll/employees/:id', async (req, res) => {
    const body = req.body ?? {}
    try {
      const before = await pool.query('SELECT * FROM payroll_employee WHERE id=$1 AND facility_id=$2', [req.params.id, req.canonicalAccess.facilityId])
      if (!before.rows[0]) return res.status(404).json({ success: false, message: 'Employee not found' })
      const current = before.rows[0]
      const rate = body.hourlyRateCents === undefined ? current.hourly_rate_cents : integer(body.hourlyRateCents)
      if (rate === null || rate < 0) return res.status(400).json({ success: false, message: 'Hourly rate must be valid.' })
      const { rows } = await pool.query(`UPDATE payroll_employee SET
        preferred_name=$1, job_title=$2, employment_status=$3, hourly_rate_cents=$4,
        w4_status=$5, state_withholding_status=$6, i9_status=$7, direct_deposit_status=$8,
        primary_work_location=$9, personal_email=$10, phone=$11, notes=$12, updated_at=now()
        WHERE id=$13 AND facility_id=$14 RETURNING *`, [
        body.preferredName === undefined ? current.preferred_name : clean(body.preferredName, 120) || null,
        clean(body.jobTitle ?? current.job_title, 160),
        allowed(body.employmentStatus, ['ONBOARDING', 'ACTIVE', 'LEAVE', 'TERMINATED'], current.employment_status), rate,
        allowed(body.w4Status, ['MISSING', 'REQUESTED', 'COMPLETE'], current.w4_status),
        allowed(body.stateWithholdingStatus, ['MISSING', 'REQUESTED', 'COMPLETE'], current.state_withholding_status),
        allowed(body.i9Status, ['MISSING', 'SECTION_1', 'COMPLETE', 'REVERIFY'], current.i9_status),
        allowed(body.directDepositStatus, ['NOT_CONFIGURED', 'INVITED', 'ACTIVE'], current.direct_deposit_status),
        body.primaryWorkLocation === undefined ? current.primary_work_location : clean(body.primaryWorkLocation, 500) || null,
        body.personalEmail === undefined ? current.personal_email : clean(body.personalEmail, 320).toLowerCase() || null,
        body.phone === undefined ? current.phone : clean(body.phone, 40) || null,
        body.notes === undefined ? current.notes : clean(body.notes, 3000) || null,
        req.params.id, req.canonicalAccess.facilityId,
      ])
      await audit(pool, req, 'UPDATE', 'employee', rows[0].id, current, rows[0])
      res.json({ success: true, data: mapEmployee(rows[0]) })
    } catch (error) { payrollError(res, error, 'Unable to update employee') }
  })

  app.post('/api/admin/payroll/employees/:id/invitations', async (req, res) => {
    const employeeId = integer(req.params.id)
    if (!employeeId) return res.status(400).json({ success: false, message: 'Employee is required.' })
    const client = await pool.connect()
    try {
      const employeeResult = await client.query('SELECT * FROM payroll_employee WHERE id=$1 AND facility_id=$2', [employeeId, req.canonicalAccess.facilityId])
      const employee = employeeResult.rows[0]
      if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' })
      const recipientEmail = clean(req.body?.email ?? employee.personal_email, 320).toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) return res.status(400).json({ success: false, message: 'A valid employee email is required.' })
      const rawToken = createPayrollToken()
      await client.query('BEGIN')
      await client.query(`UPDATE payroll_employee_invitation SET revoked_at=now()
        WHERE employee_id=$1 AND facility_id=$2 AND redeemed_at IS NULL AND revoked_at IS NULL`, [employeeId, req.canonicalAccess.facilityId])
      await client.query('UPDATE payroll_employee SET personal_email=$1, updated_at=now() WHERE id=$2 AND facility_id=$3', [recipientEmail, employeeId, req.canonicalAccess.facilityId])
      const invitationResult = await client.query(`INSERT INTO payroll_employee_invitation
        (facility_id,employee_id,recipient_email,token_hash,expires_at,created_by)
        VALUES ($1,$2,$3,$4,now()+interval '7 days',$5) RETURNING *`, [req.canonicalAccess.facilityId, employeeId, recipientEmail, hashPayrollToken(rawToken), req.adminId])
      const inviteUrl = `${publicAppUrl()}/employee/payroll?invite=${encodeURIComponent(rawToken)}`
      let emailed = false
      let emailWarning = null
      if (req.body?.sendEmail === true) {
        try {
          const name = clean(employee.preferred_name || employee.legal_first_name, 120)
          await sendEmail({
            to: recipientEmail,
            subject: 'Complete your Vortex payroll onboarding',
            text: `Hello ${name},\n\nUse this one-time link within 7 days to open your Vortex payroll portal:\n${inviteUrl}\n\nThe portal lets you review onboarding materials, upcoming shifts, and your own time records. Do not email identity documents or banking information.\n`,
            html: `<p>Hello ${name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')},</p><p>Use this one-time link within 7 days to open your Vortex payroll portal:</p><p><a href="${inviteUrl}">Open payroll onboarding</a></p><p>The portal lets you review onboarding materials, upcoming shifts, and your own time records. Do not email identity documents or banking information.</p>`,
            category: 'payroll_employee_invitation',
            templateVersion: 'payroll_employee_invitation_v1',
            facilityId: req.canonicalAccess.facilityId,
            idempotencyKey: `payroll-invite-${invitationResult.rows[0].id}`,
            skipPolicy: true,
          })
          emailed = true
          await client.query('UPDATE payroll_employee_invitation SET sent_at=now() WHERE id=$1', [invitationResult.rows[0].id])
        } catch (emailError) {
          emailWarning = emailError instanceof Error ? emailError.message : 'Invitation email could not be sent.'
        }
      }
      await audit(client, req, 'CREATE', 'employee_invitation', invitationResult.rows[0].id, null, { employeeId, recipientEmail, emailed, expiresAt: invitationResult.rows[0].expires_at })
      await client.query('COMMIT')
      res.status(201).json({ success: true, data: { id: invitationResult.rows[0].id, employeeId, recipientEmail, inviteUrl, expiresAt: invitationResult.rows[0].expires_at, emailed, emailWarning } })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      if (error?.code === '23505') return res.status(409).json({ success: false, message: 'That email is already assigned to another employee.' })
      payrollError(res, error, 'Unable to create employee invitation')
    } finally { client.release() }
  })

  app.post('/api/admin/payroll/shifts', async (req, res) => {
    const body = req.body ?? {}
    const employeeId = integer(body.employeeId)
    const start = isoTimestamp(body.scheduledStart)
    const end = isoTimestamp(body.scheduledEnd)
    if (!employeeId || !start || !end || end <= start) return res.status(400).json({ success: false, message: 'Employee and valid shift times are required.' })
    try {
      const { rows } = await pool.query(`INSERT INTO payroll_shift
        (facility_id, employee_id, scheduled_start, scheduled_end, activity_type, location, notes, created_by)
        SELECT $1,id,$3,$4,$5,$6,$7,$8 FROM payroll_employee WHERE id=$2 AND facility_id=$1 RETURNING *`, [req.canonicalAccess.facilityId, employeeId, start, end, allowed(body.activityType, ['INSTRUCTION', 'PLANNING', 'SETUP', 'MEETING', 'ADMIN', 'OTHER'], 'INSTRUCTION'), clean(body.location, 500) || null, clean(body.notes, 2000) || null, req.adminId])
      if (!rows[0]) return res.status(404).json({ success: false, message: 'Employee not found' })
      await audit(pool, req, 'CREATE', 'shift', rows[0].id, null, rows[0])
      res.status(201).json({ success: true, data: rows[0] })
    } catch (error) { payrollError(res, error, 'Unable to create shift') }
  })

  app.patch('/api/admin/payroll/shifts/:id', async (req, res) => {
    try {
      const before = await pool.query('SELECT * FROM payroll_shift WHERE id=$1 AND facility_id=$2', [req.params.id, req.canonicalAccess.facilityId])
      if (!before.rows[0]) return res.status(404).json({ success: false, message: 'Shift not found' })
      const current = before.rows[0]
      const start = req.body?.scheduledStart === undefined ? current.scheduled_start : isoTimestamp(req.body.scheduledStart)
      const end = req.body?.scheduledEnd === undefined ? current.scheduled_end : isoTimestamp(req.body.scheduledEnd)
      if (!start || !end || new Date(end) <= new Date(start)) return res.status(400).json({ success: false, message: 'Shift end must be after its start.' })
      const { rows } = await pool.query(`UPDATE payroll_shift SET scheduled_start=$1, scheduled_end=$2,
        activity_type=$3, location=$4, status=$5, notes=$6, updated_at=now()
        WHERE id=$7 AND facility_id=$8 RETURNING *`, [start, end,
        allowed(req.body?.activityType, ['INSTRUCTION', 'PLANNING', 'SETUP', 'MEETING', 'ADMIN', 'OTHER'], current.activity_type),
        req.body?.location === undefined ? current.location : clean(req.body.location, 500) || null,
        allowed(req.body?.status, ['SCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED'], current.status),
        req.body?.notes === undefined ? current.notes : clean(req.body.notes, 2000) || null,
        req.params.id, req.canonicalAccess.facilityId])
      await audit(pool, req, 'UPDATE', 'shift', rows[0].id, current, rows[0])
      res.json({ success: true, data: rows[0] })
    } catch (error) { payrollError(res, error, 'Unable to update shift') }
  })

  app.post('/api/admin/payroll/time-entries', async (req, res) => {
    const body = req.body ?? {}
    const employeeId = integer(body.employeeId)
    const clockIn = isoTimestamp(body.clockIn)
    const clockOut = isoTimestamp(body.clockOut)
    const breakMinutes = integer(body.unpaidBreakMinutes ?? 0)
    if (!employeeId || !clockIn || !clockOut || clockOut <= clockIn || breakMinutes === null || breakMinutes < 0) return res.status(400).json({ success: false, message: 'Employee, clock-in, clock-out, and valid break minutes are required.' })
    if (!clean(body.evidenceNote, 2000)) return res.status(400).json({ success: false, message: 'State the source of this time entry; do not reconstruct time without evidence.' })
    try {
      const { rows } = await pool.query(`INSERT INTO payroll_time_entry
        (facility_id, employee_id, clock_in, clock_out, unpaid_break_minutes, activity_type, source, status, evidence_note, created_by)
        SELECT $1,id,$3,$4,$5,$6,$7,'UNVERIFIED',$8,$9 FROM payroll_employee WHERE id=$2 AND facility_id=$1 RETURNING *`, [req.canonicalAccess.facilityId, employeeId, clockIn, clockOut, breakMinutes, allowed(body.activityType, ['INSTRUCTION', 'PLANNING', 'SETUP', 'MEETING', 'ADMIN', 'OTHER'], 'INSTRUCTION'), allowed(body.source, ['ADMIN', 'IMPORT', 'RECONSTRUCTION'], 'ADMIN'), clean(body.evidenceNote, 2000), req.adminId])
      if (!rows[0]) return res.status(404).json({ success: false, message: 'Employee not found' })
      await audit(pool, req, 'CREATE', 'time_entry', rows[0].id, null, rows[0])
      res.status(201).json({ success: true, data: rows[0] })
    } catch (error) { payrollError(res, error, 'Unable to create time entry') }
  })

  app.patch('/api/admin/payroll/time-entries/:id/status', async (req, res) => {
    const status = allowed(req.body?.status, ['UNVERIFIED', 'EMPLOYEE_ATTESTED', 'APPROVED', 'REJECTED'], null)
    if (!status) return res.status(400).json({ success: false, message: 'Invalid time-entry status.' })
    try {
      const before = await pool.query('SELECT * FROM payroll_time_entry WHERE id=$1 AND facility_id=$2', [req.params.id, req.canonicalAccess.facilityId])
      if (!before.rows[0]) return res.status(404).json({ success: false, message: 'Time entry not found' })
      const { rows } = await pool.query(`UPDATE payroll_time_entry SET status=$1,
        approved_by=CASE WHEN $1='APPROVED' THEN $2 ELSE NULL END,
        approved_at=CASE WHEN $1='APPROVED' THEN now() ELSE NULL END, updated_at=now()
        WHERE id=$3 AND facility_id=$4 RETURNING *`, [status, req.adminId, req.params.id, req.canonicalAccess.facilityId])
      await audit(pool, req, 'STATUS_CHANGE', 'time_entry', rows[0].id, before.rows[0], rows[0])
      res.json({ success: true, data: rows[0] })
    } catch (error) { payrollError(res, error, 'Unable to update time entry') }
  })

  app.post('/api/admin/payroll/clock', async (req, res) => {
    const employeeId = integer(req.body?.employeeId)
    const action = req.body?.action
    if (!employeeId || !['IN', 'OUT'].includes(action)) return res.status(400).json({ success: false, message: 'Employee and IN or OUT action are required.' })
    try {
      if (action === 'IN') {
        const { rows } = await pool.query(`INSERT INTO payroll_time_entry
          (facility_id, employee_id, clock_in, activity_type, source, status, evidence_note, created_by)
          SELECT $1,id,now(),$3,'EMPLOYEE_CLOCK','UNVERIFIED','Recorded by admin clock action',$4 FROM payroll_employee WHERE id=$2 AND facility_id=$1 RETURNING *`, [req.canonicalAccess.facilityId, employeeId, allowed(req.body?.activityType, ['INSTRUCTION', 'PLANNING', 'SETUP', 'MEETING', 'ADMIN', 'OTHER'], 'INSTRUCTION'), req.adminId])
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Employee not found' })
        await audit(pool, req, 'CLOCK_IN', 'time_entry', rows[0].id, null, rows[0])
        return res.status(201).json({ success: true, data: rows[0] })
      }
      const { rows } = await pool.query(`UPDATE payroll_time_entry SET clock_out=now(), updated_at=now()
        WHERE id=(SELECT id FROM payroll_time_entry WHERE facility_id=$1 AND employee_id=$2 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1)
        RETURNING *`, [req.canonicalAccess.facilityId, employeeId])
      if (!rows[0]) return res.status(409).json({ success: false, message: 'No open clock entry exists for this employee.' })
      await audit(pool, req, 'CLOCK_OUT', 'time_entry', rows[0].id, null, rows[0])
      return res.json({ success: true, data: rows[0] })
    } catch (error) {
      if (error?.code === '23505') return res.status(409).json({ success: false, message: 'This employee is already clocked in.' })
      payrollError(res, error, 'Unable to record clock action')
    }
  })

  app.post('/api/admin/payroll/employees/:id/adjustments', async (req, res) => {
    const employeeId = integer(req.params.id)
    const amountCents = integer(req.body?.amountCents)
    const kind = allowed(req.body?.kind, ['BONUS', 'REIMBURSEMENT', 'PRETAX_DEDUCTION', 'POSTTAX_DEDUCTION', 'GARNISHMENT'], null)
    const activeFrom = isoDate(req.body?.activeFrom)
    const authorizationReference = clean(req.body?.authorizationReference, 1000)
    const status = allowed(req.body?.status, ['DRAFT', 'ACTIVE'], 'DRAFT')
    if (!employeeId || !kind || !clean(req.body?.name, 160) || amountCents === null || amountCents < 0 || !activeFrom) return res.status(400).json({ success: false, message: 'Employee, adjustment type, name, amount, and start date are required.' })
    if (status === 'ACTIVE' && (!authorizationReference || req.body?.taxTreatmentVerified !== true)) return res.status(400).json({ success: false, message: 'Active adjustments require an authorization reference and verified tax treatment.' })
    try {
      const { rows } = await pool.query(`INSERT INTO payroll_recurring_adjustment
        (facility_id,employee_id,kind,name,amount_cents,active_from,active_to,status,authorization_reference,tax_treatment_verified,created_by)
        SELECT $1,id,$3,$4,$5,$6,$7,$8,$9,$10,$11 FROM payroll_employee WHERE id=$2 AND facility_id=$1 RETURNING *`, [req.canonicalAccess.facilityId, employeeId, kind, clean(req.body.name, 160), amountCents, activeFrom, isoDate(req.body?.activeTo), status, authorizationReference || null, req.body?.taxTreatmentVerified === true, req.adminId])
      if (!rows[0]) return res.status(404).json({ success: false, message: 'Employee not found' })
      await audit(pool, req, 'CREATE', 'payroll_adjustment', rows[0].id, null, rows[0])
      res.status(201).json({ success: true, data: rows[0] })
    } catch (error) { payrollError(res, error, 'Unable to create payroll adjustment') }
  })

  app.patch('/api/admin/payroll/adjustments/:id/status', async (req, res) => {
    const status = allowed(req.body?.status, ['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED'], null)
    if (!status) return res.status(400).json({ success: false, message: 'Invalid adjustment status.' })
    try {
      const before = await pool.query('SELECT * FROM payroll_recurring_adjustment WHERE id=$1 AND facility_id=$2', [req.params.id, req.canonicalAccess.facilityId])
      if (!before.rows[0]) return res.status(404).json({ success: false, message: 'Adjustment not found' })
      if (status === 'ACTIVE' && (!before.rows[0].authorization_reference || !before.rows[0].tax_treatment_verified)) return res.status(409).json({ success: false, message: 'Authorization and verified tax treatment are required before activation.' })
      const { rows } = await pool.query('UPDATE payroll_recurring_adjustment SET status=$1, updated_at=now() WHERE id=$2 AND facility_id=$3 RETURNING *', [status, req.params.id, req.canonicalAccess.facilityId])
      await audit(pool, req, 'STATUS_CHANGE', 'payroll_adjustment', rows[0].id, before.rows[0], rows[0])
      res.json({ success: true, data: rows[0] })
    } catch (error) { payrollError(res, error, 'Unable to update payroll adjustment') }
  })

  app.post('/api/admin/payroll/employees/:id/leave-transactions', async (req, res) => {
    const employeeId = integer(req.params.id)
    const minutes = integer(req.body?.minutes)
    const transactionDate = isoDate(req.body?.transactionDate)
    const reason = clean(req.body?.reason, 1000)
    if (!employeeId || !minutes || !transactionDate || !reason) return res.status(400).json({ success: false, message: 'Employee, non-zero minutes, date, and reason are required.' })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const employee = await client.query('SELECT id FROM payroll_employee WHERE id=$1 AND facility_id=$2 FOR UPDATE', [employeeId, req.canonicalAccess.facilityId])
      if (!employee.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Employee not found' }) }
      const balance = await client.query(`SELECT COALESCE(SUM(minutes),0)::int AS minutes FROM payroll_leave_transaction
        WHERE employee_id=$1 AND facility_id=$2 AND leave_type='MD_SICK_SAFE'`, [employeeId, req.canonicalAccess.facilityId])
      if (Number(balance.rows[0].minutes) + minutes < 0) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'Leave use cannot exceed the recorded balance.' }) }
      const { rows } = await client.query(`INSERT INTO payroll_leave_transaction
        (facility_id,employee_id,leave_type,transaction_date,minutes,reason,created_by)
        VALUES ($1,$2,'MD_SICK_SAFE',$3,$4,$5,$6) RETURNING *`, [req.canonicalAccess.facilityId, employeeId, transactionDate, minutes, reason, req.adminId])
      await audit(client, req, 'CREATE', 'leave_transaction', rows[0].id, null, rows[0])
      await client.query('COMMIT')
      res.status(201).json({ success: true, data: rows[0] })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      payrollError(res, error, 'Unable to create leave transaction')
    } finally { client.release() }
  })

  app.patch('/api/admin/payroll/compliance/:id', async (req, res) => {
    const status = allowed(req.body?.status, ['OPEN', 'IN_PROGRESS', 'COMPLETE', 'NOT_APPLICABLE'], null)
    if (!status) return res.status(400).json({ success: false, message: 'Invalid compliance status.' })
    if (status === 'COMPLETE' && !clean(req.body?.completionNote, 1000)) return res.status(400).json({ success: false, message: 'Add a completion note or confirmation reference.' })
    try {
      const before = await pool.query('SELECT * FROM payroll_compliance_task WHERE id=$1 AND facility_id=$2', [req.params.id, req.canonicalAccess.facilityId])
      if (!before.rows[0]) return res.status(404).json({ success: false, message: 'Compliance task not found' })
      const { rows } = await pool.query(`UPDATE payroll_compliance_task SET status=$1, completion_note=$2,
        completed_at=CASE WHEN $1='COMPLETE' THEN now() ELSE NULL END,
        completed_by=CASE WHEN $1='COMPLETE' THEN $3 ELSE NULL END, updated_at=now()
        WHERE id=$4 AND facility_id=$5 RETURNING *`, [status, clean(req.body?.completionNote, 1000) || null, req.adminId, req.params.id, req.canonicalAccess.facilityId])
      await audit(pool, req, 'STATUS_CHANGE', 'compliance_task', rows[0].id, before.rows[0], rows[0])
      res.json({ success: true, data: rows[0] })
    } catch (error) { payrollError(res, error, 'Unable to update compliance task') }
  })

  app.post('/api/admin/payroll/compliance/check-updates', aiLimiter, async (req, res) => {
    const taskId = integer(req.body?.taskId)
    try {
      const reviews = await reviewPayrollComplianceSources(pool, req.canonicalAccess.facilityId, { taskId, checkedBy: req.adminId })
      await audit(pool, req, 'SOURCE_REVIEW', 'compliance_task', taskId ?? 'due', null, { checked: reviews.length })
      res.json({ success: true, data: reviews })
    } catch (error) { payrollError(res, error, 'Unable to check official sources') }
  })

  app.post('/api/admin/payroll/pay-periods/generate', async (req, res) => {
    const year = integer(req.body?.year)
    const month = integer(req.body?.month)
    try {
      const settingsResult = await pool.query('SELECT * FROM payroll_settings WHERE facility_id=$1', [req.canonicalAccess.facilityId])
      const settings = settingsResult.rows[0]
      if (!settings) return res.status(409).json({ success: false, message: 'Payroll settings are missing.' })
      const periods = generateSemimonthlyPeriods(year, month, settings.semimonthly_first_day, settings.semimonthly_second_day)
      const inserted = []
      for (const period of periods) {
        const { rows } = await pool.query(`INSERT INTO payroll_pay_period (facility_id, period_start, period_end, pay_date, frequency)
          VALUES ($1,$2,$3,$4,$5) ON CONFLICT (facility_id,period_start,period_end) DO UPDATE SET pay_date=EXCLUDED.pay_date, updated_at=now() RETURNING *`, [req.canonicalAccess.facilityId, period.periodStart, period.periodEnd, period.payDate, period.frequency])
        inserted.push(rows[0])
      }
      await audit(pool, req, 'GENERATE', 'pay_period', `${year}-${month}`, null, inserted)
      res.status(201).json({ success: true, data: inserted })
    } catch (error) {
      if (error instanceof Error && error.message.includes('valid year')) return res.status(400).json({ success: false, message: error.message })
      payrollError(res, error, 'Unable to generate pay periods')
    }
  })

  app.post('/api/admin/payroll/runs/preview', async (req, res) => {
    const payPeriodId = integer(req.body?.payPeriodId)
    if (!payPeriodId) return res.status(400).json({ success: false, message: 'Pay period is required.' })
    try {
      const data = await loadPreview(pool, req.canonicalAccess.facilityId, payPeriodId)
      if (!data) return res.status(404).json({ success: false, message: 'Pay period not found' })
      res.json({ success: true, data })
    } catch (error) { payrollError(res, error, 'Unable to preview payroll') }
  })

  app.post('/api/admin/payroll/runs', async (req, res) => {
    const payPeriodId = integer(req.body?.payPeriodId)
    if (!payPeriodId) return res.status(400).json({ success: false, message: 'Pay period is required.' })
    const client = await pool.connect()
    try {
      const data = await loadPreview(client, req.canonicalAccess.facilityId, payPeriodId)
      if (!data) return res.status(404).json({ success: false, message: 'Pay period not found' })
      await client.query('BEGIN')
      const runResult = await client.query(`INSERT INTO payroll_run
        (facility_id,pay_period_id,gross_pay_cents,employee_tax_cents,employer_tax_cents,reimbursement_cents,deduction_cents,net_pay_cents,blocking_warnings,calculation_snapshot,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10) RETURNING *`, [req.canonicalAccess.facilityId, payPeriodId, data.preview.grossPayCents, data.preview.employeeTaxCents, data.preview.employerTaxCents, data.preview.reimbursementCents, data.preview.deductionCents, JSON.stringify(data.preview.warnings), JSON.stringify(data.preview), req.adminId])
      for (const item of data.preview.employees) {
        await client.query(`INSERT INTO payroll_run_employee
          (payroll_run_id,employee_id,hourly_rate_cents,regular_minutes,overtime_minutes,regular_pay_cents,overtime_pay_cents,other_taxable_pay_cents,reimbursement_cents,pretax_deduction_cents,posttax_deduction_cents,garnishment_cents,other_deductions_cents,federal_income_tax_cents,state_income_tax_cents,social_security_tax_cents,medicare_tax_cents,additional_medicare_tax_cents,sick_leave_accrual_minutes,net_pay_cents,warnings)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`, [runResult.rows[0].id, item.employeeId, item.hourlyRateCents, item.regularMinutes, item.overtimeMinutes, item.regularPayCents, item.overtimePayCents, item.otherTaxablePayCents, item.reimbursementCents, item.pretaxDeductionCents, item.posttaxDeductionCents, item.garnishmentCents, item.totalDeductionCents, item.federalIncomeTaxCents, item.stateIncomeTaxCents, item.socialSecurityTaxCents, item.medicareTaxCents, item.additionalMedicareTaxCents, item.sickLeaveAccrualMinutes, item.netPayCents, JSON.stringify(item.warnings)])
      }
      await audit(client, req, 'CREATE', 'payroll_run', runResult.rows[0].id, null, data.preview)
      await client.query('COMMIT')
      res.status(201).json({ success: true, data: runResult.rows[0] })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      payrollError(res, error, 'Unable to create payroll run')
    } finally { client.release() }
  })

  app.patch('/api/admin/payroll/runs/:id/status', async (req, res) => {
    const requested = allowed(req.body?.status, ['REVIEW', 'APPROVED', 'VOID'], null)
    if (!requested) return res.status(400).json({ success: false, message: 'Only REVIEW, APPROVED, or VOID are allowed.' })
    try {
      const before = await pool.query('SELECT * FROM payroll_run WHERE id=$1 AND facility_id=$2', [req.params.id, req.canonicalAccess.facilityId])
      if (!before.rows[0]) return res.status(404).json({ success: false, message: 'Payroll run not found' })
      const currentStatus = before.rows[0].status
      const transitionAllowed = requested === 'VOID' && ['DRAFT', 'REVIEW', 'APPROVED'].includes(currentStatus)
        || requested === 'REVIEW' && currentStatus === 'DRAFT'
        || requested === 'APPROVED' && currentStatus === 'REVIEW'
      if (!transitionAllowed) return res.status(409).json({ success: false, message: `Cannot move a ${currentStatus} run to ${requested}.` })
      const blockers = Array.isArray(before.rows[0].blocking_warnings) ? before.rows[0].blocking_warnings.filter((item) => item.blocking) : []
      if (requested === 'APPROVED' && blockers.length) return res.status(409).json({ success: false, message: 'Resolve all blocking warnings before approval.', data: { blockers } })
      const { rows } = await pool.query(`UPDATE payroll_run SET status=$1,
        reviewed_by=CASE WHEN $1='REVIEW' THEN $2 ELSE reviewed_by END,
        reviewed_at=CASE WHEN $1='REVIEW' THEN now() ELSE reviewed_at END,
        approved_by=CASE WHEN $1='APPROVED' THEN $2 ELSE approved_by END,
        approved_at=CASE WHEN $1='APPROVED' THEN now() ELSE approved_at END, updated_at=now()
        WHERE id=$3 AND facility_id=$4 RETURNING *`, [requested, req.adminId, req.params.id, req.canonicalAccess.facilityId])
      await audit(pool, req, 'STATUS_CHANGE', 'payroll_run', rows[0].id, before.rows[0], rows[0])
      res.json({ success: true, data: rows[0] })
    } catch (error) { payrollError(res, error, 'Unable to update payroll run') }
  })

  app.patch('/api/admin/payroll/runs/:runId/employees/:employeeId/withholding', async (req, res) => {
    const runId = integer(req.params.runId)
    const employeeId = integer(req.params.employeeId)
    const federalCents = integer(req.body?.federalIncomeTaxCents)
    const stateCents = integer(req.body?.stateIncomeTaxCents)
    const sourceNote = clean(req.body?.sourceNote, 2000)
    if (!runId || !employeeId || federalCents === null || federalCents < 0 || stateCents === null || stateCents < 0 || sourceNote.length < 12 || req.body?.professionalConfirmed !== true) {
      return res.status(400).json({ success: false, message: 'Non-negative federal/state amounts, a detailed source note, and professional confirmation are required.' })
    }
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const currentResult = await client.query(`SELECT re.*, r.status AS run_status, r.blocking_warnings,
          e.w4_status,e.state_withholding_status
        FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id
        JOIN payroll_employee e ON e.id=re.employee_id
        WHERE re.payroll_run_id=$1 AND re.employee_id=$2 AND r.facility_id=$3 FOR UPDATE OF re,r`, [runId, employeeId, req.canonicalAccess.facilityId])
      const current = currentResult.rows[0]
      if (!current) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Payroll run employee not found' }) }
      if (!['DRAFT', 'REVIEW'].includes(current.run_status)) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'Withholding can only be entered on a draft or review run.' }) }
      if (current.w4_status !== 'COMPLETE' || current.state_withholding_status !== 'COMPLETE') { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'W-4 and MW507 must be confirmed complete before entering withholding.' }) }
      const gross = Number(current.regular_pay_cents) + Number(current.overtime_pay_cents) + Number(current.other_taxable_pay_cents)
      const taxes = federalCents + stateCents + Number(current.social_security_tax_cents) + Number(current.medicare_tax_cents) + Number(current.additional_medicare_tax_cents)
      const deductions = Number(current.other_deductions_cents)
      const net = gross + Number(current.reimbursement_cents) - taxes - deductions
      if (net < 0) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'Taxes and deductions exceed available pay.' }) }
      const resolvable = new Set(['WITHHOLDING_ENGINE_NOT_CONFIGURED', 'MISSING_W4', 'MISSING_STATE_WITHHOLDING'])
      const employeeWarnings = (Array.isArray(current.warnings) ? current.warnings : []).filter((item) => !resolvable.has(item.code))
      const runWarnings = (Array.isArray(current.blocking_warnings) ? current.blocking_warnings : []).filter((item) => !(Number(item.employeeId) === employeeId && resolvable.has(item.code)))
      const updated = await client.query(`UPDATE payroll_run_employee SET federal_income_tax_cents=$1,state_income_tax_cents=$2,
        net_pay_cents=$3,withholding_source_note=$4,withholding_verified_by=$5,withholding_verified_at=now(),warnings=$6
        WHERE payroll_run_id=$7 AND employee_id=$8 RETURNING *`, [federalCents, stateCents, net, sourceNote, req.adminId, JSON.stringify(employeeWarnings), runId, employeeId])
      await client.query('UPDATE payroll_run SET blocking_warnings=$1,updated_at=now() WHERE id=$2 AND facility_id=$3', [JSON.stringify(runWarnings), runId, req.canonicalAccess.facilityId])
      const run = await refreshPayrollRunTotals(client, runId, req.canonicalAccess.facilityId)
      await audit(client, req, 'WITHHOLDING_VERIFIED', 'payroll_run_employee', updated.rows[0].id, current, { ...updated.rows[0], sourceNote: '[recorded]' })
      await client.query('COMMIT')
      res.json({ success: true, data: { employee: updated.rows[0], run } })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      payrollError(res, error, 'Unable to record verified withholding')
    } finally { client.release() }
  })

  app.post('/api/admin/payroll/runs/:id/finalize', async (req, res) => {
    const confirmation = clean(req.body?.paymentConfirmationReference, 500)
    if (confirmation.length < 4) return res.status(400).json({ success: false, message: 'External payment confirmation is required.' })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const runResult = await client.query(`SELECT r.*,p.pay_date FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
        WHERE r.id=$1 AND r.facility_id=$2 FOR UPDATE OF r`, [req.params.id, req.canonicalAccess.facilityId])
      const run = runResult.rows[0]
      if (!run) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Payroll run not found' }) }
      if (run.status !== 'APPROVED') { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'Only an approved run can be finalized.' }) }
      const employees = await client.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1 FOR UPDATE', [run.id])
      if (employees.rows.some((row) => row.net_pay_cents === null)) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'Every employee must have complete withholding and net pay.' }) }
      for (const row of employees.rows) {
        if (Number(row.sick_leave_accrual_minutes) <= 0) continue
        await client.query(`INSERT INTO payroll_leave_transaction
          (facility_id,employee_id,leave_type,transaction_date,minutes,reason,source_run_employee_id,created_by)
          VALUES ($1,$2,'MD_SICK_SAFE',$3,$4,'Automatic accrual from finalized payroll',$5,$6)
          ON CONFLICT (source_run_employee_id,leave_type) WHERE source_run_employee_id IS NOT NULL DO NOTHING`, [req.canonicalAccess.facilityId, row.employee_id, run.pay_date, row.sick_leave_accrual_minutes, row.id, req.adminId])
      }
      const updated = await client.query(`UPDATE payroll_run SET status='FINALIZED',finalized_at=now(),
        payment_confirmation_reference=$1,payment_recorded_by=$2,updated_at=now() WHERE id=$3 RETURNING *`, [confirmation, req.adminId, run.id])
      await client.query(`UPDATE payroll_pay_period SET status='PAID',updated_at=now() WHERE id=$1`, [run.pay_period_id])
      await audit(client, req, 'FINALIZE', 'payroll_run', run.id, run, { ...updated.rows[0], paymentConfirmationReference: '[recorded]' })
      await client.query('COMMIT')
      res.json({ success: true, data: updated.rows[0] })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      payrollError(res, error, 'Unable to finalize payroll run')
    } finally { client.release() }
  })

  app.patch('/api/admin/payroll/accounting-mapping', async (req, res) => {
    const body = req.body ?? {}
    const account = (key, fallback) => clean(body[key], 200) || fallback
    if (body.verifiedByBookkeeper !== true) return res.status(400).json({ success: false, message: 'Bookkeeper verification must be explicitly confirmed.' })
    try {
      const before = await pool.query('SELECT * FROM payroll_accounting_mapping WHERE facility_id=$1', [req.canonicalAccess.facilityId])
      const { rows } = await pool.query(`UPDATE payroll_accounting_mapping SET
        wages_expense_account=$1,employer_tax_expense_account=$2,reimbursement_expense_account=$3,
        tax_liability_account=$4,deduction_liability_account=$5,payroll_clearing_account=$6,
        verified_by_bookkeeper=TRUE,updated_at=now() WHERE facility_id=$7 RETURNING *`, [
        account('wagesExpenseAccount', 'Payroll:Wages Expense'),
        account('employerTaxExpenseAccount', 'Payroll:Employer Tax Expense'),
        account('reimbursementExpenseAccount', 'Employee Reimbursements'),
        account('taxLiabilityAccount', 'Payroll:Tax Liabilities'),
        account('deductionLiabilityAccount', 'Payroll:Other Deductions Payable'),
        account('payrollClearingAccount', 'Payroll Clearing'),
        req.canonicalAccess.facilityId,
      ])
      await audit(pool, req, 'VERIFY', 'accounting_mapping', req.canonicalAccess.facilityId, before.rows[0], rows[0])
      res.json({ success: true, data: rows[0] })
    } catch (error) { payrollError(res, error, 'Unable to update accounting mapping') }
  })

  app.patch('/api/admin/payroll/alerts/:id/dismiss', async (req, res) => {
    try {
      const { rows } = await pool.query(`UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now(),dismissed_by=$1
        WHERE id=$2 AND facility_id=$3 AND status='OPEN' RETURNING *`, [req.adminId, req.params.id, req.canonicalAccess.facilityId])
      if (!rows[0]) return res.status(404).json({ success: false, message: 'Open alert not found' })
      await audit(pool, req, 'DISMISS', 'payroll_alert', rows[0].id, null, rows[0])
      res.json({ success: true, data: rows[0] })
    } catch (error) { payrollError(res, error, 'Unable to dismiss payroll alert') }
  })

  app.patch('/api/admin/payroll/exports/:id/reconcile', async (req, res) => {
    const status = allowed(req.body?.status, ['IMPORTED', 'RECONCILED'], null)
    const externalReference = clean(req.body?.externalReference, 500)
    if (!status || !externalReference) return res.status(400).json({ success: false, message: 'Status and QuickBooks reference are required.' })
    try {
      const { rows } = await pool.query(`UPDATE payroll_export_log SET status=$1,external_reference=$2,notes=$3,
        reconciled_by=CASE WHEN $1='RECONCILED' THEN $4 ELSE reconciled_by END,
        reconciled_at=CASE WHEN $1='RECONCILED' THEN now() ELSE reconciled_at END
        WHERE id=$5 AND facility_id=$6 RETURNING *`, [status, externalReference, clean(req.body?.notes, 2000) || null, req.adminId, req.params.id, req.canonicalAccess.facilityId])
      if (!rows[0]) return res.status(404).json({ success: false, message: 'Export record not found' })
      await audit(pool, req, 'RECONCILE', 'payroll_export', rows[0].id, null, rows[0])
      res.json({ success: true, data: rows[0] })
    } catch (error) { payrollError(res, error, 'Unable to reconcile QuickBooks export') }
  })

  app.get('/api/admin/payroll/reports/payroll-register.csv', async (req, res) => {
    const start = isoDate(req.query.start)
    const end = isoDate(req.query.end)
    if (!start || !end || end < start) return res.status(400).json({ success: false, message: 'Valid start and end dates are required.' })
    try {
      const { rows } = await pool.query(`SELECT * FROM (
        SELECT h.period_start, h.period_end, h.payment_date, e.employee_number, e.legal_first_name, e.legal_last_name,
          h.method, h.reference, h.gross_amount_cents, h.employee_tax_withheld_cents,
          0::bigint AS reimbursement_cents, 0::bigint AS deduction_cents, h.net_amount_cents, h.reconciliation_status
        FROM payroll_historical_payment h JOIN payroll_employee e ON e.id=h.employee_id
        WHERE h.facility_id=$1 AND h.payment_date BETWEEN $2 AND $3
        UNION ALL
        SELECT p.period_start,p.period_end,p.pay_date,e.employee_number,e.legal_first_name,e.legal_last_name,
          'PAYROLL_RUN'::text,('RUN-'||r.id)::text,
          (re.regular_pay_cents+re.overtime_pay_cents+re.other_taxable_pay_cents),
          (COALESCE(re.federal_income_tax_cents,0)+COALESCE(re.state_income_tax_cents,0)+re.social_security_tax_cents+re.medicare_tax_cents+re.additional_medicare_tax_cents),
          re.reimbursement_cents,re.other_deductions_cents,re.net_pay_cents,'RECONCILED'::text
        FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
        JOIN payroll_run_employee re ON re.payroll_run_id=r.id JOIN payroll_employee e ON e.id=re.employee_id
        WHERE r.facility_id=$1 AND r.status='FINALIZED' AND p.pay_date BETWEEN $2 AND $3
      ) register ORDER BY payment_date,legal_last_name`, [req.canonicalAccess.facilityId, start, end])
      sendCsv(res, `vortex-payroll-register-${start}-to-${end}.csv`, [
        ['Period start', 'Period end', 'Payment date', 'Employee #', 'Employee', 'Method', 'Reference', 'Gross wages', 'Employee tax withheld', 'Reimbursements', 'Deductions', 'Net payment', 'Reconciliation'],
        ...rows.map((row) => [row.period_start, row.period_end, row.payment_date, row.employee_number, `${row.legal_first_name} ${row.legal_last_name}`, row.method, row.reference, (Number(row.gross_amount_cents) / 100).toFixed(2), (Number(row.employee_tax_withheld_cents) / 100).toFixed(2), (Number(row.reimbursement_cents) / 100).toFixed(2), (Number(row.deduction_cents) / 100).toFixed(2), (Number(row.net_amount_cents) / 100).toFixed(2), row.reconciliation_status]),
      ])
    } catch (error) { payrollError(res, error, 'Unable to export payroll register') }
  })

  app.get('/api/admin/payroll/reports/time-log.csv', async (req, res) => {
    const start = isoDate(req.query.start)
    const end = isoDate(req.query.end)
    if (!start || !end || end < start) return res.status(400).json({ success: false, message: 'Valid start and end dates are required.' })
    try {
      const { rows } = await pool.query(`SELECT t.clock_in, t.clock_out, t.unpaid_break_minutes,
          t.activity_type, t.source, t.status, t.evidence_note, e.employee_number,
          e.legal_first_name, e.legal_last_name,
          CASE WHEN t.clock_out IS NULL THEN NULL ELSE GREATEST(0, ROUND(EXTRACT(EPOCH FROM (t.clock_out-t.clock_in))/60)::int-t.unpaid_break_minutes) END AS worked_minutes
        FROM payroll_time_entry t JOIN payroll_employee e ON e.id=t.employee_id
        JOIN payroll_settings ps ON ps.facility_id=t.facility_id
        WHERE t.facility_id=$1
          AND t.clock_in >= ($2::date::timestamp AT TIME ZONE ps.timezone)
          AND t.clock_in < (($3::date + 1)::timestamp AT TIME ZONE ps.timezone)
        ORDER BY t.clock_in, e.legal_last_name`, [req.canonicalAccess.facilityId, start, end])
      sendCsv(res, `vortex-time-log-${start}-to-${end}.csv`, [
        ['Employee #', 'Employee', 'Clock in', 'Clock out', 'Break minutes', 'Worked minutes', 'Activity', 'Source', 'Status', 'Evidence note'],
        ...rows.map((row) => [row.employee_number, `${row.legal_first_name} ${row.legal_last_name}`, row.clock_in, row.clock_out, row.unpaid_break_minutes, row.worked_minutes, row.activity_type, row.source, row.status, row.evidence_note]),
      ])
    } catch (error) { payrollError(res, error, 'Unable to export time log') }
  })

  app.get('/api/admin/payroll/reports/compliance.csv', async (req, res) => {
    try {
      const { rows } = await pool.query(`SELECT title, category, jurisdiction, due_date, status, severity,
          description, source_url, source_authority, last_verified_on, next_review_on, completion_note
        FROM payroll_compliance_task WHERE facility_id=$1 ORDER BY due_date NULLS LAST, title`, [req.canonicalAccess.facilityId])
      sendCsv(res, 'vortex-payroll-compliance.csv', [
        ['Task', 'Category', 'Jurisdiction', 'Due date', 'Status', 'Severity', 'Description', 'Official source', 'Authority', 'Last verified', 'Review again', 'Completion note'],
        ...rows.map((row) => [row.title, row.category, row.jurisdiction, row.due_date, row.status, row.severity, row.description, row.source_url, row.source_authority, row.last_verified_on, row.next_review_on, row.completion_note]),
      ])
    } catch (error) { payrollError(res, error, 'Unable to export compliance report') }
  })

  app.get('/api/admin/payroll/reports/tax-liabilities.csv', async (req, res) => {
    try {
      const { rows } = await pool.query(`SELECT r.id,p.pay_date,r.status,r.employee_tax_cents,r.employer_tax_cents,
          (r.employee_tax_cents+r.employer_tax_cents)::bigint AS total_liability
        FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
        WHERE r.facility_id=$1 AND r.status IN ('APPROVED','FINALIZED') ORDER BY p.pay_date`, [req.canonicalAccess.facilityId])
      sendCsv(res, 'vortex-payroll-tax-liabilities.csv', [
        ['Run', 'Pay date', 'Status', 'Employee taxes', 'Employer taxes', 'Total tax liability'],
        ...rows.map((row) => [row.id, row.pay_date, row.status, (Number(row.employee_tax_cents) / 100).toFixed(2), (Number(row.employer_tax_cents) / 100).toFixed(2), (Number(row.total_liability) / 100).toFixed(2)]),
      ])
    } catch (error) { payrollError(res, error, 'Unable to export tax liabilities') }
  })

  app.get('/api/admin/payroll/reports/leave.csv', async (req, res) => {
    try {
      const { rows } = await pool.query(`SELECT e.employee_number,e.legal_first_name,e.legal_last_name,l.leave_type,
          l.transaction_date,l.minutes,l.reason FROM payroll_leave_transaction l
        JOIN payroll_employee e ON e.id=l.employee_id WHERE l.facility_id=$1
        ORDER BY l.transaction_date,e.legal_last_name`, [req.canonicalAccess.facilityId])
      sendCsv(res, 'vortex-payroll-leave.csv', [
        ['Employee #', 'Employee', 'Leave type', 'Date', 'Minutes (+ earned / - used)', 'Reason'],
        ...rows.map((row) => [row.employee_number, `${row.legal_first_name} ${row.legal_last_name}`, row.leave_type, row.transaction_date, row.minutes, row.reason]),
      ])
    } catch (error) { payrollError(res, error, 'Unable to export leave ledger') }
  })

  app.get('/api/admin/payroll/reports/quickbooks.csv', async (req, res) => {
    const runId = integer(req.query.runId)
    if (!runId) return res.status(400).json({ success: false, message: 'Approved payroll run is required.' })
    try {
      const { rows } = await pool.query(`SELECT r.*, p.pay_date, m.* FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
        JOIN payroll_accounting_mapping m ON m.facility_id=r.facility_id
        WHERE r.id=$1 AND r.facility_id=$2`, [runId, req.canonicalAccess.facilityId])
      const run = rows[0]
      if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found' })
      if (!['APPROVED', 'FINALIZED'].includes(run.status)) return res.status(409).json({ success: false, message: 'Only an approved or finalized run can be exported to QuickBooks.' })
      if (!run.verified_by_bookkeeper) return res.status(409).json({ success: false, message: 'A bookkeeper must verify the account mapping before export.' })
      const gross = Number(run.gross_pay_cents)
      const employeeTax = Number(run.employee_tax_cents)
      const employerTax = Number(run.employer_tax_cents)
      const reimbursements = Number(run.reimbursement_cents)
      const deductions = Number(run.deduction_cents)
      const clearing = Number(run.net_pay_cents)
      const journal = `PAY-${run.id}`
      const money = (cents) => (cents / 100).toFixed(2)
      const journalRows = [
        ['Journal No.', 'Journal Date', 'Account Name', 'Debits', 'Credits', 'Description'],
        [journal, run.pay_date, run.wages_expense_account, money(gross), '', `Payroll run ${run.id}`],
        [journal, run.pay_date, run.employer_tax_expense_account, money(employerTax), '', `Payroll run ${run.id}`],
        ...(reimbursements ? [[journal, run.pay_date, run.reimbursement_expense_account, money(reimbursements), '', `Payroll run ${run.id}`]] : []),
        [journal, run.pay_date, run.tax_liability_account, '', money(employeeTax + employerTax), `Payroll run ${run.id}`],
        ...(deductions ? [[journal, run.pay_date, run.deduction_liability_account, '', money(deductions), `Payroll run ${run.id}`]] : []),
        [journal, run.pay_date, run.payroll_clearing_account, '', money(clearing), `Payroll run ${run.id}`],
      ]
      const csv = csvText(journalRows)
      await pool.query(`INSERT INTO payroll_export_log
        (facility_id,payroll_run_id,export_type,content_sha256,exported_by)
        VALUES ($1,$2,'QUICKBOOKS_JOURNAL',$3,$4)`, [req.canonicalAccess.facilityId, run.id, createHash('sha256').update(csv).digest('hex'), req.adminId])
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="vortex-quickbooks-payroll-${run.id}.csv"`)
      res.send(csv)
    } catch (error) { payrollError(res, error, 'Unable to export QuickBooks journal') }
  })

  app.post('/api/admin/payroll/ai-review', aiLimiter, async (req, res) => {
    if (!isLlmConfigured()) return res.status(503).json({ success: false, message: 'Payroll AI is not configured.' })
    const question = clean(req.body?.question, 1000)
    if (!question) return res.status(400).json({ success: false, message: 'Ask a payroll question first.' })
    try {
      const data = await dashboardData(pool, req.canonicalAccess.facilityId)
      const context = {
        settings: data.settings,
        employees: data.employees.map((item) => ({ id: item.id, name: `${item.legalFirstName} ${item.legalLastName}`, jobTitle: item.jobTitle, payType: item.payType, hourlyRateCents: item.hourlyRateCents, hireDate: item.hireDate, workState: item.workState, residenceState: item.residenceState, w4Status: item.w4Status, stateWithholdingStatus: item.stateWithholdingStatus, i9Status: item.i9Status })),
        summary: data.summary,
        tasks: data.complianceTasks,
        recentRuns: data.payrollRuns.slice(0, 8),
      }
      const answer = await llmGenerateText({
        system: 'You are an advisory payroll operations assistant inside Vortex admin. Use only the supplied database facts and link to the supplied official sourceUrl when relevant. Never invent hours, forms, registrations, tax rates, payments, deadlines, or completion status. Never say a legal or tax requirement is definitively satisfied; identify when an owner, payroll professional, insurer, accountant, or agency must confirm. You cannot edit records, approve payroll, move money, file returns, or replace professional advice. Prefer a short prioritized checklist and call out missing evidence. Do not expose sensitive identity or banking data.',
        prompt: `Payroll database context:\n${JSON.stringify(context).slice(0, 24000)}\n\nAdmin question: ${question}`,
        maxTokens: 650,
      })
      if (!answer) throw new Error('No AI response')
      res.json({ success: true, data: { answer, advisoryOnly: true } })
    } catch (error) { payrollError(res, error, 'Payroll AI is temporarily unavailable') }
  })
}
