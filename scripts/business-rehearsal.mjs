import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const REQUIRED_CONFIRMATION = 'I_UNDERSTAND_REHEARSAL_WRITES_DATA'

const BASE_URL = (process.env.BUSINESS_BASE_URL || '').replace(/\/+$/, '')
const MEMBER_LOGIN = process.env.REHEARSAL_MEMBER_LOGIN || ''
const MEMBER_PASSWORD = process.env.REHEARSAL_MEMBER_PASSWORD || ''
const ADMIN_LOGIN = process.env.REHEARSAL_ADMIN_LOGIN || ''
const ADMIN_PASSWORD = process.env.REHEARSAL_ADMIN_PASSWORD || ''
const CONFIRM = process.env.BUSINESS_REHEARSAL_CONFIRM || ''

const CHARGE_AMOUNT_CENTS = Number(process.env.REHEARSAL_CHARGE_AMOUNT_CENTS || 2500)
const PAYMENT_AMOUNT_CENTS = Number(process.env.REHEARSAL_PAYMENT_AMOUNT_CENTS || CHARGE_AMOUNT_CENTS)
const JSON_OUT = process.env.BUSINESS_REHEARSAL_JSON_OUT || ''

function fail(message) {
  throw new Error(message)
}

function assertEnv() {
  if (!BASE_URL) fail('Missing BUSINESS_BASE_URL')
  if (!MEMBER_LOGIN || !MEMBER_PASSWORD) fail('Missing REHEARSAL_MEMBER_LOGIN/REHEARSAL_MEMBER_PASSWORD')
  if (!ADMIN_LOGIN || !ADMIN_PASSWORD) fail('Missing REHEARSAL_ADMIN_LOGIN/REHEARSAL_ADMIN_PASSWORD')
  if (CONFIRM !== REQUIRED_CONFIRMATION) {
    fail(`Set BUSINESS_REHEARSAL_CONFIRM=${REQUIRED_CONFIRMATION} to run write operations`)
  }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await response.json().catch(() => ({}))
  return { response, json }
}

function expectOk({ response, json }, label) {
  if (!response.ok || json.success === false) {
    const reason = json.message || `${response.status} ${response.statusText}`
    fail(`${label} failed: ${reason}`)
  }
}

function dayNumberToName(dayNum) {
  const map = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return map[dayNum] || null
}

function chooseSelectedDays(iteration) {
  const envSelected = process.env.REHEARSAL_SELECTED_DAYS
  if (envSelected) {
    const days = envSelected
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    if (days.length > 0) return days
  }
  const fromIteration = (iteration?.daysOfWeek || [])
    .map(dayNumberToName)
    .filter(Boolean)
  if (fromIteration.length > 0) return [fromIteration[0]]
  return ['Monday']
}

