import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sendAccountInviteEmail } from '../email/accountInviteEmail.js'

function isAdult(dateOfBirth) {
  if (!dateOfBirth) return true
  const birthDate = new Date(dateOfBirth)
  if (Number.isNaN(birthDate.getTime())) return true
  const today = new Date()
  const age = today.getFullYear() - birthDate.getFullYear()
    - (today.getMonth() < birthDate.getMonth()
      || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
  return age >= 18
}

async function generateFamilyUsername(client, familyName, facilityId) {
  const baseUsername = String(familyName || 'family')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20) || 'family'
  let username = baseUsername
  let counter = 1
  while (counter < 1000) {
    const result = await client.query(
      `SELECT id FROM family WHERE family_username = $1 AND facility_id = $2`,
      [username, facilityId],
    )
    if (result.rows.length === 0) return username
    username = `${baseUsername}${counter}`
    counter += 1
  }
  return `${baseUsername}${Date.now()}`
}

async function resolveFacilityId(client, explicitFacilityId = null) {
  if (explicitFacilityId) return Number(explicitFacilityId)
  const facility = await client.query(`SELECT id FROM facility ORDER BY id LIMIT 1`)
  if (facility.rows.length === 0) {
    const created = await client.query(
      `INSERT INTO facility (name, timezone) VALUES ('Vortex Athletics', 'America/New_York') RETURNING id`,
    )
    return Number(created.rows[0].id)
  }
  return Number(facility.rows[0].id)
}

async function activeRequiredWaiverTemplateIds(client, facilityId) {
  const res = await client.query(
    `
      SELECT id
      FROM waiver_template
      WHERE facility_id = $1
        AND active_from <= now()
        AND (active_to IS NULL OR active_to > now())
        AND is_required = TRUE
      ORDER BY id
    `,
    [facilityId],
  )
  return res.rows.map((row) => Number(row.id))
}

async function syncMemberWaiverFlag(client, memberId) {
  const member = await client.query(`SELECT facility_id FROM member WHERE id = $1`, [memberId])
  if (member.rows.length === 0) return
  const requiredIds = await activeRequiredWaiverTemplateIds(client, member.rows[0].facility_id)
  if (requiredIds.length === 0) return
  const accepted = await client.query(
    `
      SELECT COUNT(DISTINCT waiver_template_id)::int as count
      FROM member_waiver_acceptance
      WHERE member_id = $1 AND waiver_template_id = ANY($2::bigint[])
    `,
    [memberId, requiredIds],
  )
  const complete = Number(accepted.rows[0]?.count ?? 0) >= requiredIds.length
  await client.query(
    `
      UPDATE member
      SET has_completed_waivers = $2,
          waiver_completion_date = CASE WHEN $2 THEN COALESCE(waiver_completion_date, now()) ELSE waiver_completion_date END,
          updated_at = now()
      WHERE id = $1
    `,
    [memberId, complete],
  )
}

async function recordWaiverAcceptances(client, {
  memberIds,
  acceptedTemplateIds,
  signerMemberId,
  signatureName,
  comments,
  paymentPolicyAcknowledged,
  ipAddress,
  userAgent,
}) {
  const templatesRes = await client.query(
    `SELECT id, waiver_type FROM waiver_template WHERE id = ANY($1::bigint[])`,
    [acceptedTemplateIds],
  )
  for (const memberId of memberIds) {
    for (const templateId of acceptedTemplateIds) {
      const isPayment = templatesRes.rows.some(
        (row) => Number(row.id) === templateId && row.waiver_type === 'PAYMENT_POLICY',
      )
      await client.query(
        `
          INSERT INTO member_waiver_acceptance (
            member_id, waiver_template_id, accepted_by_member_id,
            signature_name, ip_address, user_agent, comments, payment_policy_acknowledged
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (member_id, waiver_template_id) DO UPDATE SET
            accepted_by_member_id = EXCLUDED.accepted_by_member_id,
            accepted_at = now(),
            signature_name = EXCLUDED.signature_name,
            ip_address = EXCLUDED.ip_address,
            user_agent = EXCLUDED.user_agent,
            comments = EXCLUDED.comments,
            payment_policy_acknowledged = EXCLUDED.payment_policy_acknowledged
        `,
        [
          memberId,
          templateId,
          signerMemberId,
          signatureName,
          ipAddress,
          userAgent,
          comments,
          isPayment ? paymentPolicyAcknowledged : false,
        ],
      )
    }
    await syncMemberWaiverFlag(client, memberId)
  }
}

