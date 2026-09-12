import {registerRetirementReplacementAssessment} from './retirementReplacementAssessment.js'
import {registerRetirementReplacementReceiptIntake} from './retirementReplacementReceiptIntake.js'
import {registerRetirementReplacementReceiptBindings} from './retirementReplacementReceiptBinding.js'
import {registerRetirementReplacementBank} from './retirementReplacementBank.js'
import {registerRetirementReplacementAllocation} from './retirementReplacementAllocation.js'
import {registerRetirementReplacementAuthorization} from './retirementReplacementAuthorization.js'
import {registerRetirementReplacementPreview} from './retirementReplacementPreview.js'
import {registerRetirementReturnRelease} from './retirementReturnRelease.js'
import {registerRetirementReturnReleasePreview} from './retirementReturnReleasePreview.js'
import {registerRetirementReturnPosting} from './retirementReturnPosting.js'
import {registerRetirementReturnAuthorization} from './retirementReturnAuthorization.js'
import {registerRetirementReturnPreview} from './retirementReturnPreview.js'
import {registerRetirementSettlementRelease} from './retirementSettlementRelease.js'
import {registerRetirementSettlementAuthorizationRoutes} from './retirementSettlementAuthorization.js'
import {registerRetirementSettlementPostingRoutes} from './retirementSettlementPosting.js'
import {registerRetirementSettlementReleasePreview} from './retirementSettlementReleasePreview.js'
import {registerRetirementSettlementPreview} from './retirementSettlementPreview.js'
import {registerRetirementSettlementMappingRoutes} from './retirementSettlementMapping.js'
import {registerRetirementContributionAssessment} from './retirementContributionAssessment.js'
import {registerRetirementContributionHistory} from './retirementContributionReconciliation.js'
import {registerRetirementReceiptIntake} from './retirementReceiptIntake.js'
import {registerRetirementReceiptBindings} from './retirementReceiptBinding.js'
import {registerRetirementReceiptContracts} from './retirementReceiptContract.js'
import {registerRetirementBankUnsentRelease} from './retirementBankUnsentRelease.js'
import {registerRetirementAllocationUnsentRelease} from './retirementAllocationUnsentRelease.js'
import {registerRetirementDispatchSchedules} from './retirementDispatchSchedule.js'
import {registerRetirementAllocationDelivery} from './retirementAllocationDelivery.js'
import {registerRetirementSftpSetup} from './retirementSftpSetup.js'
import {registerRetirementRemittanceDispatch} from './retirementRemittanceDispatch.js'
import {registerRetirementRemittanceAuthorizations} from './retirementRemittanceAuthorization.js'
import {registerRetirementAllocationFormatRoutes} from './retirementAllocationFormat.js'
import {registerRetirementAllocationFileRoutes} from './retirementAllocationFile.js'
import {registerRetirementTimingRoutes} from './retirementTiming.js'
import {registerRetirementRemittancePreviewRoutes} from './retirementRemittancePreview.js'
import {registerRetirementParticipantMappingRoutes} from './retirementParticipantMapping.js'
import {registerRetirementDestinationRoutes} from './retirementDestination.js'
import {retirementStatementSummary} from './retirementStatement.js'
import {regularRetirementPayroll} from './regularRetirementPayroll.js'
import {verifyRetirementPosting} from './retirementJournal.js'
import {registerRetirementProcessingReview} from './retirementProcessingReview.js'
import {retainRetirementRunLedger} from './retirementLedger.js'
import {registerRetirementAnnualSources} from './retirementAnnualSources.js'
import {registerAdminRetirementElectionRoutes} from './retirementElections.js'
import {registerRetirementEligibilityRoutes} from './retirementEligibility.js'
import {registerRetirementPlanRoutes} from './retirementPlanRoutes.js'
import {registerCarrierAlternateDelivery} from './carrierAlternateDelivery.js'
import {registerBenefitCoverageLedger} from './benefitCoverageLedger.js'
import {registerCarrierRemittanceUnsentRelease} from './carrierRemittanceUnsentRelease.js'
import {registerCarrierRemittanceNoticeRoutes} from './carrierRemittanceNotice.js'
import {registerCarrierRemittanceRecipientRoutes} from './carrierRemittanceRecipient.js'
import {registerCarrierRemittanceAdviceRoutes} from './carrierRemittanceAdvice.js'
import {registerCarrierPayeeRoutes} from './carrierPayee.js'
import {registerBenefitCarrierInvoiceRoutes} from './benefitCarrierInvoice.js'
import {employerBenefitFundingReport,employerBenefitFundingCsv} from './employerBenefitFundingReport.js'
import {registerFederalRemittanceReviewRoutes} from './federalRemittanceReview.js'
import {registerCheckEvidenceRoutes} from './checkEvidence.js'
import {registerCheckCancellationRoutes} from './checkCancellation.js'
import {registerSettlementAutomationRoutes} from './settlementAutomation.js'
import {registerCheckStopCaseRoutes} from './checkStopCase.js'
import {registerCheckReplacementDeliveryRoutes} from './checkReplacementDelivery.js'
import {registerCheckReplacementDocumentRoutes} from './checkReplacementDocument.js'
import {registerCheckReplacementDispatchRoutes} from './checkReplacementDispatch.js'
import {registerCheckReplacementAuthorizationRoutes} from './checkReplacementAuthorization.js'
import {registerCheckReplacementReviewRoutes} from './checkReplacementReview.js'
import {registerCheckStopRoutes} from './checkStop.js'
import {registerCheckReceiptRoutes} from './checkReceipts.js'
import {registerPaymentReturnCaseRoutes} from './paymentReturnCase.js'
import {registerReplacementReceiptRoutes} from './paymentReplacementReceipt.js'
import {registerReplacementDispatchRoutes} from './paymentReplacementDispatch.js'
import {registerReplacementAuthorizationRoutes} from './paymentReplacementAuthorization.js'
import {registerPaymentReplacementReviewRoutes} from './paymentReplacementReview.js'
import {registerAdminBankEnrollmentHistory} from './bankEnrollmentHistory.js'
import {registerSettlementPostingRoutes} from './settlementPosting.js'
import {registerCarrierApplicationRoutes} from './carrierApplication.js'
import {registerCarrierPaymentReceiptRoutes} from './carrierPaymentReceipt.js'
import {registerCarrierSettlementReleaseRoutes} from './carrierSettlementRelease.js'
import {registerCarrierSettlementPostingRoutes} from './carrierSettlementPosting.js'
import {registerCarrierSettlementAuthorizationRoutes} from './carrierSettlementAuthorization.js'
import {registerCarrierSettlementPreviewRoutes} from './carrierSettlementPreview.js'
import {registerCarrierSettlementMappingRoutes} from './carrierSettlementMapping.js'
import {registerPaymentAccountingMappingRoutes} from './paymentAccountingMapping.js'
import {registerPaymentAccountingRoutes} from './paymentAccounting.js'
import {registerPaymentSubmissionScheduleRoutes} from './paymentSubmissionSchedule.js'
import {registerAutomaticCloseoutRoutes} from './automaticCloseout.js'
import {retainPaymentCloseout} from './paymentCloseout.js'
import {registerPaymentConnectionRoutes} from './paymentConnection.js'
import {registerCheckConfigurationRoutes} from './checkConfiguration.js'
import {registerCheckPayeeRoutes} from './checkPayee.js'
import {registerPaymentDestinationRoutes} from './paymentDestination.js'
import {registerPaymentPlanRoutes} from './paymentPlan.js'
import {registerCheckIssuancePlanRoutes} from './checkIssuancePlan.js'
import {registerCheckIssuanceRoutes} from './checkIssuance.js'
import {registerCheckDocumentRoutes} from './checkDocument.js'
import {registerCheckDeliveryRoutes} from './checkDelivery.js'
import {registerPaymentBatchRoutes,assertNoActivePaymentBatch} from './paymentBatch.js'
import {registerPaymentDispatchRoutes} from './paymentDispatch.js'
import {registerYearEndPreparationRoutes} from './yearEndPreparation.js'
import {registerOvertimeReportingRoutes} from './overtimeReporting.js'
import {registerFilingIdentityRoutes} from './filingIdentity.js'
import {registerIncomeTaxBasisReviewRoutes} from './incomeTaxBasisReview.js'
import {payrollServiceReadiness,w2ProviderActivity} from './serviceReadiness.js'
import {benefitContributionReport} from './benefitContributionReport.js'
import {applyMonthlyBenefits} from './monthlyBenefits.js'
import {settlePayrollCorrections} from './settlePayrollCorrections.js'
import {includeAuthorizedCorrections} from './authorizedCorrectionPayroll.js'
import {registerCorrectionPaymentAuthorizationRoutes} from './correctionPaymentAuthorization.js'
import {correctionLeaveContext} from './correctionLeaveContext.js'
import {registerCorrectionPaymentPreviewRoutes} from './correctionPaymentPreview.js'
import {registerTimeCorrectionCalculationRoutes} from './timeCorrectionCalculation.js'
import {revalidateHistoricalAllocationCoverage} from './historicalAllocationCoverage.js'
import {registerHistoricalAllocationReviewRoutes} from './historicalAllocationReview.js'
import {registerHistoricalAllocationPreviewRoutes} from './historicalAllocationPreview.js'
import {registerHistoricalPaymentEntryRoutes} from './historicalPaymentEntry.js'
import {registerWorkweekSettlementAuthorizationRoutes,revalidateSettlementAuthorizations} from './workweekSettlementAuthorization.js'
import {reconcileAllocationPayments} from './allocationPaymentReconciliation.js'
import {registerWorkweekAllocationApprovalRoutes,revalidateWorkweekAllocations} from './workweekAllocationApproval.js'
import {previewWorkweekAllocation} from './workweekAllocation.js'
import {employmentWorkweekBoundaries,employmentWorkweekReviews,employmentWorkweekReviewScopes} from './employmentWorkweeks.js'
import {employmentCompensationAt,compensationEvidence} from './employmentCompensation.js'
import {registerPayBasisRoutes} from './payBasis.js'
import {registerNoWorkCloseoutRoutes} from './noWorkCloseout.js'
import {leaveAvailabilityAt} from './leaveAvailability.js'
import {registerEmploymentPeriodRoutes,assertEmploymentRange} from './employmentPeriods.js'
import {validateOffCyclePto,loadOffCyclePtoPreview} from './offCyclePto.js'
import {isDeepStrictEqual} from 'node:util'
import {validateOffCycleBonus,loadOffCycleBonusPreview} from './offCycleBonus.js'
import {loadReimbursementPreview,registerOffCycleReimbursementRoutes} from './offCycleReimbursement.js'
import {registerLeavePayoutRoutes,reservedPtoMinutes} from './leavePayout.js'
import {registerFinalPayRoutes} from './finalPay.js'
import {registerRehireReviewRoutes} from './rehireReview.js'
import {registerRehireRoutes} from './rehire.js'
import {loadBonusPaymentCoverage} from './bonusPaymentCoverage.js'
import {previewEarnedBonus,registerEarnedBonusPreviewRoutes} from './earnedBonusAllocation.js'
import {registerBonusRoutes} from './bonuses.js'
import {registerSalaryChangeRoutes,salaryRowsAt} from './salaryChanges.js'
import {registerSalaryReviewRoutes} from './salaryReview.js'
import {registerLeaveFractionRoutes} from './leaveFractionReconciliation.js'
import {registerLeaveYearPolicyRoutes} from './leaveYearAutomation.js'
import {registerLeaveYearCloseRoutes} from './leaveYearClose.js'
import {loadLeaveRemainder} from './leaveRemainder.js'
import {previousLeavePeriodHistory} from './leavePeriodHistory.js'
import { registerPayScheduleRoutes } from './payScheduleRoutes.js'
import { generateVersionedPayPeriods, loadScheduleVersions, persistPayPeriods, effectiveScheduleSettings } from './payCalendar.js'
import { employeeSummaryCsv } from './employeeSummary.js'
import { reviewWorkweekSettlements } from './workweekSettlementReview.js'
import { loadWorkweekPaymentHistory } from './workweekPaymentHistory.js'
import { registerMarylandWithholdingCalendarRoutes } from './marylandWithholdingCalendar.js'
import { recordPayrollClock } from './clockActions.js'
import { registerMarylandUiCalendarRoutes } from './marylandUiCalendar.js'
import { registerFederalTaxCalendarRoutes } from './federalTaxCalendar.js'
import { ensureEmployerSetup } from './employerSetup.js'
import { registerTaxReconciliationRoutes } from './taxReconciliation.js'
import { registerCompensationAdminRoutes,assertCompensationUnlocked } from './compensation.js'
import { registerEmployerTaxRoutes } from './employerTaxes.js'
import { registerTaxElectionRoutes } from './taxElectionRoutes.js'
import { createShiftSeries, assertShiftAvailable } from './scheduling.js'
import { registerQuickbooksAdminRoutes, syncQuickbooksRun, journalEntries, verifyBenefitPosting } from './quickbooks.js'
import { registerWorkforceAdminRoutes } from './workforceRoutes.js'
import { ensureOnboarding } from './onboarding.js'
import rateLimit from 'express-rate-limit'
import { createHash } from 'node:crypto'
import { isLlmConfigured, llmGenerateText } from '../platform/aiService.js'
import { buildPayrollPreview, calculateMarylandSickAccrual, calculateWorkedMinutes, workweekStartFor } from './payrollEngine.js'
import { createPayrollToken, hashPayrollToken } from './employeeAuth.js'
import { publicAppUrl } from '../email/publicAppUrl.js'
import { sendEmail } from '../email/sendEmail.js'

const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max)
const integer = (value) => value === null || value === undefined || typeof value === 'boolean' || (typeof value === 'string' && !value.trim()) ? null : Number.isSafeInteger(Number(value)) ? Number(value) : null
const isoDate = (value) => { const text=String(value??'');return /^\d{4}-\d{2}-\d{2}$/.test(text)&&Number.isFinite(Date.parse(text))&&new Date(text).toISOString().slice(0,10)===text?text:null }
const isoTimestamp = (value) => {
  const parsed = new Date(value)
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null
}
const allowed = (value, values, fallback) => values.includes(value) ? value : fallback
const PAYROLL_SOURCE_HOSTS = new Set(['irs.gov', 'www.irs.gov', 'dol.gov', 'www.dol.gov', 'uscis.gov', 'www.uscis.gov', 'ssa.gov', 'www.ssa.gov', 'labor.maryland.gov', 'www.labor.maryland.gov', 'paidleave.maryland.gov', 'www.paidleave.maryland.gov', 'marylandcomptroller.gov', 'www.marylandcomptroller.gov', 'services.marylandcomptroller.gov', 'mdnewhire.com', 'www.mdnewhire.com', 'wcc.state.md.us', 'www.wcc.state.md.us'])

function payrollError(res, error, message) {
  if([400,404,409,422].includes(error.status))return res.status(error.status).json({success:false,message:error.message})
  if(error.code==='23514' && (error.constraint?.startsWith('payroll_time_')||error.constraint==='payroll_leave_year_closed'))return res.status(409).json({success:false,message:error.message})
  console.error(`[payroll] ${message}:`, error)
  return res.status(500).json({ success: false, message })
}

function csvCell(value) {
  let text = value instanceof Date ? value.toISOString() : String(value ?? '')
  if (/^[=+@\t\r]/.test(text.trimStart()) || (/^-/.test(text.trimStart()) && !/^-\d+(\.\d+)?$/.test(text))) text="'"+text
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
    [req.canonicalAccess.facilityId, req.adminId, action, entityType, String(entityId ?? ''), beforeData == null ? null : JSON.stringify(beforeData, (key, value) => key === 'portal_password_hash' ? '[redacted]' : value), afterData == null ? null : JSON.stringify(afterData, (key, value) => key === 'portal_password_hash' ? '[redacted]' : value)],
  )
}

function mapEmployee(row) {
  return {
    id: Number(row.id),
    employeeNumber: row.employee_number,
    legalFirstName: row.legal_first_name,
    legalMiddleName: row.legal_middle_name || '',
    legalLastName: row.legal_last_name,
    preferredName: row.preferred_name || '',
    jobTitle: row.job_title,
    employmentStatus: row.employment_status,
    hasPriorEmployment:row.has_prior_employment===true,
    workerClassification: row.worker_classification,
    overtimeClassification: row.overtime_classification,
    payType: row.pay_type,
    salaryReview:row.salary_review,
    hourlyRateCents: row.hourly_rate_cents,
    annualSalaryCents: row.annual_salary_cents == null ? null : Number(row.annual_salary_cents),
    hireDate: row.hire_date,
    terminationDate:row.termination_date,
    ...(row.payroll_employment_periods?{employmentPeriods:row.payroll_employment_periods}:{}),
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
    payPeriodAnchorStart: row.pay_period_anchor_start ? new Date(row.pay_period_anchor_start).toISOString().slice(0,10) : null,
    payPeriodPaymentLagDays: row.pay_period_payment_lag_days,
    semimonthlyFirstDay: row.semimonthly_first_day,
    semimonthlySecondDay: row.semimonthly_second_day,
    timezone: row.timezone,
    stateCode: row.state_code,
    mdCrnStatus: row.md_crn_status,
    mdUiStatus: row.md_ui_status,
    workersCompStatus: row.workers_comp_status,
    payrollExecutionMode: row.payroll_execution_mode,
    onboardingPolicy: row.onboarding_policy || {},
    employerTaxConfig: row.employer_tax_config || null,
  }
}