async function run() {
  assertEnv()
  const startedAt = new Date().toISOString()
  const reference = process.env.REHEARSAL_EXTERNAL_REFERENCE || `rehearsal-${Date.now()}`
  const results = {
    startedAt,
    baseUrl: BASE_URL,
    reference,
    checks: [],
  }

  // 1) Member login
  const memberLogin = await api('/api/members/login', {
    method: 'POST',
    body: { emailOrUsername: MEMBER_LOGIN, password: MEMBER_PASSWORD },
  })
  expectOk(memberLogin, 'Member login')
  const memberToken = memberLogin.json.token
  const memberAccount = memberLogin.json.member || {}
  if (!memberToken) fail('Member login succeeded but no token returned')
  results.checks.push({ step: 'member-login', ok: true, availablePortals: memberAccount.availablePortals || [] })

  // 2) Member profile / family context
  const me = await api('/api/members/me', { token: memberToken })
  expectOk(me, 'Member profile')
  const meData = me.json.member || me.json.data || {}
  const familyId = Number(process.env.REHEARSAL_FAMILY_ID || memberAccount.familyId || meData.familyId)
  if (!Number.isFinite(familyId)) fail('Could not resolve familyId from member context')

  const familyMembers = memberAccount.familyMembers || meData.familyMembers || []
  const familyMemberId = Number(
    process.env.REHEARSAL_MEMBER_ID || memberAccount.memberId || meData.id || familyMembers[0]?.id,
  )
  if (!Number.isFinite(familyMemberId)) fail('Could not resolve family member id for enrollment')
  results.checks.push({ step: 'member-profile', ok: true, familyId, familyMemberId })

  // 3) Discover program + iteration
  const programsRes = await api('/api/members/programs', { token: memberToken })
  expectOk(programsRes, 'Fetch member programs')
  const programs = programsRes.json.data || programsRes.json.programs || []
  const chosenProgramId = Number(process.env.REHEARSAL_PROGRAM_ID || programs[0]?.id)
  if (!Number.isFinite(chosenProgramId)) fail('Could not resolve program id')

  const iterationsRes = await api(`/api/members/programs/${chosenProgramId}/iterations`, { token: memberToken })
  expectOk(iterationsRes, 'Fetch program iterations')
  const iterations = iterationsRes.json.data || []
  const chosenIterationId = Number(process.env.REHEARSAL_ITERATION_ID || iterations[0]?.id)
  if (!Number.isFinite(chosenIterationId)) fail('Could not resolve iteration id')
  const chosenIteration = iterations.find((row) => Number(row.id) === chosenIterationId) || iterations[0]
  const selectedDays = chooseSelectedDays(chosenIteration)
  const daysPerWeek = Number(process.env.REHEARSAL_DAYS_PER_WEEK || selectedDays.length)
  results.checks.push({
    step: 'program-selection',
    ok: true,
    programId: chosenProgramId,
    iterationId: chosenIterationId,
    selectedDays,
  })

  // 4) Enrollment -> billing_charge hook
  const enroll = await api('/api/members/enroll', {
    method: 'POST',
    token: memberToken,
    body: {
      programId: chosenProgramId,
      familyMemberId,
      iterationId: chosenIterationId,
      daysPerWeek,
      selectedDays,
      chargeAmountCents: CHARGE_AMOUNT_CENTS,
      chargeDescription: `Business rehearsal enrollment ${startedAt}`,
    },
  })
  expectOk(enroll, 'Enrollment')
  results.checks.push({ step: 'enrollment', ok: true, amountCents: CHARGE_AMOUNT_CENTS })

  // 5) Admin login
  const adminLogin = await api('/api/admin/login', {
    method: 'POST',
    body: { usernameOrEmail: ADMIN_LOGIN, password: ADMIN_PASSWORD },
  })
  expectOk(adminLogin, 'Admin login')
  const adminToken = adminLogin.json.token || adminLogin.json.adminToken
  const adminAccount = adminLogin.json.admin || {}
  if (!adminToken) fail('Admin login succeeded but no token returned')
  results.checks.push({ step: 'admin-login', ok: true, availablePortals: adminAccount.availablePortals || [] })

  // 6) Billing summary generation
  const providerConfig = await api('/api/admin/billing/provider-config', { token: adminToken })
  expectOk(providerConfig, 'Billing provider config')

  const billingAccount = await api(`/api/admin/families/${familyId}/billing-account`, { token: adminToken })
  expectOk(billingAccount, 'Billing account fetch')

  const statement = await api(`/api/admin/families/${familyId}/statements`, {
    method: 'POST',
    token: adminToken,
    body: { status: 'issued' },
  })
  expectOk(statement, 'Billing statement creation')
  results.checks.push({ step: 'billing-summary', ok: true })

  // 7) External reconciliation
  const payment = await api(`/api/admin/families/${familyId}/payments`, {
    method: 'POST',
    token: adminToken,
    body: {
      amountCents: PAYMENT_AMOUNT_CENTS,
      method: 'external_card',
      note: `Business rehearsal external reconciliation ${startedAt}`,
      externalProcessor: providerConfig.json?.data?.externalProcessorName || 'External Payment Processor',
      externalReference: reference,
      externalStatus: 'settled',
    },
  })
  expectOk(payment, 'External payment reconciliation')
  results.checks.push({ step: 'external-reconciliation', ok: true, reference, amountCents: PAYMENT_AMOUNT_CENTS })

  // 8) Member portal visibility checks
  const memberStatements = await api('/api/members/billing/statements', { token: memberToken })
  expectOk(memberStatements, 'Member statements visibility')
  const memberPayments = await api('/api/members/billing/payments', { token: memberToken })
  expectOk(memberPayments, 'Member payments visibility')
  const reconciledVisible = (memberPayments.json?.data || []).some((row) => row.externalReference === reference)
  if (!reconciledVisible) fail('Reconciled payment is not visible in member portal payment history')

  const memberPortals = new Set(memberAccount.availablePortals || [])
  if (!memberPortals.has('member')) fail('Member portal visibility check failed: member portal missing')

  const adminPortals = new Set(adminAccount.availablePortals || [])
  if (!adminPortals.has('admin')) fail('Admin portal visibility check failed: admin portal missing')

  // Optional coach portal access probe for accounts that advertise coach portal.
  if (memberPortals.has('coach')) {
    const coachProbe = await api('/api/coach/classes', { token: memberToken })
    expectOk(coachProbe, 'Coach portal visibility (member account)')
  }
  if (adminPortals.has('coach')) {
    const coachProbe = await api('/api/coach/classes', { token: adminToken })
    expectOk(coachProbe, 'Coach portal visibility (admin account)')
  }
  results.checks.push({ step: 'portal-visibility', ok: true, memberPortals: [...memberPortals], adminPortals: [...adminPortals] })
  results.endedAt = new Date().toISOString()
  results.ok = true

  if (JSON_OUT) {
    await mkdir(path.dirname(JSON_OUT), { recursive: true })
    await writeFile(JSON_OUT, JSON.stringify(results, null, 2), 'utf8')
  }

  console.log('\n✅ Business rehearsal PASSED')
  console.log(JSON.stringify(results, null, 2))
}

run().catch((error) => {
  console.error('\n❌ Business rehearsal FAILED')
  console.error(error.message)
  process.exit(1)
})