async function createMemberRecord(client, facilityId, familyId, memberInput, { parentGuardianIds = [] } = {}) {
  const passwordHash = memberInput.password ? await bcrypt.hash(memberInput.password, 10) : null
  const dob = memberInput.dateOfBirth || memberInput.date_of_birth || null
  const minor = dob && !isAdult(dob)
  const address = memberInput.addressStreet || memberInput.address || null

  const inserted = await client.query(
    `
      INSERT INTO member (
        facility_id, family_id, first_name, last_name, email, phone,
        date_of_birth, username, password_hash,
        address, billing_street, billing_city, billing_state, billing_zip,
        parent_guardian_ids, gender, status, is_active, profile_complete, signup_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'legacy', TRUE, TRUE, $17)
      RETURNING *
    `,
    [
      facilityId,
      familyId,
      memberInput.firstName,
      memberInput.lastName,
      memberInput.email || null,
      memberInput.phone || null,
      dob,
      !minor && memberInput.username ? memberInput.username : null,
      !minor ? passwordHash : null,
      address,
      memberInput.addressStreet || memberInput.billingStreet || null,
      memberInput.addressCity || memberInput.billingCity || null,
      memberInput.addressState || memberInput.billingState || null,
      memberInput.addressZip || memberInput.billingZip || null,
      parentGuardianIds.length > 0 ? parentGuardianIds : null,
      memberInput.gender || null,
      memberInput.signupSource || 'family_signup',
    ],
  )
  const member = inserted.rows[0]

  await client.query(
    `
      INSERT INTO family_member (family_id, member_id, is_active)
      VALUES ($1, $2, TRUE)
      ON CONFLICT (family_id, member_id) DO UPDATE SET is_active = TRUE, updated_at = now()
    `,
    [familyId, member.id],
  )

  if (!minor && passwordHash && (memberInput.email || memberInput.username)) {
    const fullName = `${memberInput.firstName} ${memberInput.lastName}`.trim()
    await client.query(
      `
        INSERT INTO app_user (
          id, facility_id, role, email, phone, full_name, username, password_hash, is_active, address
        )
        VALUES ($1, $2, 'MEMBER_ATHLETE'::user_role, $3, $4, $5, $6, $7, TRUE, $8)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          full_name = EXCLUDED.full_name,
          username = EXCLUDED.username,
          password_hash = EXCLUDED.password_hash,
          updated_at = now()
      `,
      [
        member.id,
        facilityId,
        memberInput.email || null,
        memberInput.phone || null,
        fullName,
        memberInput.username || null,
        passwordHash,
        address,
      ],
    )
    await client.query(
      `INSERT INTO app_user_role (user_id, role) VALUES ($1, 'MEMBER_ATHLETE'::user_role) ON CONFLICT DO NOTHING`,
      [member.id],
    )
    await client.query(`UPDATE member SET app_user_id = $1 WHERE id = $1`, [member.id])
  }

  return member
}