async function dashboardData(pool, facilityId) {
  await ensureEmployerSetup(pool,facilityId)
  const [settingsResult, employeeResult, documentResult, historicalResult, shiftResult, timeResult, periodResult, runResult, runEmployeeResult, complianceResult, clockResult, sourceReviewResult, invitationResult, adjustmentResult, leaveResult, mappingResult, alertResult, exportResult] = await Promise.all([
    pool.query('SELECT * FROM payroll_settings WHERE facility_id=$1', [facilityId]),
    pool.query(`SELECT e.*,EXISTS(SELECT 1 FROM payroll_employment_period ep WHERE ep.facility_id=e.facility_id AND ep.employee_id=e.id AND ep.started_on<e.hire_date AND ep.ended_on IS NOT NULL) AS has_prior_employment,COALESCE((SELECT pr.hourly_rate_cents FROM payroll_pay_rate pr JOIN payroll_settings ps ON ps.facility_id=pr.facility_id WHERE pr.employee_id=e.id AND pr.facility_id=e.facility_id AND pr.cancelled_at IS NULL AND pr.effective_on<=GREATEST(e.hire_date,(now() AT TIME ZONE ps.timezone)::date) ORDER BY pr.effective_on DESC LIMIT 1),e.hourly_rate_cents) AS hourly_rate_cents FROM payroll_employee e WHERE e.facility_id=$1 ORDER BY employment_status, legal_last_name, legal_first_name`, [facilityId]),
    pool.query(`SELECT d.* FROM payroll_employee_document d WHERE d.facility_id=$1 ORDER BY d.employee_id, d.document_type`, [facilityId]),
    pool.query(`SELECT h.*, e.legal_first_name, e.legal_last_name FROM payroll_historical_payment h JOIN payroll_employee e ON e.id=h.employee_id WHERE h.facility_id=$1 ORDER BY payment_date DESC`, [facilityId]),
    pool.query(`SELECT s.*, e.legal_first_name, e.legal_last_name FROM payroll_shift s JOIN payroll_employee e ON e.id=s.employee_id WHERE s.facility_id=$1 AND s.scheduled_start >= now() - interval '14 days' ORDER BY s.scheduled_start LIMIT 120`, [facilityId]),
    pool.query(`SELECT t.*, e.legal_first_name, e.legal_last_name, CASE WHEN t.clock_out IS NULL THEN NULL ELSE GREATEST(0, ROUND(EXTRACT(EPOCH FROM (t.clock_out-t.clock_in))/60)::int-t.unpaid_break_minutes) END AS worked_minutes FROM payroll_effective_time_entry t JOIN payroll_employee e ON e.id=t.employee_id WHERE t.facility_id=$1 ORDER BY t.clock_in DESC LIMIT 180`, [facilityId]),
    pool.query(`SELECT * FROM payroll_pay_period WHERE facility_id=$1 ORDER BY pay_date DESC LIMIT 24`, [facilityId]),
    pool.query(`SELECT r.*, p.period_start, p.period_end, p.pay_date AS scheduled_pay_date, COALESCE(r.payment_date,p.pay_date) AS pay_date FROM payroll_run r LEFT JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 ORDER BY r.created_at DESC LIMIT 24`, [facilityId]),
    pool.query(`SELECT re.*, e.employee_number, e.legal_first_name, e.legal_last_name
      FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id
      JOIN payroll_employee e ON e.id=re.employee_id
      WHERE r.facility_id=$1 ORDER BY re.payroll_run_id DESC, e.legal_last_name`, [facilityId]),
    pool.query(`SELECT * FROM payroll_compliance_task WHERE facility_id=$1 ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END, due_date NULLS LAST`, [facilityId]),
    pool.query(`SELECT COUNT(*)::int AS count FROM payroll_effective_time_entry WHERE facility_id=$1 AND clock_out IS NULL AND status<>'REJECTED'`, [facilityId]),
    pool.query(`SELECT DISTINCT ON (compliance_task_id) compliance_task_id, result, advisory_summary, checked_at
      FROM payroll_compliance_source_review WHERE facility_id=$1 ORDER BY compliance_task_id, checked_at DESC`, [facilityId]),
    pool.query(`SELECT DISTINCT ON (employee_id) id, employee_id, recipient_email, expires_at, sent_at, redeemed_at, revoked_at, created_at
      FROM payroll_employee_invitation WHERE facility_id=$1 ORDER BY employee_id, created_at DESC`, [facilityId]),
    pool.query(`SELECT a.*, e.legal_first_name, e.legal_last_name FROM payroll_recurring_adjustment a
      JOIN payroll_employee e ON e.id=a.employee_id WHERE a.facility_id=$1 ORDER BY a.status, a.active_from DESC`, [facilityId]),
    pool.query(`WITH dated AS (
      SELECT employee_id,leave_type,transaction_date,SUM(minutes) AS minutes FROM payroll_leave_transaction
      WHERE facility_id=$1 GROUP BY employee_id,leave_type,transaction_date
    ), running AS (
      SELECT *,SUM(minutes) OVER(PARTITION BY employee_id,leave_type ORDER BY transaction_date) AS balance FROM dated
    ), available AS (
      SELECT l.employee_id,l.leave_type,(now() AT TIME ZONE s.timezone)::date AS as_of_date,
      LEAST(COALESCE(SUM(l.minutes) FILTER(WHERE l.transaction_date<=(now() AT TIME ZONE s.timezone)::date),0),
        COALESCE(MIN(l.balance) FILTER(WHERE l.transaction_date>(now() AT TIME ZONE s.timezone)::date),
          COALESCE(SUM(l.minutes) FILTER(WHERE l.transaction_date<=(now() AT TIME ZONE s.timezone)::date),0))) AS minutes
      FROM running l JOIN payroll_settings s ON s.facility_id=$1 GROUP BY l.employee_id,l.leave_type,s.timezone
    ) SELECT a.employee_id,a.leave_type,a.as_of_date::text,
      (a.minutes-CASE WHEN a.leave_type='PTO' THEN COALESCE((SELECT SUM(c.minutes) FROM payroll_leave_payout c WHERE c.facility_id=$1 AND c.employee_id=a.employee_id AND c.status='RESERVED'),0) ELSE 0 END)::bigint AS balance_minutes
      FROM available a ORDER BY a.employee_id,a.leave_type`,[facilityId]),
    pool.query('SELECT * FROM payroll_accounting_mapping WHERE facility_id=$1', [facilityId]),
    pool.query(`SELECT * FROM payroll_alert WHERE facility_id=$1 AND status='OPEN' ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END, created_at DESC LIMIT 40`, [facilityId]),
    pool.query(`SELECT * FROM payroll_export_log WHERE facility_id=$1 ORDER BY exported_at DESC LIMIT 40`, [facilityId]),
  ])
  const settings = settingsResult.rows[0] ? mapSettings(await effectiveScheduleSettings(pool,facilityId,settingsResult.rows[0])) : null
  const employees = (await salaryRowsAt(pool,facilityId,employeeResult.rows)).map(mapEmployee)
  const tasks = complianceResult.rows.map((row) => ({
    id: Number(row.id), employeeId: row.employee_id == null ? null : Number(row.employee_id), taskKey: row.task_key, title: row.title,
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

export const payrollFingerprint = (preview) => JSON.stringify(preview.employees.map(e => ({
          id: e.employeeId, correctionSettlements:compensationEvidence(e.correctionSettlements), correctionAuthorizations:compensationEvidence(e.correctionAuthorizations),offcycleFingerprint:e.offcycleFingerprint, leavePayouts:e.payItems?.filter(p=>p.kind==='LEAVE_PAYOUT').map(p=>[p.leavePayout.id,p.amountCents,p.minutes,p.leavePayout.hourlyRateCents,p.leavePayout.fingerprint]), bonusReviews:e.payItems?.filter(p=>p.kind==='BONUS').map(p=>[p.amountCents,p.bonusReview?.version,p.bonusReview?.classification,p.bonusReview?.paymentType,p.bonusReview?.verifiedAt,p.bonusAllocation?[p.bonusAllocation.version,p.bonusAllocation.method,p.bonusAllocation.earnedStart,p.bonusAllocation.earnedEnd,p.bonusAllocation.bonusCents,p.bonusAllocation.additionalOvertimeCents,p.bonusAllocation.fingerprint,p.bonusAllocation.coverage?.version,p.bonusAllocation.coverage?.evidence.map(v=>[v.entryId,v.workDate,v.source,v.runId,v.correctionSettlementIds])]:null]), salary:e.salaryCalculation?[e.salaryCalculation.version,e.salaryCalculation.classification,e.salaryCalculation.minimumWageCents,e.salaryCalculation.annualSalaryCents,e.salaryCalculation.periodsPerYear,e.salaryCalculation.regularPayCents,e.salaryCalculation.periodStart,e.salaryCalculation.periodEnd,e.salaryCalculation.reviewedAt,e.salaryCalculation.partialPeriod,e.salaryCalculation.paymentPolicy,e.salaryCalculation.leaveBasisMinutes,e.salaryCalculation.normalWorkweekMinutes,e.salaryCalculation.standardWeeklyHours,e.salaryCalculation.extraStraightTimeMinutes,e.salaryCalculation.extraStraightTimePayCents]:null, payFrequency:e.payFrequency, rate: e.hourlyRateCents, weightedOvertimeApplied:e.weightedOvertimeApplied===true,
          weightedDependencies:e.weightedOvertimeApplied?e.followingWorkweekEntries?.filter(t=>e.workweekPayments.some(w=>w.week===t.week&&w.weightedPremiumApplied)).map(t=>[t.id,t.week,new Date(t.clockIn).toISOString(),t.clockOut?new Date(t.clockOut).toISOString():null,t.hourlyRateCents,t.status,t.ambiguousBreak,t.minutes]):null, workweekPaidHistory:e.workweekPaidHistory?.map(w=>[w.week,w.paidWorkedMinutes,w.historyVerified,w.premiums.map(p=>[p.runId,p.premiumCents,p.correctionSettlementIds||[]]),w.issues]), workweekPayments:e.workweekPayments?.map(w=>[w.week,w.workedMinutes,w.straightTimePayCents,w.premiumCents,w.weightedPremiumApplied===true]), workweekEarnings:e.workweekEarnings?.map(w=>[w.week,w.scope,w.workedMinutes,w.overtimeMinutes,w.straightTimePayCents,w.overtimePremiumCents,w.regularRateNumerator,w.regularRateDenominator]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))), rateBreakdown:e.rateBreakdown?.map(r=>[r.hourlyRateCents,r.regularMinutes,r.overtimeMinutes,r.regularPayCents,r.overtimePayCents]), authorizedSettlement:compensationEvidence(e.authorizedSettlement),employmentWeekReviews:compensationEvidence(e.employmentWeekReviews),employmentWorkweekBoundaries:compensationEvidence(e.employmentWorkweekBoundaries),employmentCompensation:compensationEvidence(e.employmentCompensation),splitCompensation:compensationEvidence(e.splitCompensation),splitLeaveBasisMinutes:e.splitLeaveBasisMinutes, gross: e.grossPayCents, reimbursements: e.reimbursementCents,
          deductions: e.totalDeductionCents,retirementPlans:compensationEvidence(e.retirementPlans),benefitCollection:compensationEvidence(e.benefitCollection),ficaWageBasis:compensationEvidence(e.ficaWageBasis),incomeTaxWageBasis:compensationEvidence(e.incomeTaxWageBasis), sickAccrual:e.sickLeaveAccrualMinutes,sickEligibility:e.sickLeaveEligibility?[e.sickLeaveEligibility.priorPeriodStart,e.sickLeaveEligibility.priorPeriodEnd,e.sickLeaveEligibility.priorFrequency,e.sickLeaveEligibility.priorRunId,e.sickLeaveEligibility.priorWorkedMinutes,e.sickLeaveEligibility.firstEmploymentPeriod===true]:null,sickCorrection:compensationEvidence(e.sickLeaveCorrection),sickPolicy:e.sickLeaveAccrualPolicy?[e.sickLeaveAccrualPolicy.version,e.sickLeaveAccrualPolicy.method,e.sickLeaveAccrualPolicy.annualCapMinutes,e.sickLeaveAccrualPolicy.balanceCapMinutes]:null,sickFraction:e.sickLeaveFraction?[e.sickLeaveFraction.version,e.sickLeaveFraction.remainderBefore,e.sickLeaveFraction.remainderAfter,e.sickLeaveFraction.sourceRunId,e.sickLeaveFraction.source]:null,sickBalanceBefore:e.sickLeaveBalanceBeforeMinutes,sickYearAccruedBefore:e.sickLeaveYearAccruedBeforeMinutes, employerTaxes:[e.futaTaxCents,e.mdUiTaxCents], nativeWithholding:[e.federalIncomeTaxCents,e.stateIncomeTaxCents], fica: [e.socialSecurityTaxCents,e.medicareTaxCents,e.additionalMedicareTaxCents],
          entries: e.entries.map(t => ({id:t.id,start:new Date(t.clockIn).toISOString(),end:new Date(t.clockOut).toISOString(),breaks:t.unpaidBreakMinutes,status:t.status})),
        })).sort((a,b)=>Number(a.id)-Number(b.id)))

export async function loadRunPreview(db,facility,run){
 if(run.run_kind==='OFF_CYCLE_PTO')return loadOffCyclePtoPreview(db,facility,run.pay_period_id,new Date(run.payment_date).toISOString().slice(0,10),run.offcycle_context,run.id)
 if(run.run_kind==='OFF_CYCLE_BONUS')return loadOffCycleBonusPreview(db,facility,run.pay_period_id,new Date(run.payment_date).toISOString().slice(0,10),run.offcycle_context,run.id)
 return run.run_kind==='OFF_CYCLE_REIMBURSEMENT'?loadReimbursementPreview(db,facility,run.offcycle_context?.adjustmentId,new Date(run.payment_date).toISOString().slice(0,10),run.id):loadPreview(db,facility,run.pay_period_id,run.payment_date,run.id)
}

async function loadPreview(pool,facilityId,payPeriodId,paymentDate=null,excludedRunId=null){
 const result=await includeAuthorizedCorrections(pool,facilityId,payPeriodId,paymentDate,excludedRunId,loadBasePreview)
 return regularRetirementPayroll(pool,facilityId,result,excludedRunId,inputs=>includeAuthorizedCorrections(pool,facilityId,payPeriodId,paymentDate,excludedRunId,(...args)=>{while(args.length<9)args.push(undefined);return loadBasePreview(...args,inputs)}))
}
async function loadBasePreview(pool, facilityId, payPeriodId, paymentDate = null, excludedRunId = null, skipHistoricalCoverage = false, timeOverride = null, additionalAdjustments = [], leaveCorrection = null, retirement401kByEmployee = {}) {
  await ensureEmployerSetup(pool,facilityId)
  const [settingsResult, employeesResult, entriesResult, tasksResult, ytdResult, periodResult, adjustmentResult, leaveAccrualResult] = await Promise.all([
    pool.query('SELECT * FROM payroll_settings WHERE facility_id=$1', [facilityId]),
    pool.query(`SELECT e.*,ep.hire_date,ep.termination_date,ep.payroll_employment_periods,ep.pay_type,ep.pay_basis_count,
        CASE WHEN ep.pay_type='HOURLY' THEN 'NONEXEMPT' ELSE e.overtime_classification END AS overtime_classification,
        CASE WHEN ep.pay_type='HOURLY' THEN NULL ELSE e.annual_salary_cents END AS annual_salary_cents,
        CASE WHEN ep.pay_type='HOURLY' THEN NULL ELSE e.salary_review END AS salary_review,
        CASE WHEN ep.pay_type='HOURLY' THEN COALESCE((SELECT pr.hourly_rate_cents FROM payroll_pay_rate pr WHERE pr.facility_id=e.facility_id AND pr.employee_id=e.id AND pr.cancelled_at IS NULL AND pr.effective_on<=GREATEST(p.period_start,ep.hire_date) ORDER BY pr.effective_on DESC LIMIT 1),e.hourly_rate_cents) ELSE e.hourly_rate_cents END AS hourly_rate_cents
      FROM payroll_employee e JOIN payroll_pay_period p ON p.id=$2 AND p.facility_id=e.facility_id
      CROSS JOIN LATERAL (
        SELECT MIN(h.started_on) AS hire_date,MIN(h.pay_type) AS pay_type,COUNT(DISTINCT h.pay_type)::int AS pay_basis_count,
          CASE WHEN BOOL_OR(h.ended_on IS NULL) THEN NULL ELSE MAX(h.ended_on) END AS termination_date,
          JSONB_AGG(JSONB_BUILD_OBJECT('start',h.started_on,'end',h.ended_on) ORDER BY h.started_on) AS payroll_employment_periods
        FROM payroll_employment_period h WHERE h.facility_id=e.facility_id AND h.employee_id=e.id
          AND h.started_on<=p.period_end AND (h.ended_on IS NULL OR h.ended_on>=p.period_start)
          AND (e.employment_status IN ('ACTIVE','LEAVE','TERMINATED') OR
            (e.employment_status='ONBOARDING' AND h.started_on<e.hire_date AND h.ended_on IS NOT NULL))
      ) ep
      WHERE e.facility_id=$1 AND ep.hire_date IS NOT NULL`, [facilityId,payPeriodId]),
    pool.query(`WITH overrides AS (SELECT * FROM jsonb_to_recordset($3::jsonb) AS o("entryId" bigint,"employeeId" bigint,"clockIn" timestamptz,"clockOut" timestamptz,"unpaidBreakMinutes" integer)), correction_time AS (
        SELECT id,employee_id,facility_id,status,clock_in,clock_out,unpaid_break_minutes FROM payroll_effective_time_entry t
        WHERE NOT EXISTS(SELECT 1 FROM overrides o WHERE t.facility_id=$1 AND t.employee_id=o."employeeId" AND t.id=o."entryId")
        UNION ALL SELECT COALESCE("entryId",0),"employeeId",$1::bigint,'APPROVED',"clockIn","clockOut",COALESCE("unpaidBreakMinutes",0) FROM overrides
      ) SELECT t.id,t.employee_id,t.status,d.day::date::text AS work_date,
        (SELECT pr.hourly_rate_cents FROM payroll_pay_rate pr WHERE pr.employee_id=t.employee_id AND pr.facility_id=t.facility_id AND pr.cancelled_at IS NULL AND pr.effective_on<=d.day::date ORDER BY pr.effective_on DESC LIMIT 1) AS work_rate_cents,
        GREATEST(t.clock_in,d.day::timestamp AT TIME ZONE ps.timezone) AS clock_in,
        CASE WHEN t.clock_out IS NULL THEN NULL ELSE LEAST(t.clock_out,(d.day::date+1)::timestamp AT TIME ZONE ps.timezone) END AS clock_out,
        CASE WHEN (t.clock_in AT TIME ZONE ps.timezone)::date=((t.clock_out-interval '1 microsecond') AT TIME ZONE ps.timezone)::date THEN t.unpaid_break_minutes ELSE 0 END AS unpaid_break_minutes,
        t.unpaid_break_minutes>0 AND (t.clock_in AT TIME ZONE ps.timezone)::date<>((t.clock_out-interval '1 microsecond') AT TIME ZONE ps.timezone)::date AS ambiguous_break,
        d.day::date BETWEEN p.period_start AND p.period_end AS in_period,
        d.day::date < p.period_start AS before_period
      FROM correction_time t
      JOIN payroll_pay_period p ON p.id=$2 AND p.facility_id=$1
      JOIN payroll_settings ps ON ps.facility_id=p.facility_id
      CROSS JOIN LATERAL generate_series(
        GREATEST((t.clock_in AT TIME ZONE ps.timezone)::date,p.period_start-6)::timestamp,
        LEAST((COALESCE(t.clock_out-interval '1 microsecond',t.clock_in) AT TIME ZONE ps.timezone)::date,p.period_end+6)::timestamp,
        interval '1 day') d(day)
      WHERE t.facility_id=$1 AND t.status <> 'REJECTED'
        AND COALESCE(t.clock_out,'infinity'::timestamptz) > ((p.period_start - 6)::timestamp AT TIME ZONE ps.timezone)
        AND t.clock_in < ((p.period_end + 7)::timestamp AT TIME ZONE ps.timezone)
      ORDER BY clock_in,t.id`, [facilityId,payPeriodId,JSON.stringify(timeOverride?(Array.isArray(timeOverride)?timeOverride:[timeOverride]):[])]),
    pool.query(`SELECT * FROM payroll_compliance_task WHERE facility_id=$1`, [facilityId]),
    pool.query(`WITH target AS (SELECT COALESCE($3::date,pay_date) AS pay_date FROM payroll_pay_period WHERE id=$2 AND facility_id=$1), wages AS (
        SELECT employee_id, gross_amount_cents AS amount FROM payroll_historical_payment
        WHERE facility_id=$1 AND payment_date <= (SELECT pay_date FROM target) AND EXTRACT(YEAR FROM payment_date)=EXTRACT(YEAR FROM (SELECT pay_date FROM target))
        UNION ALL
        SELECT re.employee_id, (re.regular_pay_cents+re.overtime_pay_cents+re.other_taxable_pay_cents) AS amount
        FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id JOIN payroll_pay_period p ON p.id=r.pay_period_id
        WHERE r.facility_id=$1 AND r.status='FINALIZED' AND (r.pay_period_id<>$2 OR r.run_kind<>'REGULAR') AND COALESCE(r.payment_date,p.pay_date) <= (SELECT pay_date FROM target) AND EXTRACT(YEAR FROM COALESCE(r.payment_date,p.pay_date))=EXTRACT(YEAR FROM (SELECT pay_date FROM target))
      ) SELECT employee_id, COALESCE(SUM(amount),0)::bigint AS ytd FROM wages GROUP BY employee_id`, [facilityId, payPeriodId,paymentDate]),
    pool.query('SELECT *,pay_date AS scheduled_pay_date,COALESCE($3::date,pay_date) AS pay_date FROM payroll_pay_period WHERE id=$1 AND facility_id=$2', [payPeriodId, facilityId,paymentDate]),
    pool.query(`SELECT a.* FROM payroll_recurring_adjustment a JOIN payroll_pay_period p ON p.id=$2 AND p.facility_id=$1
      WHERE a.facility_id=$1 AND a.status='ACTIVE' AND NOT EXISTS(SELECT 1 FROM payroll_run oc WHERE oc.id=a.offcycle_run_id AND oc.status<>'VOID') AND (a.bonus_pay_period_id IS NULL OR a.bonus_pay_period_id=p.id) AND a.active_from <= p.period_end
        AND (a.active_to IS NULL OR a.active_to >= p.period_start) ORDER BY a.employee_id, a.id`, [facilityId, payPeriodId]),
    pool.query(`SELECT l.employee_id, COALESCE(SUM(l.minutes) FILTER(WHERE (l.minutes>0 OR l.transaction_kind='CORRECTION_ACCRUAL') AND l.transaction_kind NOT IN ('OPENING_BALANCE','RESTORATION','ROLLOVER') AND EXTRACT(YEAR FROM l.transaction_date)=EXTRACT(YEAR FROM COALESCE($3::date,p.pay_date))),0)::int AS accrued,COALESCE(SUM(l.minutes),0)::int AS balance
      FROM payroll_leave_transaction l JOIN payroll_pay_period p ON p.id=$2 AND p.facility_id=$1
      WHERE l.facility_id=$1 AND l.leave_type='MD_SICK_SAFE' AND l.transaction_date<=COALESCE($3::date,p.pay_date)
      GROUP BY l.employee_id`, [facilityId, payPeriodId,paymentDate]),
  ])
  if (!periodResult.rows[0]) return null
  const compensationSegments=await employmentCompensationAt(pool,facilityId,periodResult.rows[0])
  const settings = {...mapSettings(settingsResult.rows[0]),payFrequency:periodResult.rows[0].frequency}
  const employees = (await salaryRowsAt(pool,facilityId,employeesResult.rows,periodResult.rows[0].period_start)).map(mapEmployee)
  for(const employee of employees)employee.compensationSegments=compensationSegments.filter(s=>s.employeeId===Number(employee.id))
  const employmentBoundaries=await employmentWorkweekBoundaries(pool,facilityId,employees.map(e=>e.id),periodResult.rows[0],settings)
  const taxElections=(await pool.query('SELECT * FROM payroll_tax_election WHERE facility_id=$1',[facilityId])).rows
  const taxYear=new Date(periodResult.rows[0].pay_date).getUTCFullYear()
  for(const employee of employees) { const election=taxElections.find(e=>Number(e.employee_id)===Number(employee.id) && e.tax_year===taxYear); employee.taxElection=election?{...election.elections,verified:true}:null }

  const mappedEntries = entriesResult.rows.map((row) => ({
    id: row.id, employeeId: row.employee_id, clockIn: row.clock_in, clockOut: row.clock_out, workDate:row.work_date,
    hourlyRateCents: row.work_rate_cents, unpaidBreakMinutes: row.unpaid_break_minutes, ambiguousBreak: row.ambiguous_break, status: row.status, inPeriod: row.in_period, beforePeriod: row.before_period,
  }))
  const employmentWeekReviews=await employmentWorkweekReviews(pool,facilityId,employmentWorkweekReviewScopes(employmentBoundaries,periodResult.rows[0],settings),mappedEntries,excludedRunId)
  await revalidateWorkweekAllocations(pool,facilityId,employmentWeekReviews)
  if(!skipHistoricalCoverage)await revalidateHistoricalAllocationCoverage(pool,facilityId,employmentWeekReviews,id=>loadBasePreview(pool,facilityId,id,null,excludedRunId,true),new Date(paymentDate||periodResult.rows[0].pay_date).toISOString().slice(0,10))
  for(const review of employmentWeekReviews)review.paymentReconciliation=reconcileAllocationPayments(review)
  await revalidateSettlementAuthorizations(pool,facilityId,employmentWeekReviews)
  for(const employee of employees)employee.authorizedWorkweeks=employmentWeekReviews.filter(r=>r.employeeId===Number(employee.id))
  const employmentCovers=(employeeId,date)=>employees.find(e=>Number(e.id)===Number(employeeId))?.employmentPeriods?.some(p=>date>=p.start&&(!p.end||date<=p.end))===true
  const excludedEmploymentEntries=mappedEntries.filter(entry=>entry.inPeriod&&!employmentCovers(entry.employeeId,entry.workDate))
  const entries = mappedEntries.filter((entry) => entry.inPeriod&&employmentCovers(entry.employeeId,entry.workDate))
  const priorApprovedMinutesByEmployee = {}
  const priorApprovedSegmentsByEmployee = {}
  const priorCarryInWarnings = mappedEntries.filter(e=>(e.inPeriod||e.beforePeriod)&&e.ambiguousBreak).map(e=>({code:'OVERNIGHT_BREAK_TIMING_REQUIRED',severity:'critical',message:'An overnight shift has an unpaid break without its time recorded. Split the time entry at midnight with the break on the correct day before approving payroll.',blocking:true,employeeId:e.employeeId}))
  for (const entry of mappedEntries.filter((item) => item.beforePeriod)) {
    if (!entry.clockOut || entry.status !== 'APPROVED') {
      priorCarryInWarnings.push({ code: 'PRIOR_WORKWEEK_TIME_UNVERIFIED', severity: 'critical', message: 'Time before this pay period falls in an overlapping workweek and is not approved.', blocking: true, employeeId: entry.employeeId })
      continue
    }
    const employeeWeeks = priorApprovedMinutesByEmployee[entry.employeeId] ?? {}
    const week = workweekStartFor(entry.clockIn, settings.workweekStartsOn, settings.timezone)
    employeeWeeks[week] = Number(employeeWeeks[week] ?? 0) + calculateWorkedMinutes(entry.clockIn, entry.clockOut, entry.unpaidBreakMinutes)
    const priorWeeks=priorApprovedSegmentsByEmployee[entry.employeeId]??{}
    priorWeeks[week]=[...(priorWeeks[week]??[]),{minutes:calculateWorkedMinutes(entry.clockIn,entry.clockOut,entry.unpaidBreakMinutes),hourlyRateCents:entry.hourlyRateCents}]
    priorApprovedSegmentsByEmployee[entry.employeeId]=priorWeeks
    priorApprovedMinutesByEmployee[entry.employeeId] = employeeWeeks
  }
  const tasks = tasksResult.rows.map((row) => ({ taskKey: row.task_key, title: row.title, status: row.status, severity: row.severity }))
  const ytdByEmployee = Object.fromEntries(ytdResult.rows.map((row) => [row.employee_id, Number(row.ytd)]))
  const adjustments = adjustmentResult.rows.map((row) => ({ adjustmentId:Number(row.id),bonusPayPeriodId:row.bonus_pay_period_id?Number(row.bonus_pay_period_id):null,employeeId: row.employee_id, kind: row.kind, name: row.name, sourceRequestId:row.source_request_id?Number(row.source_request_id):undefined, amountCents: Number(row.amount_cents), bonusReview:row.bonus_review, taxTreatmentVerified: row.tax_treatment_verified }))
  adjustments.push(...additionalAdjustments)
  const bonusWarnings=[]
  for(const adjustment of [...adjustments])if(adjustment.kind==='BONUS'&&adjustment.bonusReview?.classification==='NONDISCRETIONARY'){
    try{
      const review=adjustment.bonusReview
      if(!review.allocationFingerprint||review.allocationMethod!=='PROPORTIONAL_EARNED_HOURS'||!review.allocationMethodVerified)throw new Error('Recalculate and save the earned-bonus agreement before payment.')
      const allocation=await previewEarnedBonus(pool,facilityId,adjustment.employeeId,{amountCents:adjustment.amountCents,earnedStart:review.earnedStart,earnedEnd:review.earnedEnd})
      if(allocation.fingerprint!==review.allocationFingerprint)throw new Error('Earned-bonus workweek inputs changed after review. Pause the outdated bonus, recalculate, and record its replacement.')
      const coverage=await loadBonusPaymentCoverage(pool,facilityId,adjustment.employeeId,allocation,periodResult.rows[0])
      adjustment.bonusAllocation={version:allocation.version,method:allocation.method,earnedStart:allocation.earnedStart,earnedEnd:allocation.earnedEnd,bonusCents:allocation.bonusCents,additionalOvertimeCents:allocation.additionalOvertimeCents,weeks:allocation.weeks,fingerprint:allocation.fingerprint,coverage}
      if(allocation.additionalOvertimeCents>0)adjustments.push({employeeId:adjustment.employeeId,kind:'BONUS_OVERTIME',bonusAdjustmentId:adjustment.adjustmentId,name:`${adjustment.name} — additional overtime`,amountCents:allocation.additionalOvertimeCents,taxTreatmentVerified:true})
    }catch(error){bonusWarnings.push({employeeId:Number(adjustment.employeeId),code:'BONUS_PAYMENT_RECONCILIATION',severity:'critical',blocking:true,message:error.message})}
  }
  const paidLeave = await pool.query(`SELECT l.id,l.request_id,l.employee_id,l.leave_date::text,l.minutes,ROUND(COALESCE((SELECT pr.hourly_rate_cents FROM payroll_pay_rate pr WHERE pr.employee_id=l.employee_id AND pr.facility_id=l.facility_id AND pr.cancelled_at IS NULL AND pr.effective_on<=l.leave_date ORDER BY pr.effective_on DESC LIMIT 1),l.hourly_rate_cents)::bigint*l.minutes/60.0)::bigint AS amount
    FROM payroll_paid_leave l JOIN payroll_pay_period p ON p.id=$2 AND p.facility_id=l.facility_id
    JOIN payroll_employee_request q ON q.id=l.request_id AND q.employee_id=l.employee_id AND q.facility_id=l.facility_id AND q.status<>'CANCELLED'
    WHERE l.facility_id=$1 AND l.leave_date BETWEEN p.period_start AND p.period_end`,[facilityId,payPeriodId])
  for (const leave of paidLeave.rows.filter(l=>employmentCovers(l.employee_id,l.leave_date))) adjustments.push({employeeId:leave.employee_id,kind:'PAID_LEAVE',name:'Paid leave',leaveId:Number(leave.id),sourceRequestId:Number(leave.request_id),amountCents:Number(leave.amount),minutes:Number(leave.minutes),leaveDate:leave.leave_date,taxTreatmentVerified:true})
  const yearAccruedByEmployee = Object.fromEntries(leaveAccrualResult.rows.map((row) => [row.employee_id, Number(row.accrued)]))
  const balancesByEmployee=Object.fromEntries(leaveAccrualResult.rows.map(row=>[row.employee_id,Number(row.balance)]))
  const salaryBoundaries=(await pool.query('SELECT employee_id,effective_on FROM payroll_salary_change WHERE facility_id=$1 AND cancelled_at IS NULL AND effective_on>$2 AND effective_on<=$3',[facilityId,periodResult.rows[0].period_start,periodResult.rows[0].period_end])).rows
  const leaveWarnings=salaryBoundaries.filter(row=>!employees.some(e=>Number(e.id)===Number(row.employee_id)&&new Date(e.hireDate).toISOString().slice(0,10)===new Date(row.effective_on).toISOString().slice(0,10))&&!compensationSegments.some(s=>s.employeeId===Number(row.employee_id)&&s.payType==='SALARY'&&s.employmentStart===new Date(row.effective_on).toISOString().slice(0,10)&&compensationSegments.some(h=>h.employeeId===s.employeeId&&h.payType==='HOURLY'))).map(row=>({employeeId:Number(row.employee_id),code:'SALARY_CHANGE_PERIOD_BOUNDARY',severity:'critical',blocking:true,message:'A salary change falls inside this pay period. Restore complete period boundaries before calculating salary.'}))
  for(const employeeId of new Set([...excludedEmploymentEntries.map(e=>Number(e.employeeId)),...paidLeave.rows.filter(l=>!employmentCovers(l.employee_id,l.leave_date)).map(l=>Number(l.employee_id))]))leaveWarnings.push({employeeId,code:'PAYROLL_EMPLOYMENT_RECONCILIATION',severity:'critical',blocking:true,message:'Recorded time or paid leave falls outside an employment period eligible for payroll. Complete hiring activation or reconcile the employment dates and work records before paying this period.'})
  const pendingPayouts=(await pool.query("SELECT * FROM payroll_leave_payout WHERE facility_id=$1 AND pay_period_id=$2 AND payment_mode='REGULAR' AND status='RESERVED' ORDER BY id",[facilityId,payPeriodId])).rows
  for(const payout of pendingPayouts){
    adjustments.push({employeeId:payout.employee_id,kind:'LEAVE_PAYOUT',name:'Unused PTO payout',amountCents:Number(payout.amount_cents),minutes:Number(payout.minutes),taxTreatmentVerified:true,leavePayout:{id:Number(payout.id),hourlyRateCents:Number(payout.hourly_rate_cents),fingerprint:payout.review.fingerprint}})
    if(new Date(periodResult.rows[0].pay_date)<new Date(payout.reserved_on))leaveWarnings.push({employeeId:Number(payout.employee_id),code:'PTO_PAYOUT_PAYMENT_DATE',severity:'critical',blocking:true,message:'The PTO payout payment date precedes its reservation. Rebuild payroll with the actual payment date.'})
    if(!employees.some(e=>Number(e.id)===Number(payout.employee_id)))leaveWarnings.push({employeeId:Number(payout.employee_id),code:'PTO_PAYOUT_EMPLOYEE_MISSING',severity:'critical',blocking:true,message:'A reserved PTO payout employee is missing from this payroll. Restore their employment dates or cancel the reservation.'})
  }
  leaveWarnings.push(...bonusWarnings)
  for(const boundary of employmentBoundaries)leaveWarnings.push({employeeId:boundary.employeeId,code:'EMPLOYMENT_WORKWEEK_BOUNDARY',severity:'critical',blocking:true,message:`The workweek starting ${boundary.week} crosses a salary hiring agreement (${boundary.beforeEmploymentEnd} / ${boundary.afterEmploymentStart}). Reconcile the full workweek, including adjacent pay periods, before approval.`})
  for(const segment of compensationSegments.filter(s=>s.issue))leaveWarnings.push({employeeId:segment.employeeId,code:'EMPLOYMENT_COMPENSATION_MISSING',severity:'critical',blocking:true,message:`${segment.start} – ${segment.end}: ${segment.issue}`})
  const priorWeekly=await previousLeavePeriodHistory(pool,facilityId,periodResult.rows[0])
  let preview = buildPayrollPreview({ settings, employees, entries, complianceTasks: tasks, ytdByEmployee, priorApprovedMinutesByEmployee, priorApprovedSegmentsByEmployee, adjustments, taxYear, retirement401kByEmployee, payPeriod:periodResult.rows[0] })
  for (const employeePreview of preview.employees) {
    employeePreview.employmentWeekReviews=employmentWeekReviews.filter(r=>r.employeeId===Number(employeePreview.employeeId))
    employeePreview.employmentWorkweekBoundaries=employmentBoundaries.filter(b=>b.employeeId===Number(employeePreview.employeeId))
    employeePreview.employmentCompensation=compensationSegments.filter(s=>s.employeeId===Number(employeePreview.employeeId))
    employeePreview.followingWorkweekEntries=mappedEntries.filter(entry=>!entry.inPeriod&&!entry.beforePeriod&&Number(entry.employeeId)===Number(employeePreview.employeeId)&&employeePreview.workweekEarnings.some(w=>w.week===workweekStartFor(entry.clockIn,settings.workweekStartsOn,settings.timezone))).map(entry=>({
      id:entry.id,week:workweekStartFor(entry.clockIn,settings.workweekStartsOn,settings.timezone),clockIn:entry.clockIn,clockOut:entry.clockOut,hourlyRateCents:entry.hourlyRateCents,status:entry.status,ambiguousBreak:entry.ambiguousBreak,
      minutes:entry.clockOut&&!entry.ambiguousBreak?calculateWorkedMinutes(entry.clockIn,entry.clockOut,entry.unpaidBreakMinutes):null,
    }))
    const paidHistory=await loadWorkweekPaymentHistory(pool,facilityId,employeePreview.employeeId,employeePreview.workweekEarnings.map(w=>w.week),new Date(periodResult.rows[0].period_start).toISOString().slice(0,10))
    employeePreview.workweekPaidHistory=paidHistory.map(w=>({...w,historyVerified:w.issues.length===0&&w.paidWorkedMinutes===Number(priorApprovedMinutesByEmployee[employeePreview.employeeId]?.[w.week]??0)}))
    employeePreview.workweekSettlements=employeePreview.authorizedSettlement?[]:reviewWorkweekSettlements(employeePreview,priorApprovedSegmentsByEmployee[employeePreview.employeeId]??{},new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))
    try {
    const prior=priorWeekly.find(p=>Number(p.employee_id)===Number(employeePreview.employeeId))
    const hire=employees.find(e=>Number(e.id)===Number(employeePreview.employeeId))?.hireDate
    const firstPeriod=hire&&new Date(hire)>=new Date(periodResult.rows[0].period_start)
    employeePreview.sickLeaveEligibility=prior?.count===1?{priorPeriodStart:prior.period_start,priorPeriodEnd:prior.period_end,priorFrequency:prior.frequency,priorRunId:prior.run_id,priorWorkedMinutes:prior.minutes}:firstPeriod?{priorWorkedMinutes:0,firstEmploymentPeriod:true}:null
    employeePreview.sickLeaveBalanceBeforeMinutes=Number(balancesByEmployee[employeePreview.employeeId]??0)
    employeePreview.sickLeaveYearAccruedBeforeMinutes=Number(yearAccruedByEmployee[employeePreview.employeeId]??0)
    const frontload=employees.find(e=>Number(e.id)===Number(employeePreview.employeeId))?.sickLeavePolicy==='FRONTLOAD'
    employeePreview.sickLeaveAccrualPolicy={version:1,method:frontload?'FRONTLOAD':'ACCRUAL',annualCapMinutes:2400,balanceCapMinutes:3840}
    let remainder=await loadLeaveRemainder(pool,facilityId,employeePreview.employeeId,payPeriodId,periodResult.rows[0].pay_date)
    const employeeLeaveCorrection=Array.isArray(leaveCorrection)?leaveCorrection.find(c=>Number(c.employeeId)===Number(employeePreview.employeeId)):leaveCorrection
    if(employeeLeaveCorrection&&Number(employeeLeaveCorrection.employeeId)===Number(employeePreview.employeeId)){
      const corrected=correctionLeaveContext({...employeeLeaveCorrection,paymentDate:new Date(periodResult.rows[0].pay_date).toISOString().slice(0,10),balanceMinutes:employeePreview.sickLeaveBalanceBeforeMinutes,yearAccruedMinutes:employeePreview.sickLeaveYearAccruedBeforeMinutes,remainder,eligibility:employeePreview.sickLeaveEligibility})
      employeePreview.sickLeaveBalanceBeforeMinutes=corrected.balanceMinutes
      employeePreview.sickLeaveYearAccruedBeforeMinutes=corrected.yearAccruedMinutes
      employeePreview.sickLeaveEligibility=corrected.eligibility
      employeePreview.sickLeaveCorrection=corrected.evidence
      remainder=corrected.remainder
    }
    const accrual=frontload?{minutes:0,remainder:remainder.remainder}:calculateMarylandSickAccrual({
      priorRemainder:remainder.remainder,
      workedMinutes: employeePreview.splitLeaveBasisMinutes ?? employeePreview.salaryCalculation?.leaveBasisMinutes ?? (employeePreview.regularMinutes + employeePreview.overtimeMinutes),
      payFrequency: settings.payFrequency,
      previousPeriodWorkedMinutes:employeePreview.sickLeaveEligibility?.priorWorkedMinutes,
      currentBalanceMinutes:employeePreview.sickLeaveBalanceBeforeMinutes,
      yearAccruedMinutes: employeePreview.sickLeaveYearAccruedBeforeMinutes,
    })
    employeePreview.sickLeaveAccrualMinutes=accrual.minutes
    employeePreview.sickLeaveFraction={version:1,remainderBefore:remainder.remainder,remainderAfter:accrual.remainder,sourceRunId:remainder.sourceRunId,source:remainder.source}
    } catch(error){employeePreview.sickLeaveAccrualMinutes=0;leaveWarnings.push({employeeId:employeePreview.employeeId,code:error.code||'WEEKLY_LEAVE_HISTORY_REQUIRED',severity:'critical',blocking:true,message:error.message})}
  }
  const weightedSettlementsByEmployee={}
  const settlementWarnings=[]
  for(const employeePreview of preview.employees) {
    const required=employeePreview.workweekSettlements.filter(w=>w.requiresWeighted)
    if(!required.length)continue
    const unresolved=required.filter(w=>!['PREMIUM_DUE','SETTLED'].includes(w.status))
    if(unresolved.length)settlementWarnings.push({employeeId:employeePreview.employeeId,code:'WEIGHTED_WORKWEEK_REVIEW',severity:'critical',blocking:true,message:`Complete weighted workweek review before approval: ${unresolved.map(w=>`${w.week} (${w.status})`).join(', ')}.`})
    else weightedSettlementsByEmployee[employeePreview.employeeId]=required
  }
  if(Object.keys(weightedSettlementsByEmployee).length) {
    const previous=preview
    preview=buildPayrollPreview({settings,employees,entries,complianceTasks:tasks,ytdByEmployee,priorApprovedMinutesByEmployee,priorApprovedSegmentsByEmployee,adjustments,taxYear,weightedSettlementsByEmployee,retirement401kByEmployee,payPeriod:periodResult.rows[0]})
    for(const employeePreview of preview.employees) {
      const context=previous.employees.find(e=>Number(e.employeeId)===Number(employeePreview.employeeId))
      for(const key of ['employmentWeekReviews','employmentWorkweekBoundaries','employmentCompensation','followingWorkweekEntries','workweekPaidHistory','sickLeaveAccrualMinutes','sickLeaveEligibility','sickLeaveBalanceBeforeMinutes','sickLeaveYearAccruedBeforeMinutes','sickLeaveFraction','sickLeaveAccrualPolicy','sickLeaveCorrection'])employeePreview[key]=context[key]
      employeePreview.workweekSettlements=context.workweekSettlements.map(w=>({...w,appliedToPayroll:employeePreview.weightedOvertimeApplied&&w.requiresWeighted}))
    }
  }
  for(let i=leaveWarnings.length-1;i>=0;i--){
    const w=leaveWarnings[i],settled=preview.employees.find(e=>Number(e.employeeId)===Number(w.employeeId))?.authorizedSettlement
    if(w.code==='EMPLOYMENT_WORKWEEK_BOUNDARY'&&settled&&employmentBoundaries.filter(b=>Number(b.employeeId)===Number(w.employeeId)).every(b=>settled.some(s=>s.week===b.week)))leaveWarnings.splice(i,1)
  }
  preview.warnings.push(...settlementWarnings,...leaveWarnings)
  for(const employeePreview of preview.employees)employeePreview.warnings.push(...[...settlementWarnings,...leaveWarnings].filter(w=>Number(w.employeeId)===Number(employeePreview.employeeId)))
  const laterPayroll=await pool.query(`SELECT r.id FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 AND (r.pay_period_id<>$2 OR r.run_kind<>'REGULAR') AND r.run_kind<>'OFF_CYCLE_REIMBURSEMENT' AND r.status IN ('APPROVED','FINALIZED') AND COALESCE(r.payment_date,p.pay_date)>$3::date AND EXTRACT(YEAR FROM COALESCE(r.payment_date,p.pay_date))=EXTRACT(YEAR FROM $3::date) LIMIT 1`,[facilityId,payPeriodId,periodResult.rows[0].pay_date])
  if(laterPayroll.rows.length)preview.warnings.push({code:'PAYMENT_ORDER_REVIEW_REQUIRED',severity:'critical',message:'Later-dated payroll is already approved or finalized in this tax year. Resolve its year-to-date tax impact before approving an earlier payment.',blocking:true})
  if(new Date(periodResult.rows[0].pay_date)<new Date(periodResult.rows[0].period_end))preview.warnings.push({code:'PAYMENT_BEFORE_PERIOD_END',severity:'critical',message:'Payment for this full period cannot precede its end. Use the appropriate completed pay period.',blocking:true})
  const unpaidEarlier=await pool.query(`SELECT r.id FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 AND (r.pay_period_id<>$2 OR r.run_kind<>'REGULAR') AND r.run_kind<>'OFF_CYCLE_REIMBURSEMENT' AND r.status='APPROVED' AND COALESCE(r.payment_date,p.pay_date)<=$3::date AND EXTRACT(YEAR FROM COALESCE(r.payment_date,p.pay_date))=EXTRACT(YEAR FROM $3::date) LIMIT 1`,[facilityId,payPeriodId,periodResult.rows[0].pay_date])
  if(unpaidEarlier.rows.length)preview.warnings.push({code:'PRIOR_PAYMENT_NOT_FINALIZED',severity:'critical',message:'Finalize the earlier approved payment before calculating this run so year-to-date wages include it.',blocking:true})
  preview.payPeriodId=Number(payPeriodId)
  preview.paymentDate=periodResult.rows[0].pay_date
  preview.warnings.push(...priorCarryInWarnings)
  await applyMonthlyBenefits(pool,facilityId,preview,employeesResult.rows,settingsResult.rows[0],periodResult.rows[0].pay_date,excludedRunId)
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

export function registerPayrollRoutes(app, pool, {retirementReceiptReader,retirementAllocationTransfer,retirementSftpVerifier,remittanceNow=()=>new Date(),now=()=>new Date(),invitationSender=sendEmail,paymentFetcher=fetch,quickbooksFetcher=fetch,carrierNoticeSender} = {}) {
  registerIncomeTaxBasisReviewRoutes(app,pool)
  registerFilingIdentityRoutes(app,pool)
  registerOvertimeReportingRoutes(app,pool)
  registerYearEndPreparationRoutes(app,pool)
  registerCorrectionPaymentAuthorizationRoutes(app,pool,loadBasePreview)
  registerCorrectionPaymentPreviewRoutes(app,pool,loadBasePreview)
  registerTimeCorrectionCalculationRoutes(app,pool,loadBasePreview)
  registerHistoricalPaymentEntryRoutes(app,pool)
  registerHistoricalAllocationPreviewRoutes(app,pool,loadPreview)
  registerHistoricalAllocationReviewRoutes(app,pool,loadPreview)
  registerWorkweekAllocationApprovalRoutes(app,pool,loadPreview)
  registerWorkweekSettlementAuthorizationRoutes(app,pool,loadPreview)
  registerEmploymentPeriodRoutes(app,pool)
  registerPayScheduleRoutes(app,pool)
  registerLeaveYearCloseRoutes(app,pool)
  registerLeaveYearPolicyRoutes(app,pool)
  registerLeaveFractionRoutes(app,pool)
  registerSalaryReviewRoutes(app,pool)
  registerSalaryChangeRoutes(app,pool)
  registerOffCycleReimbursementRoutes(app,pool)
  registerLeavePayoutRoutes(app,pool)
  registerNoWorkCloseoutRoutes(app,pool)
  registerPayBasisRoutes(app,pool)
  registerFinalPayRoutes(app,pool)
  registerRehireReviewRoutes(app,pool)
  registerRehireRoutes(app,pool)
  registerBonusRoutes(app,pool)
  registerEarnedBonusPreviewRoutes(app,pool)
  registerMarylandWithholdingCalendarRoutes(app,pool)
  registerMarylandUiCalendarRoutes(app,pool)
  registerFederalTaxCalendarRoutes(app,pool)
  registerTaxReconciliationRoutes(app, pool, {now})
  registerCompensationAdminRoutes(app, pool)
  registerWorkforceAdminRoutes(app, pool)
  registerQuickbooksAdminRoutes(app, pool,{fetcher:quickbooksFetcher})
  registerPaymentAccountingMappingRoutes(app,pool,{fetcher:quickbooksFetcher})
  registerCarrierSettlementMappingRoutes(app,pool,{fetcher:quickbooksFetcher})
  registerCarrierSettlementPreviewRoutes(app,pool,{fetcher:quickbooksFetcher,paymentFetcher})
  registerCarrierSettlementAuthorizationRoutes(app,pool,{fetcher:quickbooksFetcher,paymentFetcher})
  registerCarrierSettlementPostingRoutes(app,pool,{fetcher:quickbooksFetcher,paymentFetcher})
  registerCarrierSettlementReleaseRoutes(app,pool,{fetcher:quickbooksFetcher})
  registerCarrierPaymentReceiptRoutes(app,pool)
  registerCarrierRemittanceAdviceRoutes(app,pool)
  registerCarrierAlternateDelivery(app,pool,{now})
  registerRetirementPlanRoutes(app,pool,{now:remittanceNow})
  registerRetirementSftpSetup(app,pool,{verify:retirementSftpVerifier})
  registerRetirementDispatchSchedules(app,pool,{now:remittanceNow})
  registerRetirementAllocationUnsentRelease(app,pool,{transfer:retirementAllocationTransfer})
  registerRetirementBankUnsentRelease(app,pool,{fetcher:paymentFetcher})
  registerRetirementAllocationDelivery(app,pool,{transfer:retirementAllocationTransfer,fetcher:paymentFetcher,now:remittanceNow})
  registerRetirementRemittanceDispatch(app,pool,{fetcher:paymentFetcher,now:remittanceNow})
  registerRetirementRemittanceAuthorizations(app,pool,{fetcher:paymentFetcher,now:remittanceNow})
  registerRetirementAllocationFormatRoutes(app,pool)
  registerRetirementReceiptContracts(app,pool)
  registerRetirementReceiptBindings(app,pool)
  registerRetirementReceiptIntake(app,pool,{reader:retirementReceiptReader,now:remittanceNow})
  registerRetirementContributionAssessment(app,pool)
  registerRetirementContributionHistory(app,pool)
  registerRetirementSettlementAuthorizationRoutes(app,pool,{fetcher:quickbooksFetcher,paymentFetcher})
  registerRetirementSettlementPostingRoutes(app,pool,{fetcher:quickbooksFetcher,paymentFetcher})
  registerRetirementSettlementReleasePreview(app,pool,{fetcher:quickbooksFetcher})
  registerRetirementSettlementRelease(app,pool,{fetcher:quickbooksFetcher})
  registerRetirementReturnPreview(app,pool,{fetcher:quickbooksFetcher,paymentFetcher})
  registerRetirementReturnAuthorization(app,pool,{fetcher:quickbooksFetcher,paymentFetcher})
  registerRetirementReturnPosting(app,pool,{fetcher:quickbooksFetcher,paymentFetcher})
  registerRetirementReplacementPreview(app,pool,{fetcher:quickbooksFetcher,paymentFetcher,reader:retirementReceiptReader,transfer:retirementAllocationTransfer,now:remittanceNow})
  registerRetirementReplacementAuthorization(app,pool,{fetcher:quickbooksFetcher,paymentFetcher,reader:retirementReceiptReader,transfer:retirementAllocationTransfer,now:remittanceNow})
  registerRetirementReplacementAssessment(app,pool)
  registerRetirementReplacementReceiptBindings(app,pool)
  registerRetirementReplacementReceiptIntake(app,pool,{reader:retirementReceiptReader,now:remittanceNow})
  registerRetirementReplacementBank(app,pool,{fetcher:quickbooksFetcher,paymentFetcher,reader:retirementReceiptReader,transfer:retirementAllocationTransfer,now:remittanceNow})
  registerRetirementReplacementAllocation(app,pool,{fetcher:quickbooksFetcher,paymentFetcher,reader:retirementReceiptReader,transfer:retirementAllocationTransfer,now:remittanceNow})
  registerRetirementReturnReleasePreview(app,pool,{fetcher:quickbooksFetcher})
  registerRetirementReturnRelease(app,pool,{fetcher:quickbooksFetcher})
  registerRetirementSettlementPreview(app,pool,{fetcher:quickbooksFetcher,paymentFetcher})
  registerRetirementSettlementMappingRoutes(app,pool,{fetcher:quickbooksFetcher})
  registerRetirementAllocationFileRoutes(app,pool,{fetcher:paymentFetcher,now:remittanceNow})
  registerRetirementTimingRoutes(app,pool)
  registerRetirementRemittancePreviewRoutes(app,pool,{fetcher:paymentFetcher,now:remittanceNow})
  registerRetirementParticipantMappingRoutes(app,pool)
  registerRetirementDestinationRoutes(app,pool,{fetcher:paymentFetcher})
  registerRetirementProcessingReview(app,pool)
  registerRetirementEligibilityRoutes(app,pool)
  registerRetirementAnnualSources(app,pool,{now})
  registerAdminRetirementElectionRoutes(app,pool)
  registerCarrierRemittanceRecipientRoutes(app,pool)
  registerCarrierRemittanceNoticeRoutes(app,pool,{sender:carrierNoticeSender,now})
  registerCarrierRemittanceUnsentRelease(app,pool)
  registerBenefitCoverageLedger(app,pool)
  registerCarrierApplicationRoutes(app,pool,{now})
  registerPaymentConnectionRoutes(app, pool,{fetcher:paymentFetcher})
  registerCarrierPayeeRoutes(app,pool,{fetcher:paymentFetcher})
  registerCheckConfigurationRoutes(app,pool)
  registerCheckPayeeRoutes(app,pool,{fetcher:paymentFetcher})
  registerPaymentDestinationRoutes(app, pool,{fetcher:paymentFetcher})
  registerPaymentReplacementReviewRoutes(app,pool)
  registerReplacementAuthorizationRoutes(app,pool,{now})
  registerReplacementReceiptRoutes(app,pool)
  registerCheckReceiptRoutes(app,pool)
  registerCheckReplacementReviewRoutes(app,pool,{now})
  registerCheckReplacementAuthorizationRoutes(app,pool,{now})
  registerCheckReplacementDispatchRoutes(app,pool,{now,fetcher:paymentFetcher})
  registerCheckReplacementDocumentRoutes(app,pool,{now,fetcher:paymentFetcher})
  registerCheckReplacementDeliveryRoutes(app,pool,{now,fetcher:paymentFetcher})
  registerSettlementAutomationRoutes(app,pool)
  registerCheckStopCaseRoutes(app,pool)
  registerCheckStopRoutes(app,pool,{fetcher:paymentFetcher})
  registerCheckEvidenceRoutes(app,pool)
  registerFederalRemittanceReviewRoutes(app,pool)
  registerBenefitCarrierInvoiceRoutes(app,pool,{fetcher:quickbooksFetcher,paymentFetcher,now})
  registerCheckCancellationRoutes(app,pool,{fetcher:paymentFetcher})
  registerPaymentReturnCaseRoutes(app,pool)
  registerReplacementDispatchRoutes(app,pool,{fetcher:paymentFetcher,now})
  registerAdminBankEnrollmentHistory(app,pool,{fetcher:paymentFetcher})
  registerAutomaticCloseoutRoutes(app,pool,{now})
  registerPaymentPlanRoutes(app,pool,{loadRunPreview,payrollFingerprint})
  registerCheckIssuancePlanRoutes(app,pool,{loadRunPreview,payrollFingerprint,now})
  registerCheckIssuanceRoutes(app,pool,{loadRunPreview,payrollFingerprint,now,fetcher:paymentFetcher})
  registerCheckDocumentRoutes(app,pool,{now,fetcher:paymentFetcher})
  registerCheckDeliveryRoutes(app,pool,{now,fetcher:paymentFetcher})
  registerPaymentBatchRoutes(app,pool,{loadRunPreview,payrollFingerprint})
  registerPaymentAccountingRoutes(app,pool)
  registerSettlementPostingRoutes(app,pool,{fetcher:quickbooksFetcher})
  registerPaymentSubmissionScheduleRoutes(app,pool,{now})
  registerPaymentDispatchRoutes(app,pool,{fetcher:paymentFetcher,loadRunPreview,payrollFingerprint})
  registerTaxElectionRoutes(app, pool)
  registerEmployerTaxRoutes(app, pool)
  const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: Number(process.env.PAYROLL_AI_HOURLY_LIMIT) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Payroll AI hourly limit reached. The rules dashboard remains available.' },
  })

  app.get('/api/admin/payroll/service-readiness',async(req,res)=>{try{const runs=(await pool.query('SELECT id,source,status,started_at,finished_at,error_message FROM payroll_automation_run WHERE facility_id=$1 ORDER BY id DESC LIMIT 10',[req.canonicalAccess.facilityId])).rows;res.setHeader('Cache-Control','no-store');res.json({success:true,data:{...payrollServiceReadiness(),runs,w2Provider:await w2ProviderActivity(pool,req.canonicalAccess.facilityId)}})}catch(error){payrollError(res,error,'Unable to check payroll services')}})

  app.get('/api/admin/payroll/dashboard', async (req, res) => {
    try {
      res.json({ success: true, data: await dashboardData(pool, req.canonicalAccess.facilityId) })
    } catch (error) { payrollError(res, error, 'Unable to load payroll') }
  })

  app.post('/api/admin/payroll/employees', async (req, res) => {
    const body = req.body ?? {}
    const payType=body.payType??'HOURLY',salary=payType==='SALARY'?Number(body.annualSalaryCents):null
    const rate = payType==='SALARY'?null:integer(body.hourlyRateCents)
    if(!['HOURLY','SALARY'].includes(payType)||payType==='SALARY'&&(!Number.isSafeInteger(salary)||salary<=0))return res.status(400).json({success:false,message:'Choose hourly or salary pay and provide a positive annual salary in cents for salaried hires.'})
    if (!clean(body.legalFirstName, 120) || !clean(body.legalLastName, 120) || !isoDate(body.hireDate) || payType==='HOURLY'&&(rate === null || rate < 0)) {
      return res.status(400).json({ success: false, message: 'Legal name, hire date, and a valid hourly rate are required.' })
    }
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
      const { rows } = await client.query(`
        INSERT INTO payroll_employee (
          facility_id, employee_number, legal_first_name, legal_middle_name, legal_last_name,
          preferred_name, job_title, employment_status, pay_type, hourly_rate_cents, hire_date,
          work_state, residence_state, primary_work_location, personal_email, phone, notes,annual_salary_cents,overtime_classification
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$17,$9,$10,$11,$12,$13,$14,$15,$16,$18,$19) RETURNING *
      `, [req.canonicalAccess.facilityId, clean(body.employeeNumber, 40), clean(body.legalFirstName, 120), clean(body.legalMiddleName, 120) || null, clean(body.legalLastName, 120), clean(body.preferredName, 120) || null, clean(body.jobTitle, 160) || 'Employee', 'ONBOARDING', rate, body.hireDate, clean(body.workState, 2).toUpperCase() || 'MD', clean(body.residenceState, 2).toUpperCase() || 'MD', clean(body.primaryWorkLocation, 500) || null, clean(body.personalEmail, 320).toLowerCase() || null, clean(body.phone, 40) || null, clean(body.notes, 3000) || null,payType,salary,payType==='SALARY'?'EXEMPT_REVIEW':'NONEXEMPT'])
      if(payType==='HOURLY')await client.query(`INSERT INTO payroll_pay_rate (facility_id,employee_id,effective_on,hourly_rate_cents,reason,created_by) VALUES ($1,$2,$3,$4,'Initial hiring rate',$5)`,[rows[0].facility_id,rows[0].id,rows[0].hire_date,rate,req.adminId])
      await ensureOnboarding(client, rows[0])
      await audit(client, req, 'CREATE', 'employee', rows[0].id, null, rows[0])
      await client.query('COMMIT')
      res.status(201).json({ success: true, data: mapEmployee(rows[0]) })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      if (error.code === '23505') return res.status(409).json({ success: false, message: 'Employee number or email is already in use.' })
      payrollError(res, error, 'Unable to create employee')
    } finally { client.release() }
  })

  app.patch('/api/admin/payroll/employees/:id', async (req, res) => {
    const body = req.body ?? {}
    const client = await pool.connect()
    const reject = async (status, data) => { await client.query('ROLLBACK'); return res.status(status).json(data) }
    try {
      await client.query('BEGIN')
      await client.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
      const before = await client.query('SELECT * FROM payroll_employee WHERE id=$1 AND facility_id=$2 FOR UPDATE', [req.params.id, req.canonicalAccess.facilityId])
      if (!before.rows[0]) return await reject(404, { success: false, message: 'Employee not found' })
      const current = before.rows[0]
      const effectiveEmployee=(await salaryRowsAt(client,req.canonicalAccess.facilityId,[current]))[0]
      if (['ACTIVE','LEAVE'].includes(body.employmentStatus) && current.employment_status === 'ONBOARDING') {
        return await reject(409, { success: false, message: 'Use Complete onboarding to activate after all required steps have been reviewed.' })
      }
      if (['w4Status','stateWithholdingStatus','i9Status','directDepositStatus'].some(key => body[key] !== undefined)) {
        return await reject(409, { success: false, message: 'Review the corresponding onboarding step to change form or payment status.' })
      }
      if (current.employment_status === 'TERMINATED' && body.employmentStatus && body.employmentStatus !== 'TERMINATED') return await reject(409, {success:false,message:'Use Rehire preparation to reopen onboarding under this employee record.'})
      if(body.payType!==undefined||body.annualSalaryCents!==undefined||current.pay_type==='SALARY'&&body.hourlyRateCents!==undefined)return await reject(409,{success:false,message:'Use the compensation review workflow to change salary or pay basis.'})
      if(current.pay_type==='SALARY'&&current.salary_review&&body.jobTitle!==undefined&&clean(body.jobTitle,160)!==effectiveEmployee.job_title)return await reject(409,{success:false,message:'Review the salary classification for the new role before changing its title.'})
      const rate = body.hourlyRateCents === undefined ? current.hourly_rate_cents : integer(body.hourlyRateCents)
      if (current.pay_type==='HOURLY'&&(rate === null || rate < 0)) return await reject(400, { success: false, message: 'Hourly rate must be valid.' })
      if (Number(rate) !== Number(current.hourly_rate_cents)) {
        if (rate <= 0) return await reject(400, {success:false,message:'Use a positive hourly rate.'})
        if(current.employment_status!=='ONBOARDING') return await reject(409,{success:false,message:'Use Schedule pay change to preserve effective-dated compensation history.'})
        const used=await client.query("SELECT t.id FROM payroll_effective_time_entry t JOIN payroll_settings s ON s.facility_id=t.facility_id WHERE t.employee_id=$1 AND t.facility_id=$2 AND t.status<>'REJECTED' AND COALESCE(t.clock_out,'infinity'::timestamptz)>($3::date::timestamp AT TIME ZONE s.timezone) LIMIT 1",[current.id,req.canonicalAccess.facilityId,current.hire_date])
        if(used.rows.length) return await reject(409,{success:false,message:'Initial pay cannot change after time has been recorded.'})
        await assertCompensationUnlocked(client,req.canonicalAccess.facilityId,current.id,current.hire_date)
        await client.query('UPDATE payroll_pay_rate SET hourly_rate_cents=$1 WHERE employee_id=$2 AND facility_id=$3 AND effective_on=$4',[rate,current.id,req.canonicalAccess.facilityId,current.hire_date])
        await client.query(`UPDATE payroll_onboarding_task SET status=CASE WHEN task_key='WAGE_NOTICE' THEN 'CHANGES_REQUESTED' ELSE 'OPEN' END,review_note='Initial pay changed. Review and acknowledge the updated wage terms.',completed_at=NULL,reviewed_by=NULL,updated_at=now() WHERE employee_id=$1 AND facility_id=$2 AND task_key IN ('WAGE_NOTICE','PAY_REVIEW')`,[current.id,req.canonicalAccess.facilityId])

      }
      if (body.employmentStatus === 'ONBOARDING' && current.employment_status !== 'ONBOARDING') return await reject(409, {success:false,message:'Use a new hiring record for rehiring; existing payroll history must remain intact.'})

      const { rows } = await client.query(`UPDATE payroll_employee SET
        preferred_name=$1, job_title=$2, employment_status=$3, hourly_rate_cents=$4,
        w4_status=$5, state_withholding_status=$6, i9_status=$7, direct_deposit_status=$8,
        primary_work_location=$9, personal_email=$10, phone=$11, notes=$12, termination_date=CASE WHEN $3='TERMINATED' THEN COALESCE(termination_date,(now() AT TIME ZONE (SELECT timezone FROM payroll_settings WHERE facility_id=$14))::date) ELSE termination_date END, updated_at=now()
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
      if(current.employment_status!=='TERMINATED'&&rows[0].employment_status==='TERMINATED') {
        const cancelled=await client.query("UPDATE payroll_shift SET status='CANCELLED',updated_at=now() WHERE employee_id=$1 AND facility_id=$2 AND status='SCHEDULED' AND scheduled_start>=now() RETURNING id",[rows[0].id,req.canonicalAccess.facilityId])
        if(cancelled.rows.length)await audit(client,req,'TERMINATION_SHIFTS_CANCELLED','employee',rows[0].id,null,{shiftIds:cancelled.rows.map(s=>s.id)})
      }
      await audit(client, req, 'UPDATE', 'employee', rows[0].id, current, rows[0])
      await client.query('COMMIT')
      res.json({ success: true, data: mapEmployee((await salaryRowsAt(client,req.canonicalAccess.facilityId,rows))[0]) })
    } catch (error) { await client.query('ROLLBACK').catch(()=>{}); payrollError(res, error, 'Unable to update employee') } finally { client.release() }
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
          const delivery = await invitationSender({
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
          if(delivery?.sent!==true)throw new Error('Invitation email was not accepted for sending. Review mail settings and recipient suppression, or share the one-time link securely.')
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
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const shifts = await createShiftSeries(client, {facilityId:req.canonicalAccess.facilityId,employeeId:integer(req.body?.employeeId),adminId:req.adminId,body:req.body||{}})
      await audit(client, req, 'SHIFTS_CREATED', 'shift', shifts[0].id, null, shifts)
      await client.query('COMMIT')
      res.status(201).json({success:true,data:shifts.length===1?shifts[0]:shifts})
    } catch (error) { await client.query('ROLLBACK').catch(()=>{}); if(error.status)return res.status(error.status).json({success:false,message:error.message}); payrollError(res,error,'Unable to schedule shifts') }
    finally {client.release()}
  })

  app.patch('/api/admin/payroll/shifts/:id', async (req, res) => {
    const client=await pool.connect()
    try {
      await client.query('BEGIN')
      const employee=(await client.query('SELECT e.id,e.employment_status FROM payroll_employee e JOIN payroll_shift s ON s.employee_id=e.id WHERE s.id=$1 AND s.facility_id=$2 FOR UPDATE OF e',[req.params.id,req.canonicalAccess.facilityId])).rows[0]
      const before = await client.query('SELECT * FROM payroll_shift WHERE id=$1 AND facility_id=$2', [req.params.id, req.canonicalAccess.facilityId])
      if (!before.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Shift not found' }) }
      const current = before.rows[0]
      const start = req.body?.scheduledStart === undefined ? current.scheduled_start : isoTimestamp(req.body.scheduledStart)
      const end = req.body?.scheduledEnd === undefined ? current.scheduled_end : isoTimestamp(req.body.scheduledEnd)
      if (!start || !end || new Date(end) <= new Date(start)) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, message: 'Shift end must be after its start.' }) }
      if ((req.body?.status ?? current.status) === 'SCHEDULED') {
        if(employee.employment_status==='TERMINATED'){await client.query('ROLLBACK');return res.status(409).json({success:false,message:'Former employees cannot be scheduled. Cancel or close the existing shift instead.'})}
        const settings=(await client.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[req.canonicalAccess.facilityId])).rows[0]
        await assertShiftAvailable(client,req.canonicalAccess.facilityId,current.employee_id,start,end,settings.timezone,current.id)
      }

      const { rows } = await client.query(`UPDATE payroll_shift SET scheduled_start=$1, scheduled_end=$2,
        activity_type=$3, location=$4, status=$5, notes=$6, updated_at=now()
        WHERE id=$7 AND facility_id=$8 RETURNING *`, [start, end,
        allowed(req.body?.activityType, ['INSTRUCTION', 'PLANNING', 'SETUP', 'MEETING', 'ADMIN', 'OTHER'], current.activity_type),
        req.body?.location === undefined ? current.location : clean(req.body.location, 500) || null,
        allowed(req.body?.status, ['SCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED'], current.status),
        req.body?.notes === undefined ? current.notes : clean(req.body.notes, 2000) || null,
        req.params.id, req.canonicalAccess.facilityId])
      await audit(client, req, 'UPDATE', 'shift', rows[0].id, current, rows[0])
      await client.query('COMMIT')
      res.json({ success: true, data: rows[0] })
    } catch (error) { await client.query('ROLLBACK').catch(()=>{}); if(error.status)return res.status(error.status).json({success:false,message:error.message}); payrollError(res, error, 'Unable to update shift') } finally {client.release()}
  })

  app.post('/api/admin/payroll/time-entries', async (req, res) => {
    const body = req.body ?? {}
    const employeeId = integer(body.employeeId)
    const clockIn = isoTimestamp(body.clockIn)
    const clockOut = isoTimestamp(body.clockOut)
    const breakMinutes = integer(body.unpaidBreakMinutes ?? 0)
    if (!employeeId || !clockIn || !clockOut || clockOut <= clockIn || breakMinutes === null || breakMinutes < 0) return res.status(400).json({ success: false, message: 'Employee, clock-in, clock-out, and valid break minutes are required.' })
    try { calculateWorkedMinutes(clockIn, clockOut, breakMinutes) } catch (error) { return res.status(400).json({ success: false, message: error.message }) }
    if (!clean(body.evidenceNote, 2000)) return res.status(400).json({ success: false, message: 'State the source of this time entry; do not reconstruct time without evidence.' })
    const client=await pool.connect()
    const reject=async(status,payload)=>{await client.query('ROLLBACK');return res.status(status).json(payload)}
    try {
      await client.query('BEGIN')
      await client.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
      await assertEmploymentRange(client,req.canonicalAccess.facilityId,employeeId,clockIn,clockOut)
      const { rows } = await client.query(`INSERT INTO payroll_time_entry
        (facility_id, employee_id, clock_in, clock_out, unpaid_break_minutes, activity_type, source, status, evidence_note, created_by)
        SELECT $1,id,$3,$4,$5,$6,$7,'UNVERIFIED',$8,$9 FROM payroll_employee WHERE id=$2 AND facility_id=$1 RETURNING *`, [req.canonicalAccess.facilityId, employeeId, clockIn, clockOut, breakMinutes, allowed(body.activityType, ['INSTRUCTION', 'PLANNING', 'SETUP', 'MEETING', 'ADMIN', 'OTHER'], 'INSTRUCTION'), allowed(body.source, ['ADMIN', 'IMPORT', 'RECONSTRUCTION'], 'ADMIN'), clean(body.evidenceNote, 2000), req.adminId])
      if (!rows[0]) return reject(404,{ success: false, message: 'Employee not found' })
      await audit(client, req, 'CREATE', 'time_entry', rows[0].id, null, rows[0])
      await client.query('COMMIT')
      res.status(201).json({ success: true, data: rows[0] })
    } catch (error) { await client.query('ROLLBACK').catch(()=>{});payrollError(res, error, 'Unable to create time entry') } finally {client.release()}
  })

  app.patch('/api/admin/payroll/time-entries/:id/status', async (req, res) => {
    const status = allowed(req.body?.status, ['UNVERIFIED', 'EMPLOYEE_ATTESTED', 'APPROVED', 'REJECTED'], null)
    if (!status) return res.status(400).json({ success: false, message: 'Invalid time-entry status.' })
    const client=await pool.connect()
    const reject=async(status,payload)=>{await client.query('ROLLBACK');return res.status(status).json(payload)}
    try {
      await client.query('BEGIN')
      await client.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
      const before = await client.query('SELECT * FROM payroll_time_entry WHERE id=$1 AND facility_id=$2', [req.params.id, req.canonicalAccess.facilityId])
      if (!before.rows[0]) return reject(404,{ success: false, message: 'Time entry not found' })
      if (status === 'APPROVED' && !before.rows[0].clock_out) return reject(409,{ success:false, message:'Close the time entry before approving it.' })
      if(status==='APPROVED')await assertEmploymentRange(client,req.canonicalAccess.facilityId,before.rows[0].employee_id,before.rows[0].clock_in,before.rows[0].clock_out)
      const locked = await client.query(`SELECT r.id FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_settings s ON s.facility_id=r.facility_id
        WHERE r.facility_id=$1 AND r.run_kind='REGULAR' AND r.status IN ('APPROVED','FINALIZED') AND ($2::timestamptz AT TIME ZONE s.timezone)::date BETWEEN p.period_start AND p.period_end LIMIT 1`,[req.canonicalAccess.facilityId,before.rows[0].clock_in])
      if (locked.rows.length) return reject(409,{success:false,message:'This time belongs to approved or finalized payroll and cannot be changed.'})

      const { rows } = await client.query(`UPDATE payroll_time_entry SET status=$1,
        approved_by=CASE WHEN $1='APPROVED' THEN $2::bigint ELSE NULL END,
        approved_at=CASE WHEN $1='APPROVED' THEN now() ELSE NULL END, updated_at=now()
        WHERE id=$3 AND facility_id=$4 RETURNING *`, [status, req.adminId, req.params.id, req.canonicalAccess.facilityId])
      await audit(client, req, 'STATUS_CHANGE', 'time_entry', rows[0].id, before.rows[0], rows[0])
      await client.query('COMMIT')
      res.json({ success: true, data: rows[0] })
    } catch (error) { await client.query('ROLLBACK').catch(()=>{});payrollError(res, error, 'Unable to update time entry') } finally {client.release()}
  })

  app.post('/api/admin/payroll/clock', async (req, res) => {
    const employeeId = integer(req.body?.employeeId)
    const action = req.body?.action
    if (!employeeId || !['IN', 'OUT'].includes(action)) return res.status(400).json({ success: false, message: 'Employee and IN or OUT action are required.' })
    try {
      const row=await recordPayrollClock(pool,{facilityId:req.canonicalAccess.facilityId,employeeId,action,activityType:allowed(req.body?.activityType,['INSTRUCTION','PLANNING','SETUP','MEETING','ADMIN','OTHER'],'INSTRUCTION'),adminId:req.adminId,isAdmin:true})
      res.status(action==='IN'?201:200).json({success:true,data:row})
    } catch (error) {
      if(error.status)return res.status(error.status).json({success:false,message:error.message})
      if (error?.code === '23505') return res.status(409).json({ success: false, message: 'This employee is already clocked in.' })
      payrollError(res, error, 'Unable to record clock action')
    }
  })

  app.post('/api/admin/payroll/employees/:id/adjustments', async (req, res) => {
    const employeeId = integer(req.params.id)
    const amountCents = integer(req.body?.amountCents)
    const kind = allowed(req.body?.kind, ['BONUS', 'REIMBURSEMENT', 'PRETAX_DEDUCTION', 'POSTTAX_DEDUCTION', 'GARNISHMENT'], null)
    const activeFrom = isoDate(req.body?.activeFrom)
    const activeTo = req.body?.activeTo == null || req.body.activeTo === '' ? null : isoDate(req.body.activeTo)
    const authorizationReference = clean(req.body?.authorizationReference, 1000)
    const status = allowed(req.body?.status, ['DRAFT', 'ACTIVE'], 'DRAFT')
    if (!employeeId || !kind || !clean(req.body?.name, 160) || amountCents === null || amountCents < 0 || !activeFrom) return res.status(400).json({ success: false, message: 'Employee, adjustment type, name, amount, and start date are required.' })
    if ((req.body?.activeTo != null && req.body.activeTo !== '' && !activeTo) || (activeTo && activeFrom && activeTo < activeFrom)) return res.status(400).json({ success: false, message: 'The adjustment end date must be a valid date on or after its start date.' })
    if (status === 'ACTIVE' && (!authorizationReference || req.body?.taxTreatmentVerified !== true)) return res.status(400).json({ success: false, message: 'Active adjustments require an authorization reference and verified tax treatment.' })
    const client=await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
      const { rows } = await client.query(`INSERT INTO payroll_recurring_adjustment
        (facility_id,employee_id,kind,name,amount_cents,active_from,active_to,status,authorization_reference,tax_treatment_verified,created_by)
        SELECT $1,id,$3,$4,$5,$6,$7,$8,$9,$10,$11 FROM payroll_employee WHERE id=$2 AND facility_id=$1 RETURNING *`, [req.canonicalAccess.facilityId, employeeId, kind, clean(req.body.name, 160), amountCents, activeFrom, activeTo, status, authorizationReference || null, req.body?.taxTreatmentVerified === true, req.adminId])
      if (!rows[0]) {await client.query('ROLLBACK');return res.status(404).json({ success: false, message: 'Employee not found' })}
      await audit(client, req, 'CREATE', 'payroll_adjustment', rows[0].id, null, rows[0])
      await client.query('COMMIT')
      res.status(201).json({ success: true, data: rows[0] })
    } catch (error) { await client.query('ROLLBACK').catch(()=>{});payrollError(res, error, 'Unable to create payroll adjustment') } finally {client.release()}
  })

  app.patch('/api/admin/payroll/adjustments/:id/status', async (req, res) => {
    const status = allowed(req.body?.status, ['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED'], null)
    if (!status) return res.status(400).json({ success: false, message: 'Invalid adjustment status.' })
    const client=await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
      const before = await client.query('SELECT * FROM payroll_recurring_adjustment WHERE id=$1 AND facility_id=$2 FOR UPDATE', [req.params.id, req.canonicalAccess.facilityId])
      if (!before.rows[0]) {await client.query('ROLLBACK');return res.status(404).json({ success: false, message: 'Adjustment not found' })}
      if (status === 'ACTIVE' && (!before.rows[0].authorization_reference || !before.rows[0].tax_treatment_verified)) {await client.query('ROLLBACK');return res.status(409).json({ success: false, message: 'Authorization and verified tax treatment are required before activation.' })}
      const { rows } = await client.query('UPDATE payroll_recurring_adjustment SET status=$1, updated_at=now() WHERE id=$2 AND facility_id=$3 RETURNING *', [status, req.params.id, req.canonicalAccess.facilityId])
      await audit(client, req, 'STATUS_CHANGE', 'payroll_adjustment', rows[0].id, before.rows[0], rows[0])
      await client.query('COMMIT')
      res.json({ success: true, data: rows[0] })
    } catch (error) { await client.query('ROLLBACK').catch(()=>{});payrollError(res, error, 'Unable to update payroll adjustment') } finally {client.release()}
  })

  app.post('/api/admin/payroll/employees/:id/leave-transactions', async (req, res) => {
    const employeeId = integer(req.params.id)
    const leaveType = allowed(req.body?.leaveType, ['MD_SICK_SAFE','PTO'], 'MD_SICK_SAFE')
    const transactionKind=allowed(req.body?.transactionKind??'ADJUSTMENT',['ADJUSTMENT','OPENING_BALANCE','RESTORATION','FRONTLOAD'],null)
    if(!transactionKind)return res.status(400).json({success:false,message:'Choose a valid leave entry type.'})
    const minutes = integer(req.body?.minutes)
    const transactionDate = isoDate(req.body?.transactionDate)
    const reason = clean(req.body?.reason, 1000)
    if (!employeeId || !minutes || !transactionDate || !reason) return res.status(400).json({ success: false, message: 'Employee, non-zero minutes, date, and reason are required.' })
    if(transactionKind!=='ADJUSTMENT'&&(minutes<0||reason.length<12))return res.status(400).json({success:false,message:'Opening balances, restorations and frontloaded grants require positive minutes and a detailed source reference.'})
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
      const employee = await client.query('SELECT id FROM payroll_employee WHERE id=$1 AND facility_id=$2 FOR UPDATE', [employeeId, req.canonicalAccess.facilityId])
      if (!employee.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Employee not found' }) }
      if(minutes<0){
        const balance=await leaveAvailabilityAt(client,req.canonicalAccess.facilityId,employeeId,leaveType,transactionDate)
        const reserved=leaveType==='PTO'?await reservedPtoMinutes(client,req.canonicalAccess.facilityId,employeeId):0
        if(balance-reserved+minutes<0){await client.query('ROLLBACK');return res.status(409).json({success:false,message:'Leave use cannot exceed the dated balance or consume hours committed to approved leave or payout.'})}
      }
      const { rows } = await client.query(`INSERT INTO payroll_leave_transaction
        (facility_id,employee_id,leave_type,transaction_date,minutes,reason,created_by,transaction_kind)
        VALUES ($1,$2,$7,$3,$4,$5,$6,$8) RETURNING *`, [req.canonicalAccess.facilityId, employeeId, transactionDate, minutes, reason, req.adminId, leaveType,transactionKind])
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
    if (['COMPLETE','NOT_APPLICABLE'].includes(status) && !clean(req.body?.completionNote, 1000)) return res.status(400).json({ success: false, message: 'Add a completion note or confirmation reference.' })
    const client=await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
      const before = await client.query('SELECT * FROM payroll_compliance_task WHERE id=$1 AND facility_id=$2', [req.params.id, req.canonicalAccess.facilityId])
      if (!before.rows[0]) {await client.query('ROLLBACK');return res.status(404).json({ success: false, message: 'Compliance task not found' })}
      if(status==='NOT_APPLICABLE'&&['ein','pay-frequency','payroll-records'].includes(before.rows[0].task_key)){await client.query('ROLLBACK');return res.status(409).json({success:false,message:'Employer identity, wage policies, and payroll recordkeeping reviews cannot be waived.'})}
      const { rows } = await client.query(`UPDATE payroll_compliance_task SET status=$1, completion_note=$2,
        completed_at=CASE WHEN $1='COMPLETE' THEN now() ELSE NULL END,
        completed_by=CASE WHEN $1 IN ('COMPLETE','NOT_APPLICABLE') THEN $3::bigint ELSE NULL END, last_verified_on=CASE WHEN $1 IN ('COMPLETE','NOT_APPLICABLE') THEN CURRENT_DATE ELSE last_verified_on END,next_review_on=CASE WHEN $1 IN ('COMPLETE','NOT_APPLICABLE') THEN CURRENT_DATE+90 ELSE next_review_on END, updated_at=now()
        WHERE id=$4 AND facility_id=$5 RETURNING *`, [status, clean(req.body?.completionNote, 1000) || null, req.adminId, req.params.id, req.canonicalAccess.facilityId])
      const column={ein:'ein_status','md-crn':'md_crn_status','md-ui':'md_ui_status','workers-comp':'workers_comp_status'}[before.rows[0].task_key]
      if(status==='COMPLETE'&&column)await client.query(`UPDATE payroll_settings SET ${column}=$1,updated_at=now() WHERE facility_id=$2`,[column==='ein_status'?'VERIFIED':'ACTIVE',req.canonicalAccess.facilityId])
      await audit(client, req, 'STATUS_CHANGE', 'compliance_task', rows[0].id, before.rows[0], rows[0])
      await client.query('COMMIT')
      res.json({ success: true, data: rows[0] })
    } catch (error) {await client.query('ROLLBACK').catch(()=>{}); payrollError(res, error, 'Unable to update compliance task') } finally {client.release()}
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
    const client=await pool.connect()
    try {
      await client.query('BEGIN')
      const settingsResult = await client.query('SELECT * FROM payroll_settings WHERE facility_id=$1 FOR UPDATE', [req.canonicalAccess.facilityId])
      const settings = settingsResult.rows[0]
      if (!settings) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'Payroll settings are missing.' }) }
      const periods = generateVersionedPayPeriods(year, month, settings,await loadScheduleVersions(client,req.canonicalAccess.facilityId))
      const {rows:inserted}=await persistPayPeriods(client,req.canonicalAccess.facilityId,periods,{updateExisting:true})
      await audit(client, req, 'GENERATE', 'pay_period', `${year}-${month}`, null, inserted)
      await client.query('COMMIT')
      res.status(201).json({ success: true, data: inserted })
    } catch (error) {
      await client.query('ROLLBACK').catch(()=>{})
      if (error.status===400||error.status===409) return res.status(error.status).json({ success: false, message: error.message })
      payrollError(res, error, 'Unable to generate pay periods')
    } finally {client.release()}
  })

  app.post('/api/admin/payroll/employees/:id/workweek-allocation-preview',async(req,res)=>{
    let client
    try{
      const facility=req.canonicalAccess.facilityId,b=req.body||{}
      if(!Number.isSafeInteger(Number(b.payPeriodId))||Number(b.payPeriodId)<=0||!isoDate(b.week))return res.status(400).json({success:false,message:'Select a payroll period and workweek.'})
      client=await pool.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
      if(!(await client.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,req.params.id])).rows.length)throw Object.assign(new Error('Employee not found.'),{status:404})
      const data=await loadPreview(client,facility,Number(b.payPeriodId))
      if(!data)throw Object.assign(new Error('Payroll period not found.'),{status:404})
      const review=data.preview.employees.find(e=>Number(e.employeeId)===Number(req.params.id))?.employmentWeekReviews?.find(w=>w.week===b.week)
      if(!review)throw Object.assign(new Error('No hiring-boundary review exists for this employee and workweek.'),{status:409})
      const result=previewWorkweekAllocation(review,b.salaryAllocations)
      await client.query('COMMIT');res.json({success:true,data:result})
    }catch(error){if(client)await client.query('ROLLBACK');res.status(error.status||500).json({success:false,message:error.status?error.message:'Unable to preview the workweek allocation.'})}finally{client?.release()}
  })

  app.post('/api/admin/payroll/runs/preview', async (req, res) => {
    const payPeriodId = integer(req.body?.payPeriodId)
    if (!payPeriodId) return res.status(400).json({ success: false, message: 'Pay period is required.' })
    if(req.body?.paymentDate!==undefined&&!isoDate(req.body.paymentDate))return res.status(400).json({success:false,message:'Use a valid payroll payment date.'})
    const client=await pool.connect()
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
      const data = req.body?.offCyclePto?await loadOffCyclePtoPreview(client,req.canonicalAccess.facilityId,payPeriodId,req.body.paymentDate,validateOffCyclePto(req.body.offCyclePto)):req.body?.offCycleBonus?await loadOffCycleBonusPreview(client,req.canonicalAccess.facilityId,payPeriodId,req.body.paymentDate,validateOffCycleBonus(req.body.offCycleBonus)):await loadPreview(client, req.canonicalAccess.facilityId, payPeriodId,req.body?.paymentDate||null)
      await client.query('COMMIT')
      if (!data) return res.status(404).json({ success: false, message: 'Pay period not found' })
      res.json({ success: true, data })
    } catch (error) { await client.query('ROLLBACK').catch(()=>{});payrollError(res, error, 'Unable to preview payroll') } finally {client.release()}
  })

  app.post('/api/admin/payroll/runs', async (req, res) => {
    const payPeriodId = integer(req.body?.payPeriodId)
    if (!payPeriodId) return res.status(400).json({ success: false, message: 'Pay period is required.' })
    if(req.body?.paymentDate!==undefined&&!isoDate(req.body.paymentDate))return res.status(400).json({success:false,message:'Use a valid payroll payment date.'})
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
      const period = await client.query('SELECT * FROM payroll_pay_period WHERE id=$1 AND facility_id=$2 FOR UPDATE', [payPeriodId, req.canonicalAccess.facilityId])
      if (!period.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Pay period not found' }) }
      const offcycle=req.body?.offCycleReimbursementId
      const bonus=req.body?.offCycleBonus?validateOffCycleBonus(req.body.offCycleBonus):null
      const pto=req.body?.offCyclePto?validateOffCyclePto(req.body.offCyclePto):null
      if([offcycle,bonus,pto].filter(Boolean).length>1)throw Object.assign(new Error('Select one off-cycle payment type.'),{status:400})
      if(bonus){
        const previous=(await client.query("SELECT * FROM payroll_run WHERE facility_id=$1 AND run_kind='OFF_CYCLE_BONUS' AND offcycle_context->>'requestKey'=$2",[req.canonicalAccess.facilityId,bonus.requestKey])).rows[0]
        if(previous){
          if(previous.status==='VOID'||Number(previous.pay_period_id)!==payPeriodId||new Date(previous.payment_date).toISOString().slice(0,10)!==req.body.paymentDate||!isDeepStrictEqual(previous.offcycle_context,bonus))throw Object.assign(new Error('This bonus request reference was already used. Use a new reference for changed or replacement payments.'),{status:409})
          await client.query('COMMIT');return res.json({success:true,data:previous})
        }
      }
      if(pto){
        const previous=(await client.query("SELECT * FROM payroll_run WHERE facility_id=$1 AND run_kind='OFF_CYCLE_PTO' AND status<>'VOID' AND offcycle_context->>'payoutId'=$2",[req.canonicalAccess.facilityId,String(pto.payoutId)])).rows[0]
        if(previous){
          if(Number(previous.pay_period_id)!==payPeriodId||new Date(previous.payment_date).toISOString().slice(0,10)!==req.body.paymentDate||!isDeepStrictEqual(previous.offcycle_context,pto))throw Object.assign(new Error('This PTO payout already has a payroll with different details. Review or void it before replacement.'),{status:409})
          await client.query('COMMIT');return res.json({success:true,data:previous})
        }
      }
      const existing = offcycle||bonus||pto?{rows:[]}:await client.query("SELECT id FROM payroll_run WHERE pay_period_id=$1 AND facility_id=$2 AND run_kind='REGULAR' AND status <> 'VOID' LIMIT 1", [payPeriodId, req.canonicalAccess.facilityId])
      if (existing.rows.length) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'This period already has a payroll run. Review it or void it before rebuilding.' }) }
      const data = pto?await loadOffCyclePtoPreview(client,req.canonicalAccess.facilityId,payPeriodId,req.body.paymentDate,pto):bonus?await loadOffCycleBonusPreview(client,req.canonicalAccess.facilityId,payPeriodId,req.body.paymentDate,bonus):offcycle?await loadReimbursementPreview(client,req.canonicalAccess.facilityId,offcycle,req.body?.paymentDate):await loadPreview(client, req.canonicalAccess.facilityId, payPeriodId,req.body?.paymentDate||null)
      if(Number(data.period.id)!==Number(payPeriodId))throw Object.assign(new Error('Use the payroll period assigned to this approved expense.'),{status:409})
      if (!data.preview.employees.length) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'Activate at least one employee before creating payroll.' }) }
      const runResult = await client.query(`INSERT INTO payroll_run
        (facility_id,pay_period_id,gross_pay_cents,employee_tax_cents,employer_tax_cents,reimbursement_cents,deduction_cents,net_pay_cents,blocking_warnings,calculation_snapshot,created_by,payment_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11) RETURNING *`, [req.canonicalAccess.facilityId, payPeriodId, data.preview.grossPayCents, data.preview.employeeTaxCents, data.preview.employerTaxCents, data.preview.reimbursementCents, data.preview.deductionCents, JSON.stringify(data.preview.warnings), JSON.stringify(data.preview), req.adminId,data.period.pay_date])
      if(bonus){
        await client.query("UPDATE payroll_run SET run_kind='OFF_CYCLE_BONUS',offcycle_context=$1 WHERE id=$2",[bonus,runResult.rows[0].id])
        await audit(client,req,'OFF_CYCLE_BONUS_REVIEWED','payroll_run',runResult.rows[0].id,null,bonus)
      }
      if(offcycle){
        await client.query("UPDATE payroll_run SET run_kind='OFF_CYCLE_REIMBURSEMENT',offcycle_context=$1 WHERE id=$2",[data.context,runResult.rows[0].id])
        await client.query('UPDATE payroll_recurring_adjustment SET offcycle_run_id=$1 WHERE id=$2 AND facility_id=$3',[runResult.rows[0].id,offcycle,req.canonicalAccess.facilityId])
      }
      if(pto){
        await client.query("UPDATE payroll_run SET run_kind='OFF_CYCLE_PTO',offcycle_context=$1 WHERE id=$2",[pto,runResult.rows[0].id])
        await client.query('UPDATE payroll_leave_payout SET offcycle_run_id=$1 WHERE id=$2 AND facility_id=$3',[runResult.rows[0].id,pto.payoutId,req.canonicalAccess.facilityId])
        await audit(client,req,'OFF_CYCLE_PTO_REVIEWED','payroll_run',runResult.rows[0].id,null,pto)
      }
      for (const item of data.preview.employees) {
        await client.query(`INSERT INTO payroll_run_employee
          (payroll_run_id,employee_id,hourly_rate_cents,regular_minutes,overtime_minutes,regular_pay_cents,overtime_pay_cents,other_taxable_pay_cents,reimbursement_cents,pretax_deduction_cents,posttax_deduction_cents,garnishment_cents,other_deductions_cents,federal_income_tax_cents,state_income_tax_cents,social_security_tax_cents,medicare_tax_cents,additional_medicare_tax_cents,sick_leave_accrual_minutes,net_pay_cents,warnings)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`, [runResult.rows[0].id, item.employeeId, item.hourlyRateCents, item.regularMinutes, item.overtimeMinutes, item.regularPayCents, item.overtimePayCents, item.otherTaxablePayCents, item.reimbursementCents, item.pretaxDeductionCents, item.posttaxDeductionCents, item.garnishmentCents, item.totalDeductionCents, item.federalIncomeTaxCents, item.stateIncomeTaxCents, item.socialSecurityTaxCents, item.medicareTaxCents, item.additionalMedicareTaxCents, item.sickLeaveAccrualMinutes, item.netPayCents, JSON.stringify(item.warnings)])
      }
      for (const item of data.preview.employees) await client.query('UPDATE payroll_run_employee SET paid_leave_cents=$1,paid_leave_minutes=$2,futa_tax_cents=$5,md_ui_tax_cents=$6 WHERE payroll_run_id=$3 AND employee_id=$4',[item.paidLeavePayCents,item.paidLeaveMinutes,runResult.rows[0].id,item.employeeId,item.futaTaxCents,item.mdUiTaxCents])
      for (const item of data.preview.employees) if(item.withholdingMethod) await client.query('UPDATE payroll_run_employee SET withholding_source_note=$1,withholding_verified_at=now(),withholding_verified_by=$2 WHERE payroll_run_id=$3 AND employee_id=$4',[item.withholdingMethod,req.adminId,runResult.rows[0].id,item.employeeId])
      await refreshPayrollRunTotals(client,runResult.rows[0].id,req.canonicalAccess.facilityId)
      const savedRun=(await client.query('SELECT * FROM payroll_run WHERE id=$1',[runResult.rows[0].id])).rows[0]
      await audit(client, req, 'CREATE', 'payroll_run', runResult.rows[0].id, null, data.preview)
      await client.query('COMMIT')
      res.status(201).json({ success: true, data: savedRun })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      payrollError(res, error, 'Unable to create payroll run')
    } finally { client.release() }
  })

  app.patch('/api/admin/payroll/runs/:id/status', async (req, res) => {
    const requested = allowed(req.body?.status, ['REVIEW', 'APPROVED', 'VOID'], null)
    if (!requested) return res.status(400).json({ success: false, message: 'Only REVIEW, APPROVED, or VOID are allowed.' })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
      const before = await client.query('SELECT * FROM payroll_run WHERE id=$1 AND facility_id=$2 FOR UPDATE', [req.params.id, req.canonicalAccess.facilityId])
      const run = before.rows[0]
      if (!run) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Payroll run not found' }) }
      const transitionAllowed = requested === 'VOID' && ['DRAFT', 'REVIEW', 'APPROVED'].includes(run.status)
        || requested === 'REVIEW' && run.status === 'DRAFT'
        || requested === 'APPROVED' && run.status === 'REVIEW'
      if (!transitionAllowed) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: `Cannot move a ${run.status} run to ${requested}.` }) }
      if(requested==='VOID')await assertNoActivePaymentBatch(client,req.canonicalAccess.facilityId,run.id)
      if (requested === 'APPROVED') {
        const fresh = await loadRunPreview(client,req.canonicalAccess.facilityId,run)
        const snapshot = run.calculation_snapshot

        if (!fresh || payrollFingerprint(fresh.preview) !== payrollFingerprint(snapshot)) { await client.query('ROLLBACK'); return res.status(409).json({ success:false, message:'Payroll inputs changed since this draft. Void it and generate a fresh calculation before approval.' }) }
        const rows = (await client.query('SELECT employee_id,net_pay_cents,withholding_verified_at FROM payroll_run_employee WHERE payroll_run_id=$1', [run.id])).rows
        const verified = new Set(rows.filter(r=>r.net_pay_cents!==null && r.withholding_verified_at).map(r=>Number(r.employee_id)))
        const blockers = fresh.preview.warnings.filter(w=>w.blocking && !(w.code==='WITHHOLDING_ENGINE_NOT_CONFIGURED' && verified.has(Number(w.employeeId))))
        if (!rows.length || rows.some(r=>r.net_pay_cents===null) || blockers.length) { await client.query('ROLLBACK'); return res.status(409).json({ success:false, message:'Resolve all current payroll blockers and withholding before approval.', data:{blockers} }) }
        await client.query('UPDATE payroll_run SET blocking_warnings=$1 WHERE id=$2',[JSON.stringify(fresh.preview.warnings.filter(w=>!w.blocking)),run.id])
      }
      const { rows } = await client.query(`UPDATE payroll_run SET status=$1,
        reviewed_by=CASE WHEN $1='REVIEW' THEN $2 ELSE reviewed_by END,
        reviewed_at=CASE WHEN $1='REVIEW' THEN now() ELSE reviewed_at END,
        approved_by=CASE WHEN $1='APPROVED' THEN $2 ELSE approved_by END,
        approved_at=CASE WHEN $1='APPROVED' THEN now() ELSE approved_at END, updated_at=now()
        WHERE id=$3 AND facility_id=$4 RETURNING *`, [requested, req.adminId, req.params.id, req.canonicalAccess.facilityId])
      if(requested==='APPROVED')await retainRetirementRunLedger(client,req.canonicalAccess.facilityId,run.id)
      await audit(client, req, 'STATUS_CHANGE', 'payroll_run', rows[0].id, run, rows[0])
      await client.query('COMMIT')
      res.json({ success: true, data: rows[0] })
    } catch (error) { await client.query('ROLLBACK').catch(()=>{}); payrollError(res, error, 'Unable to update payroll run') }
    finally { client.release() }
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
      const currentResult = await client.query(`SELECT re.*, r.status AS run_status, r.run_kind, r.blocking_warnings, r.calculation_snapshot,
          e.w4_status,e.state_withholding_status
        FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id
        JOIN payroll_employee e ON e.id=re.employee_id
        WHERE re.payroll_run_id=$1 AND re.employee_id=$2 AND r.facility_id=$3 FOR UPDATE OF re,r`, [runId, employeeId, req.canonicalAccess.facilityId])
      const current = currentResult.rows[0]
      if (!current) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Payroll run employee not found' }) }
      if(current.run_kind==='OFF_CYCLE_REIMBURSEMENT'){await client.query('ROLLBACK');return res.status(409).json({success:false,message:'An expense-only reimbursement has no taxable wages or withholding. Correct its expense classification before changing taxes.'})}
      if (!['DRAFT', 'REVIEW'].includes(current.run_status)) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'Withholding can only be entered on a draft or review run.' }) }
      const retainedRetirement=(current.calculation_snapshot?.employees||[]).find(e=>Number(e.employeeId)===employeeId&&e.retirementPlans?.length)
      if(retainedRetirement&&(retainedRetirement.federalIncomeTaxCents!==federalCents||retainedRetirement.stateIncomeTaxCents!==stateCents)){await client.query('ROLLBACK');return res.status(409).json({success:false,message:'Retirement payroll withholding is bound to its reviewed calculation. Void and rebuild the draft with current tax sources before changing these amounts.'})}
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

  app.post(['/api/admin/payroll/runs/:id/finalize','/api/admin/payroll/runs/:id/payment-closeout'], async (req, res) => {
    try{
      const data=await finalizePayrollRun(pool,{facilityId:req.canonicalAccess.facilityId,actorId:req.adminId,runId:req.params.id,body:req.body},{now,closeout:req.path.endsWith('/payment-closeout')})
      res.json({success:true,data})
    }catch(error){
      if(error.status&&error.data)return res.status(error.status).json({success:false,message:error.message,data:error.data})
      payrollError(res,error,'Unable to finalize payroll run')
    }
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
        retirement_liability_account=$8,verified_by_bookkeeper=TRUE,updated_at=now() WHERE facility_id=$7 RETURNING *`, [
        account('wagesExpenseAccount', 'Payroll:Wages Expense'),
        account('employerTaxExpenseAccount', 'Payroll:Employer Tax Expense'),
        account('reimbursementExpenseAccount', 'Employee Reimbursements'),
        account('taxLiabilityAccount', 'Payroll:Tax Liabilities'),
        account('deductionLiabilityAccount', 'Payroll:Other Deductions Payable'),
        account('payrollClearingAccount', 'Payroll Clearing'),
        req.canonicalAccess.facilityId,
        body.retirementLiabilityAccount===undefined?before.rows[0]?.retirement_liability_account:clean(body.retirementLiabilityAccount,200)||null,
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

  for(const csv of [false,true])app.get(`/api/admin/payroll/reports/employer-benefit-funding${csv?'.csv':''}`,async(req,res)=>{
    const start=isoDate(req.query.start),end=isoDate(req.query.end)
    if(!start||!end||end<start)return res.status(400).json({success:false,message:'Valid start and end dates are required.'})
    try{
      const funding=await employerBenefitFundingReport(pool,req.canonicalAccess.facilityId,start,end)
      res.setHeader('Cache-Control','no-store')
      if(csv){await audit(pool,req,'EXPORT','employer_benefit_funding',null,null,{start,end,evidenceCount:funding.length});return sendCsv(res,`vortex-employer-benefit-funding-${start}-to-${end}.csv`,employerBenefitFundingCsv(funding))}
      res.json({success:true,data:{start,end,funding}})
    }catch(error){payrollError(res,error,'Unable to review employer benefit funding')}
  })

  app.get('/api/admin/payroll/reports/benefit-contributions', async (req,res)=>{
    const start=isoDate(req.query.start),end=isoDate(req.query.end)
    if(!start||!end||end<start)return res.status(400).json({success:false,message:'Valid start and end dates are required.'})
    try{
      const rows=await benefitContributionReport(pool,req.canonicalAccess.facilityId,start,end)
      res.setHeader('Cache-Control','no-store')
      res.json({success:true,data:{start,end,contributions:rows.slice(1).map(row=>({paymentDate:row[0],month:row[1],employeeId:row[2],employeeName:row[3],planId:row[4],planName:row[5],optionId:row[6],optionLabel:row[7],amountCents:Math.round(Number(row[8])*100),taxTreatment:row[9],runId:row[10]}))}})
    }catch(error){payrollError(res,error,'Unable to review benefit contributions')}
  })

  app.get('/api/admin/payroll/reports/benefit-contributions.csv', async (req,res)=>{
    const start=isoDate(req.query.start),end=isoDate(req.query.end)
    if(!start||!end||end<start)return res.status(400).json({success:false,message:'Valid start and end dates are required.'})
    try{
      const rows=await benefitContributionReport(pool,req.canonicalAccess.facilityId,start,end)
      await audit(pool,req,'EXPORT','benefit_contributions',null,null,{start,end,contributionCount:rows.length-1})
      res.setHeader('Cache-Control','no-store')
      sendCsv(res,`vortex-benefit-contributions-${start}-to-${end}.csv`,rows)
    }catch(error){payrollError(res,error,'Unable to export benefit contributions')}
  })

  app.get('/api/admin/payroll/reports/wage-bases', async (req,res)=>{
    const start=isoDate(req.query.start),end=isoDate(req.query.end)
    if(!start||!end||end<start)return res.status(400).json({success:false,message:'Valid start and end dates are required.'})
    try{
      const rows=await employeeSummaryCsv(pool,req.canonicalAccess.facilityId,start,end)
      res.setHeader('Cache-Control','no-store')
      res.json({success:true,data:{start,end,employees:rows.slice(1).map(row=>({employeeId:String(row[2]),employeeNumber:row[3],employeeName:row[4],finalizedRunCount:Number(row[6]),socialSecurityWages:row[29]||null,medicareWages:row[30]||null,additionalMedicareWages:row[31]||null,verifiedRunCount:row[32],review:row[33],federalWages:row[34]||null,marylandWages:row[35]||null,incomeVerifiedRunCount:row[36],incomeReview:row[37]}))}})
    }catch(error){payrollError(res,error,'Unable to review retained wage bases')}
  })

  app.get('/api/admin/payroll/reports/employee-summary.csv', async (req,res)=>{
    const start=isoDate(req.query.start),end=isoDate(req.query.end)
    if(!start||!end||end<start)return res.status(400).json({success:false,message:'Valid start and end dates are required.'})
    try {
      const rows=await employeeSummaryCsv(pool,req.canonicalAccess.facilityId,start,end)
      await audit(pool,req,'EXPORT','employee_payroll_summary',null,null,{start,end,employeeCount:rows.length-1})
      res.setHeader('Cache-Control','no-store')
      sendCsv(res,`vortex-employee-payroll-summary-${start}-to-${end}.csv`,rows)
    } catch(error){payrollError(res,error,'Unable to export employee payroll summary')}
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
        SELECT p.period_start,p.period_end,COALESCE(r.payment_date,p.pay_date),e.employee_number,e.legal_first_name,e.legal_last_name,
          'PAYROLL_RUN'::text,('RUN-'||r.id)::text,
          (re.regular_pay_cents+re.overtime_pay_cents+re.other_taxable_pay_cents),
          (COALESCE(re.federal_income_tax_cents,0)+COALESCE(re.state_income_tax_cents,0)+re.social_security_tax_cents+re.medicare_tax_cents+re.additional_medicare_tax_cents),
          re.reimbursement_cents,re.other_deductions_cents,re.net_pay_cents,'RECONCILED'::text
        FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
        JOIN payroll_run_employee re ON re.payroll_run_id=r.id JOIN payroll_employee e ON e.id=re.employee_id
        WHERE r.facility_id=$1 AND r.status='FINALIZED' AND COALESCE(r.payment_date,p.pay_date) BETWEEN $2 AND $3
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
          (t.clock_in < ($2::date::timestamp AT TIME ZONE ps.timezone) OR t.clock_out > (($3::date+1)::timestamp AT TIME ZONE ps.timezone) OR t.clock_out IS NULL) AS crosses_range,
          CASE WHEN t.clock_out IS NULL THEN NULL ELSE GREATEST(0, ROUND(EXTRACT(EPOCH FROM (t.clock_out-t.clock_in))/60)::int-t.unpaid_break_minutes) END AS worked_minutes
        FROM payroll_effective_time_entry t JOIN payroll_employee e ON e.id=t.employee_id
        JOIN payroll_settings ps ON ps.facility_id=t.facility_id
        WHERE t.facility_id=$1
          AND (t.clock_in >= ($2::date::timestamp AT TIME ZONE ps.timezone) OR t.clock_out > ($2::date::timestamp AT TIME ZONE ps.timezone) OR (t.clock_out IS NULL AND t.status<>'REJECTED'))
          AND t.clock_in < (($3::date + 1)::timestamp AT TIME ZONE ps.timezone)
        ORDER BY t.clock_in, e.legal_last_name`, [req.canonicalAccess.facilityId, start, end])
      sendCsv(res, `vortex-time-log-${start}-to-${end}.csv`, [
        ['Employee #', 'Employee', 'Clock in', 'Clock out', 'Break minutes', 'Whole entry worked minutes', 'Activity', 'Source', 'Status', 'Evidence note', 'Crosses report boundary or open'],
        ...rows.map((row) => [row.employee_number, `${row.legal_first_name} ${row.legal_last_name}`, row.clock_in, row.clock_out, row.unpaid_break_minutes, row.worked_minutes, row.activity_type, row.source, row.status, row.evidence_note, row.crosses_range ? 'YES' : 'NO']),
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
      const { rows } = await pool.query(`SELECT r.id,COALESCE(r.payment_date,p.pay_date) AS pay_date,r.status,r.employee_tax_cents,r.employer_tax_cents,
          (r.employee_tax_cents+r.employer_tax_cents)::bigint AS total_liability,t.*
        FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
        CROSS JOIN LATERAL (SELECT SUM(re.federal_income_tax_cents)::bigint AS federal_income,
          SUM(re.state_income_tax_cents)::bigint AS maryland_income,
          SUM(re.social_security_tax_cents*2)::bigint AS combined_social_security,
          SUM(re.medicare_tax_cents*2+re.additional_medicare_tax_cents)::bigint AS combined_medicare,
          SUM(re.futa_tax_cents)::bigint AS futa,SUM(re.md_ui_tax_cents)::bigint AS maryland_ui
          FROM payroll_run_employee re WHERE re.payroll_run_id=r.id) t
        WHERE r.facility_id=$1 AND r.status IN ('APPROVED','FINALIZED') ORDER BY COALESCE(r.payment_date,p.pay_date),r.id`, [req.canonicalAccess.facilityId])
      sendCsv(res, 'vortex-payroll-tax-liabilities.csv', [
        ['Run','Pay date','Status','Federal income withholding','Maryland income withholding','Social Security employee and employer','Medicare employee and employer','Employer FUTA','Employer Maryland UI','Employee taxes','Employer taxes','Total calculated tax liability','Payment and filing status'],
        ...rows.map(row=>[row.id,row.pay_date,row.status,...['federal_income','maryland_income','combined_social_security','combined_medicare','futa','maryland_ui','employee_tax_cents','employer_tax_cents','total_liability'].map(k=>(Number(row[k]||0)/100).toFixed(2)),'Reconcile separately with agency deposits and returns']),
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
      const { rows } = await pool.query(`SELECT r.*, COALESCE(r.payment_date,p.pay_date) AS pay_date, m.* FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
        JOIN payroll_accounting_mapping m ON m.facility_id=r.facility_id
        WHERE r.id=$1 AND r.facility_id=$2`, [runId, req.canonicalAccess.facilityId])
      const run = rows[0]
      if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found' })
      if (!['APPROVED', 'FINALIZED'].includes(run.status)) return res.status(409).json({ success: false, message: 'Only an approved or finalized run can be exported to QuickBooks.' })
      if (!run.verified_by_bookkeeper) return res.status(409).json({ success: false, message: 'A bookkeeper must verify the account mapping before export.' })
      const entries=journalEntries(run)
      await verifyBenefitPosting(pool,run)
      await verifyRetirementPosting(pool,run)
      const accountNames={wages:run.wages_expense_account,employerTax:run.employer_tax_expense_account,reimbursements:run.reimbursement_expense_account,taxLiability:run.tax_liability_account,deductions:run.deduction_liability_account,clearing:run.payroll_clearing_account,retirement:run.retirement_liability_account}
      if(entries.some(([key])=>key==='retirement')&&(!accountNames.retirement||Object.entries(accountNames).some(([key,value])=>key!=='retirement'&&value===accountNames.retirement)))return res.status(409).json({success:false,message:'Verify a separate retirement liability account name before exporting retirement payroll.'})
      const journalDate=run.pay_date instanceof Date?run.pay_date.toISOString().slice(0,10):String(run.pay_date).slice(0,10)
      const journalRows = [
        ['Journal No.', 'Journal Date', 'Account Name', 'Debits', 'Credits', 'Description'],
        ...entries.map(([key,amount,posting,description])=>[`PAY-${run.id}`,journalDate,accountNames[key],posting==='Debit'?(amount/100).toFixed(2):'',posting==='Credit'?(amount/100).toFixed(2):'',description||`Payroll run ${run.id}`]),
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

export async function finalizePayrollRun(pool,{facilityId,actorId,runId,body},{now=()=>new Date(),closeout=false,automaticBatchId=null}={}){
 const req={canonicalAccess:{facilityId},adminId:actorId,params:{id:runId},body}
 const finalizationError=(message,status)=>Object.assign(new Error(message),{status})
    const confirmation = clean(closeout?req.body?.reference:req.body?.paymentConfirmationReference, 500)
    if(!isoDate(req.body?.paymentDate))throw finalizationError('Record the actual payment date shown on the payment confirmation.',400)
    if (confirmation.length < 4) throw finalizationError('External payment confirmation is required.',400)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
      if(closeout)await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${req.canonicalAccess.facilityId}`])
      const runResult = await client.query(`SELECT r.*,COALESCE(r.payment_date,p.pay_date) AS pay_date FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
        WHERE r.id=$1 AND r.facility_id=$2 FOR UPDATE OF r`, [req.params.id, req.canonicalAccess.facilityId])
      const run = runResult.rows[0]
      if (!run) { await client.query('ROLLBACK'); throw finalizationError('Payroll run not found',404) }
      if(new Date(run.pay_date).toISOString().slice(0,10)!==req.body.paymentDate){await client.query('ROLLBACK');throw finalizationError('Actual payment date differs from the approved calculation date. Void and rebuild the payroll using the actual date so year-to-date taxes and reports stay accurate.',409)}
      const timezone=(await client.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[req.canonicalAccess.facilityId])).rows[0].timezone
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now())
      if(req.body.paymentDate>today){await client.query('ROLLBACK');throw finalizationError('A future payment cannot be confirmed as paid. Finalize on or after the actual payment date.',400)}
      if(automaticBatchId!==null){
        const allowed=await client.query('SELECT 1 FROM payroll_automatic_closeout q JOIN payroll_payment_batch b ON b.id=q.batch_id WHERE q.batch_id=$1 AND b.payroll_run_id=$2 AND b.facility_id=$3 AND q.body=$4::jsonb AND q.created_by=$5 AND NOT EXISTS(SELECT 1 FROM payroll_automatic_closeout_cancellation WHERE batch_id=q.batch_id)',[automaticBatchId,run.id,req.canonicalAccess.facilityId,JSON.stringify(req.body),req.adminId])
        if(!allowed.rowCount)throw finalizationError('Automatic closeout authorization changed or was cancelled.',409)
      }
      if(closeout){
        const retained=await retainPaymentCloseout(client,req.canonicalAccess.facilityId,run,req.body,req.adminId,{today})
        if(retained.reused&&run.status==='FINALIZED'){await client.query('COMMIT');return {...run,reused:true}}
      }else await assertNoActivePaymentBatch(client,req.canonicalAccess.facilityId,run.id)
      if (run.status !== 'APPROVED') { await client.query('ROLLBACK'); throw finalizationError('Only an approved run can be finalized.',409) }
      const employees = await client.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1 FOR UPDATE', [run.id])
      if (employees.rows.some((row) => row.net_pay_cents === null)) { await client.query('ROLLBACK'); throw finalizationError('Every employee must have complete withholding and net pay.',409) }
      const current=await loadRunPreview(client,req.canonicalAccess.facilityId,run)
      const verified=new Set(employees.rows.filter(row=>row.withholding_verified_at&&row.net_pay_cents!==null).map(row=>Number(row.employee_id)))
      const blockers=current?.preview.warnings.filter(w=>w.blocking&&!(w.code==='WITHHOLDING_ENGINE_NOT_CONFIGURED'&&verified.has(Number(w.employeeId))))||[]
      if(!current||payrollFingerprint(current.preview)!==payrollFingerprint(run.calculation_snapshot)||blockers.length){await client.query('ROLLBACK');throw Object.assign(finalizationError('Payroll inputs changed after approval. Resolve the change and rebuild before recording payment.',409),{data:{blockers}})}
      const correctionSettlements=await settlePayrollCorrections(client,req.canonicalAccess.facilityId,run,employees.rows,req.adminId)
      for (const row of employees.rows) {
        if (Number(row.sick_leave_accrual_minutes) <= 0) continue
        await client.query(`INSERT INTO payroll_leave_transaction
          (facility_id,employee_id,leave_type,transaction_date,minutes,reason,source_run_employee_id,created_by,transaction_kind)
          VALUES ($1,$2,'MD_SICK_SAFE',$3,$4,'Automatic accrual from finalized payroll',$5,$6,'PAYROLL_ACCRUAL')
          ON CONFLICT (source_run_employee_id,leave_type) WHERE source_run_employee_id IS NOT NULL DO NOTHING`, [req.canonicalAccess.facilityId, row.employee_id, run.pay_date, row.sick_leave_accrual_minutes, row.id, req.adminId])
      }
      // Defer the balance invariant until both the ledger debit and reservation
      // settlement exist. The employer lock serializes all competing leave use.
      await client.query('SET CONSTRAINTS payroll_check_reserved_pto DEFERRED')
      for(const row of employees.rows){
        const calculated=run.calculation_snapshot.employees.find(e=>Number(e.employeeId)===Number(row.employee_id))
        for(const item of calculated.payItems.filter(p=>p.kind==='LEAVE_PAYOUT')){
          const ledger=(await client.query(`INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason,created_by)
            VALUES($1,$2,'PTO',$3,$4,$5,$6) RETURNING id`,[req.canonicalAccess.facilityId,row.employee_id,run.pay_date,-item.minutes,`Unused PTO payout #${item.leavePayout.id} from payroll run ${run.id}`,req.adminId])).rows[0]
          const settled=await client.query("UPDATE payroll_leave_payout SET status='PAID',paid_run_employee_id=$1,leave_transaction_id=$2 WHERE id=$3 AND facility_id=$4 AND employee_id=$5 AND status='RESERVED' RETURNING id",[row.id,ledger.id,item.leavePayout.id,req.canonicalAccess.facilityId,row.employee_id])
          if(settled.rowCount!==1)throw new Error('PTO reservation changed during finalization.')
          await audit(client,req,'PTO_PAYOUT_PAID','payroll_leave_payout',item.leavePayout.id,null,{runId:run.id,runEmployeeId:row.id,leaveTransactionId:ledger.id,minutes:item.minutes,amountCents:item.amountCents})
        }
      }
      await client.query('SET CONSTRAINTS payroll_check_reserved_pto IMMEDIATE')
      const employer=(await client.query('SELECT * FROM payroll_settings WHERE facility_id=$1',[req.canonicalAccess.facilityId])).rows[0]
      for(const row of employees.rows){
        const employee=(await client.query('SELECT legal_first_name,legal_last_name,employee_number FROM payroll_employee WHERE id=$1',[row.employee_id])).rows[0]
        const calculated=run.calculation_snapshot.employees.find(e=>Number(e.employeeId)===Number(row.employee_id))
        await client.query('UPDATE payroll_run_employee SET statement_snapshot=$1 WHERE id=$2',[{correctionSettlements:correctionSettlements.get(Number(row.employee_id))||[],correctionSettlementIds:(correctionSettlements.get(Number(row.employee_id))||[]).map(s=>s.settlementId),sickLeaveCorrection:calculated?.sickLeaveCorrection,runKind:run.run_kind,employer:{name:employer.legal_business_name,address:employer.business_address,phone:employer.onboarding_policy?.businessPhone||''},employeeName:`${employee.legal_first_name} ${employee.legal_last_name}`,employeeNumber:employee.employee_number,payType:calculated?.payType,salaryCalculation:calculated?.salaryCalculation,authorizedSettlement:calculated?.authorizedSettlement,splitCompensation:calculated?.splitCompensation,employmentCompensation:calculated?.employmentCompensation,payItems:calculated?.payItems||[],retirement:retirementStatementSummary(calculated),supplementalTax:calculated?.supplementalTax,ficaWageBasis:calculated?.ficaWageBasis,incomeTaxWageBasis:calculated?.incomeTaxWageBasis&&row.federal_income_tax_cents!==null&&row.state_income_tax_cents!==null&&Number(row.federal_income_tax_cents)===calculated.federalIncomeTaxCents&&Number(row.state_income_tax_cents)===calculated.stateIncomeTaxCents?calculated.incomeTaxWageBasis:null,rateBreakdown:calculated?.rateBreakdown||[],sickLeaveAccrualPolicy:calculated?.sickLeaveAccrualPolicy,sickLeaveFraction:calculated?.sickLeaveFraction,sickLeaveEligibility:calculated?.sickLeaveEligibility,sickLeaveBalanceBeforeMinutes:calculated?.sickLeaveBalanceBeforeMinutes,sickLeaveYearAccruedBeforeMinutes:calculated?.sickLeaveYearAccruedBeforeMinutes,workweekPaymentVersion:calculated?.workweekPaymentVersion,workweekPayments:calculated?.workweekPayments||[]},row.id])
      }
      const updated = await client.query(`UPDATE payroll_run SET status='FINALIZED',finalized_at=now(),
        payment_confirmation_reference=$1,payment_recorded_by=$2,updated_at=now() WHERE id=$3 RETURNING *`, [confirmation, req.adminId, run.id])
      if(run.run_kind==='REGULAR')await client.query(`UPDATE payroll_pay_period SET status='PAID',updated_at=now() WHERE id=$1`, [run.pay_period_id])
      await audit(client, req, 'FINALIZE', 'payroll_run', run.id, run, { ...updated.rows[0], paymentConfirmationReference: '[recorded]' })
      await client.query('COMMIT')
      let quickbooksSync = null
      try {
        const connection = await pool.query('SELECT auto_sync,realm_id,environment FROM payroll_quickbooks_connection WHERE facility_id=$1', [req.canonicalAccess.facilityId])
        if (connection.rows[0]?.auto_sync) quickbooksSync = await syncQuickbooksRun(pool, req.canonicalAccess.facilityId, run.id, {automatic:true,expectedDestination:connection.rows[0]})
      } catch { quickbooksSync = { status: 'FAILED', message: 'Payroll is finalized. QuickBooks sync needs attention in Reports & QuickBooks.' } }
      return { ...updated.rows[0], quickbooksSync }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally { client.release() }
}