async function processFamilySignup(client, payload, options = {}) {
  const {
    facilityId: explicitFacilityId = null,
    joinExistingFamilyId = null,
    ipAddress = null,
    userAgent = null,
  } = options

  const facilityId = await resolveFacilityId(client, explicitFacilityId)
  const primaryAdult = payload.primaryAdult
  const additionalMembers = Array.isArray(payload.additionalMembers) ? payload.additionalMembers : []
  const enrollments = Array.isArray(payload.enrollments) ? payload.enrollments : []
  const waivers = payload.waivers || {}

  if (!primaryAdult?.firstName || !primaryAdult?.lastName) {
    throw new Error('Primary adult first and last name are required.')
  }
  if (!primaryAdult.dateOfBirth || !isAdult(primaryAdult.dateOfBirth)) {
    throw new Error('Primary account holder must be 18 or older.')
  }
  if (!primaryAdult.password || primaryAdult.password.length < 8) {
    throw new Error('Primary adult password must be at least 8 characters.')
  }
  if (primaryAdult.password !== primaryAdult.confirmPassword) {
    throw new Error('Primary adult passwords do not match.')
  }

  const signatureName = String(waivers.signatureName || '').trim()
  const acceptedTemplateIds = (waivers.acceptedTemplateIds || []).map(Number).filter(Number.isFinite)
  const requiredIds = await activeRequiredWaiverTemplateIds(client, facilityId)
  const missing = requiredIds.filter((id) => !acceptedTemplateIds.includes(id))
  if (missing.length > 0) throw new Error('All required waivers must be accepted.')
  if (!signatureName) throw new Error('Waiver signature name is required.')

  const hasPaymentPolicy = await client.query(
    `SELECT 1 FROM waiver_template WHERE id = ANY($1::bigint[]) AND waiver_type = 'PAYMENT_POLICY' LIMIT 1`,
    [acceptedTemplateIds],
  )
  if (hasPaymentPolicy.rows.length > 0 && waivers.paymentPolicyAcknowledged !== true) {
    throw new Error('Payment policy acknowledgement is required.')
  }

  let familyId = joinExistingFamilyId ? Number(joinExistingFamilyId) : null
  let familyUsername = null

  if (familyId) {
    const familyCheck = await client.query(
      `SELECT id, family_username FROM family WHERE id = $1 AND archived = FALSE`,
      [familyId],
    )
    if (familyCheck.rows.length === 0) throw new Error('Existing family not found.')
    familyUsername = familyCheck.rows[0].family_username
  } else {
    const familyName = payload.familyName || `${primaryAdult.lastName} Family`
    familyUsername = await generateFamilyUsername(client, familyName, facilityId)
    const familyPasswordHash = await bcrypt.hash(primaryAdult.password, 10)
    const familyRes = await client.query(
      `
        INSERT INTO family (facility_id, family_name, family_username, family_password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, family_username
      `,
      [facilityId, familyName, familyUsername, familyPasswordHash],
    )
    familyId = Number(familyRes.rows[0].id)
    familyUsername = familyRes.rows[0].family_username
  }

  const payerMember = await createMemberRecord(client, facilityId, familyId, {
    ...primaryAdult,
    signupSource: options.admin ? 'admin_family_signup' : 'public_family_signup',
  })

  await client.query(
    `
      INSERT INTO family_billing_account (
        family_id, payer_member_id, billing_email, billing_phone,
        billing_street, billing_city, billing_state, billing_zip, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      ON CONFLICT (family_id) DO UPDATE SET
        payer_member_id = COALESCE(family_billing_account.payer_member_id, EXCLUDED.payer_member_id),
        billing_email = EXCLUDED.billing_email,
        billing_phone = EXCLUDED.billing_phone,
        billing_street = EXCLUDED.billing_street,
        billing_city = EXCLUDED.billing_city,
        billing_state = EXCLUDED.billing_state,
        billing_zip = EXCLUDED.billing_zip,
        is_active = TRUE,
        updated_at = now()
    `,
    [
      familyId,
      payerMember.id,
      primaryAdult.email || null,
      primaryAdult.phone || null,
      primaryAdult.addressStreet || null,
      primaryAdult.addressCity || null,
      primaryAdult.addressState || null,
      primaryAdult.addressZip || null,
    ],
  )

  const createdMembers = [{ clientIndex: 0, member: payerMember }]

  for (let i = 0; i < additionalMembers.length; i += 1) {
    const input = additionalMembers[i]
    const contact = input.sameContactAsPrimary
      ? {
          email: primaryAdult.email,
          phone: primaryAdult.phone,
          addressStreet: primaryAdult.addressStreet,
          addressCity: primaryAdult.addressCity,
          addressState: primaryAdult.addressState,
          addressZip: primaryAdult.addressZip,
        }
      : {}
    const merged = { ...input, ...contact }
    const dob = merged.dateOfBirth
    const minor = dob && !isAdult(dob)
    const guardians = minor ? [payerMember.id] : []
    if (minor && (!merged.firstName || !merged.lastName)) {
      throw new Error('Each family athlete needs a first and last name.')
    }
    if (!minor && merged.password && merged.password !== merged.confirmPassword) {
      throw new Error(`Passwords do not match for ${merged.firstName} ${merged.lastName}.`)
    }
    const member = await createMemberRecord(client, facilityId, familyId, merged, {
      parentGuardianIds: guardians,
    })
    createdMembers.push({ clientIndex: i + 1, member })
  }

  const memberIdByClientIndex = Object.fromEntries(
    createdMembers.map(({ clientIndex, member }) => [clientIndex, Number(member.id)]),
  )
  const allMemberIds = createdMembers.map(({ member }) => Number(member.id))

  for (const enrollment of enrollments) {
    const memberId = memberIdByClientIndex[Number(enrollment.memberIndex)]
    const programId = Number(enrollment.programId)
    if (!Number.isFinite(memberId) || !Number.isFinite(programId)) continue
    await client.query(
      `
        INSERT INTO member_program (member_id, program_id, days_per_week, selected_days, created_at, updated_at)
        VALUES ($1, $2, COALESCE($3, 1), COALESCE($4, ARRAY[]::text[]), now(), now())
      `,
      [
        memberId,
        programId,
        enrollment.daysPerWeek ?? 1,
        enrollment.selectedDays ?? [],
      ],
    )
  }

  await recordWaiverAcceptances(client, {
    memberIds: allMemberIds,
    acceptedTemplateIds,
    signerMemberId: payerMember.id,
    signatureName,
    comments: waivers.comments ?? null,
    paymentPolicyAcknowledged: waivers.paymentPolicyAcknowledged === true,
    ipAddress,
    userAgent,
  })

  return {
    familyId,
    familyUsername,
    payerMemberId: payerMember.id,
    memberIds: allMemberIds,
    loginMemberId: payerMember.id,
  }
}

function tokenFrom(req) {
  const authHeader = req.headers.authorization
  return authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
}

async function loadAdminAuth(pool, jwtSecret, req) {
  const token = tokenFrom(req)
  if (!token) return null
  const decoded = jwt.verify(token, jwtSecret)
  const userId = decoded.userId || decoded.adminId
  if (!userId) return null
  const userRes = await pool.query(
    `
      SELECT au.id, au.facility_id, au.is_active, COALESCE(ap.is_master_admin, false) as is_master_admin
      FROM app_user au
      LEFT JOIN admin_profile ap ON ap.user_id = au.id
      WHERE au.id = $1
    `,
    [userId],
  )
  if (userRes.rows.length === 0 || userRes.rows[0].is_active === false) return null
  return userRes.rows[0]
}

function adminAuthMiddleware(pool, jwtSecret) {
  return async (req, res, next) => {
    try {
      const user = await loadAdminAuth(pool, jwtSecret, req)
      if (!user) return res.status(401).json({ success: false, message: 'Admin authentication required' })
      req.adminAuth = user
      next()
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' })
    }
  }
}

export function registerFamilySignupRoutes(app, pool, { jwtSecret, publicAppUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173' }) {
  app.get('/api/signup/programs', async (_req, res) => {
    try {
      const result = await pool.query(
        `
          SELECT p.id, p.name, p.display_name, p.programs_id
          FROM program p
          WHERE COALESCE(p.is_active, TRUE) = TRUE
          ORDER BY COALESCE(p.display_name, p.name), p.id
          LIMIT 200
        `,
      )
      res.json({ success: true, data: result.rows })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.get('/api/signup/waivers', async (_req, res) => {
    try {
      const facilityId = await resolveFacilityId(pool)
      const result = await pool.query(
        `
          SELECT id, name, version, body, waiver_type, is_required
          FROM waiver_template
          WHERE facility_id = $1
            AND active_from <= now()
            AND (active_to IS NULL OR active_to > now())
          ORDER BY
            CASE waiver_type
              WHEN 'ASSUMPTION_OF_RISK' THEN 1
              WHEN 'RELEASE_OF_LIABILITY' THEN 2
              WHEN 'MEDICAL_EMERGENCY' THEN 3
              WHEN 'PAYMENT_POLICY' THEN 4
              ELSE 99
            END,
            name
        `,
        [facilityId],
      )
      res.json({ success: true, data: result.rows })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.post('/api/signup/family', async (req, res) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await processFamilySignup(client, req.body, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      })
      await client.query('COMMIT')
      res.json({ success: true, data: result })
    } catch (error) {
      await client.query('ROLLBACK')
      res.status(400).json({ success: false, message: error.message })
    } finally {
      client.release()
    }
  })

  app.post('/api/admin/signup/family', adminAuthMiddleware(pool, jwtSecret), async (req, res) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await processFamilySignup(client, req.body, {
        facilityId: req.adminAuth.facility_id,
        joinExistingFamilyId: req.body?.existingFamilyId ?? null,
        admin: true,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      })
      await client.query('COMMIT')
      res.json({ success: true, data: result })
    } catch (error) {
      await client.query('ROLLBACK')
      res.status(400).json({ success: false, message: error.message })
    } finally {
      client.release()
    }
  })

  app.post('/api/signup/minor-start', async (req, res) => {
    const client = await pool.connect()
    try {
      const minor = req.body?.minor || req.body
      const parentEmail = String(req.body?.parentEmail || req.body?.parent_email || '').trim().toLowerCase()
      const enrollments = Array.isArray(req.body?.enrollments) ? req.body.enrollments : []

      if (!minor?.firstName || !minor?.lastName) {
        return res.status(400).json({ success: false, message: 'Minor first and last name are required.' })
      }
      if (!minor.dateOfBirth || isAdult(minor.dateOfBirth)) {
        return res.status(400).json({ success: false, message: 'Minor must be under 18.' })
      }
      if (!parentEmail) {
        return res.status(400).json({ success: false, message: 'Parent or guardian email is required.' })
      }

      await client.query('BEGIN')
      const facilityId = await resolveFacilityId(client)
      const familyName = `${minor.lastName} Family (Pending)`
      const familyUsername = await generateFamilyUsername(client, familyName, facilityId)
      const tempPasswordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10)
      const familyRes = await client.query(
        `
          INSERT INTO family (facility_id, family_name, family_username, family_password_hash)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [facilityId, familyName, familyUsername, tempPasswordHash],
      )
      const familyId = Number(familyRes.rows[0].id)

      const memberRes = await client.query(
        `
          INSERT INTO member (
            facility_id, family_id, first_name, last_name, email, phone, date_of_birth, gender,
            status, is_active, signup_source
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'legacy', TRUE, 'minor_invite_pending')
          RETURNING *
        `,
        [
          facilityId,
          familyId,
          minor.firstName,
          minor.lastName,
          minor.email || null,
          minor.phone || null,
          minor.dateOfBirth,
          minor.gender || null,
        ],
      )
      const minorMember = memberRes.rows[0]
      await client.query(
        `
          INSERT INTO family_member (family_id, member_id, is_active)
          VALUES ($1, $2, TRUE)
          ON CONFLICT (family_id, member_id) DO UPDATE SET is_active = TRUE, updated_at = now()
        `,
        [familyId, minorMember.id],
      )

      for (const enrollment of enrollments) {
        const programId = Number(enrollment.programId)
        if (!Number.isFinite(programId)) continue
        await client.query(
          `
            INSERT INTO member_program (member_id, program_id, days_per_week, selected_days, created_at, updated_at)
            VALUES ($1, $2, COALESCE($3, 1), COALESCE($4, ARRAY[]::text[]), now(), now())
          `,
          [minorMember.id, programId, enrollment.daysPerWeek ?? 1, enrollment.selectedDays ?? []],
        )
      }

      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = await bcrypt.hash(token, 10)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await client.query(
        `
          INSERT INTO account_invite (
            facility_id, token_hash, inviter_member_id, invitee_email,
            pending_family_id, pending_payload, expires_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        `,
        [
          facilityId,
          tokenHash,
          minorMember.id,
          parentEmail,
          familyId,
          JSON.stringify({ minorMemberId: minorMember.id, enrollments }),
          expiresAt,
        ],
      )

      await client.query('COMMIT')

      const inviteUrl = `${publicAppUrl.replace(/\/$/, '')}/signup/invite?token=${token}`
      const emailResult = await sendAccountInviteEmail({
        to: parentEmail,
        inviteUrl,
        minorName: `${minor.firstName} ${minor.lastName}`,
      })

      res.json({
        success: true,
        data: {
          familyId,
          minorMemberId: minorMember.id,
          inviteSent: emailResult.sent === true,
          inviteUrl: emailResult.sent ? undefined : inviteUrl,
        },
      })
    } catch (error) {
      await client.query('ROLLBACK')
      res.status(400).json({ success: false, message: error.message })
    } finally {
      client.release()
    }
  })

  app.post('/api/signup/invite/:token/verify', async (req, res) => {
    try {
      const token = String(req.params.token || '').trim()
      if (!token) return res.status(400).json({ success: false, message: 'Token is required.' })

      const invites = await pool.query(
        `
          SELECT ai.*, m.first_name as minor_first_name, m.last_name as minor_last_name, m.date_of_birth as minor_dob
          FROM account_invite ai
          JOIN member m ON m.id = ai.inviter_member_id
          WHERE ai.used_at IS NULL AND ai.expires_at > now()
          ORDER BY ai.created_at DESC
          LIMIT 50
        `,
      )
      let invite = null
      for (const row of invites.rows) {
        if (await bcrypt.compare(token, row.token_hash)) {
          invite = row
          break
        }
      }
      if (!invite) return res.status(404).json({ success: false, message: 'Invite link is invalid or expired.' })

      res.json({
        success: true,
        data: {
          inviteeEmail: invite.invitee_email,
          pendingFamilyId: invite.pending_family_id,
          minor: {
            firstName: invite.minor_first_name,
            lastName: invite.minor_last_name,
            dateOfBirth: invite.minor_dob,
          },
          pendingPayload: invite.pending_payload,
        },
      })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.post('/api/signup/invite/:token/complete', async (req, res) => {
    const client = await pool.connect()
    try {
      const token = String(req.params.token || '').trim()
      const invites = await client.query(
        `
          SELECT *
          FROM account_invite
          WHERE used_at IS NULL AND expires_at > now()
          ORDER BY created_at DESC
          LIMIT 50
        `,
      )
      let invite = null
      for (const row of invites.rows) {
        if (await bcrypt.compare(token, row.token_hash)) {
          invite = row
          break
        }
      }
      if (!invite) return res.status(404).json({ success: false, message: 'Invite link is invalid or expired.' })

      const primaryAdult = req.body?.primaryAdult || req.body?.adult || req.body
      const waivers = req.body?.waivers || {}
      const familyId = Number(invite.pending_family_id)
      const payload = invite.pending_payload || {}
      const minorMemberId = Number(payload.minorMemberId)

      await client.query('BEGIN')

      const result = await processFamilySignup(client, {
        primaryAdult,
        additionalMembers: [],
        enrollments: [],
        waivers,
        familyName: `${primaryAdult.lastName} Family`,
      }, {
        joinExistingFamilyId: familyId,
        facilityId: invite.facility_id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      })

      if (Number.isFinite(minorMemberId)) {
        await client.query(
          `
            UPDATE member
            SET parent_guardian_ids = ARRAY[$2]::bigint[], updated_at = now()
            WHERE id = $1
          `,
          [minorMemberId, result.payerMemberId],
        )
        const requiredIds = await activeRequiredWaiverTemplateIds(client, invite.facility_id)
        const acceptedTemplateIds = (waivers.acceptedTemplateIds || []).map(Number).filter(Number.isFinite)
        if (acceptedTemplateIds.length > 0) {
          await recordWaiverAcceptances(client, {
            memberIds: [minorMemberId],
            acceptedTemplateIds,
            signerMemberId: result.payerMemberId,
            signatureName: String(waivers.signatureName || '').trim(),
            comments: waivers.comments ?? null,
            paymentPolicyAcknowledged: waivers.paymentPolicyAcknowledged === true,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') ?? null,
          })
        } else if (requiredIds.length > 0) {
          throw new Error('All required waivers must be accepted for the minor.')
        }
      }

      await client.query(`UPDATE account_invite SET used_at = now() WHERE id = $1`, [invite.id])
      await client.query('COMMIT')

      res.json({ success: true, data: result })
    } catch (error) {
      await client.query('ROLLBACK')
      res.status(400).json({ success: false, message: error.message })
    } finally {
      client.release()
    }
  })
}
