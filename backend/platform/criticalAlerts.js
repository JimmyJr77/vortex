/**
 * Critical message alerts — email/SMS for is_critical messages.
 */

/** Extract @mentions — supports @user:123, @member:456, or @Name tokens. */
export function parseMentions(body) {
  const text = String(body || '')
  const mentions = []
  const seen = new Set()
  const patterns = [
    /@user:(\d+)/gi,
    /@member:(\d+)/gi,
    /@([a-zA-Z][a-zA-Z0-9_.-]{1,48})/g,
  ]
  for (const re of patterns.slice(0, 2)) {
    let m
    const regex = new RegExp(re.source, re.flags)
    while ((m = regex.exec(text)) !== null) {
      const id = Number(m[1])
      if (!Number.isFinite(id)) continue
      const key = re.source.startsWith('@user') ? `u:${id}` : `m:${id}`
      if (seen.has(key)) continue
      seen.add(key)
      if (re.source.startsWith('@user')) mentions.push({ userId: id })
      else mentions.push({ memberId: id })
    }
  }
  return mentions
}

async function loadParticipantEmails(pool, threadId) {
  const [users, members] = await Promise.all([
    pool.query(
      `SELECT DISTINCT au.id, au.email, au.full_name AS name
       FROM coaching.message_thread_participant p
       JOIN app_user au ON au.id = p.user_id
       WHERE p.thread_id = $1 AND au.email IS NOT NULL AND au.email <> ''`,
      [threadId],
    ),
    pool.query(
      `SELECT DISTINCT m.id, m.email,
         TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS name
       FROM coaching.message_thread_participant p
       JOIN member m ON m.id = p.member_id
       WHERE p.thread_id = $1 AND m.email IS NOT NULL AND m.email <> ''`,
      [threadId],
    ),
  ])
  return {
    users: users.rows,
    members: members.rows,
  }
}

async function loadOptInPreferences(pool, facilityId, { userIds, memberIds }) {
  const prefs = []
  if (userIds.length > 0) {
    const r = await pool.query(
      `SELECT * FROM coaching.notification_preference
       WHERE facility_id = $1 AND user_id = ANY($2::bigint[])`,
      [facilityId, userIds],
    )
    prefs.push(...r.rows)
  }
  if (memberIds.length > 0) {
    const r = await pool.query(
      `SELECT * FROM coaching.notification_preference
       WHERE facility_id = $1 AND member_id = ANY($2::bigint[])`,
      [facilityId, memberIds],
    )
    prefs.push(...r.rows)
  }
  return prefs
}

/**
 * Resolve Twilio HTTP Basic credentials.
 * Prefers API Key (SK… + secret); falls back to Account SID + Auth Token.
 * Account SID is always required for the REST URL path.
 */
export function resolveTwilioCredentials(env = process.env) {
  const accountSid = String(env.TWILIO_ACCOUNT_SID || '').trim()
  const fromNumber = String(env.TWILIO_FROM_NUMBER || '').trim()
  const apiKeySid = String(env.TWILIO_API_KEY_SID || '').trim()
  const apiKeySecret = String(env.TWILIO_API_KEY_SECRET || '').trim()
  const authToken = String(env.TWILIO_AUTH_TOKEN || '').trim()

  if (!accountSid || !fromNumber) {
    return { ok: false, reason: 'twilio_not_configured' }
  }

  if (apiKeySid && apiKeySecret) {
    return {
      ok: true,
      accountSid,
      fromNumber,
      authMode: 'api_key',
      basicUser: apiKeySid,
      basicPass: apiKeySecret,
    }
  }

  if (authToken) {
    return {
      ok: true,
      accountSid,
      fromNumber,
      authMode: 'auth_token',
      basicUser: accountSid,
      basicPass: authToken,
    }
  }

  return { ok: false, reason: 'twilio_not_configured' }
}

async function sendSmsStub({ phone, body }) {
  const creds = resolveTwilioCredentials()
  if (!creds.ok) {
    console.log('[criticalAlerts] SMS skipped — TWILIO_* env not configured')
    return { sent: false, reason: creds.reason }
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`
    const auth = Buffer.from(`${creds.basicUser}:${creds.basicPass}`).toString('base64')
    const from = creds.fromNumber
    const params = new URLSearchParams({ To: phone, From: from, Body: body.slice(0, 1600) })
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
    if (!res.ok) {
      const text = await res.text()
      console.warn('[criticalAlerts] Twilio error:', res.status, text)
      return { sent: false, reason: 'twilio_error' }
    }
    return { sent: true }
  } catch (err) {
    console.warn('[criticalAlerts] SMS failed:', err.message)
    return { sent: false, reason: err.message }
  }
}

export function shouldSendCriticalSms(sendCriticalSms, pref) {
  return Boolean(sendCriticalSms && pref?.allow_critical_sms && pref?.phone_e164)
}

export async function sendCriticalMessageAlerts(pool, {
  thread,
  message,
  createInAppNotification,
  sendEmail,
  sendCriticalSms = false,
}) {
  if (!message?.is_critical) return { skipped: true, reason: 'not_critical' }

  const facilityId = thread.facility_id
  const preview = String(message.body || '').slice(0, 160)
  const title = thread.subject || 'Critical message'

  const participants = await loadParticipantEmails(pool, thread.id)
  const userIds = participants.users.map((u) => Number(u.id))
  const memberIds = participants.members.map((m) => Number(m.id))
  const prefs = await loadOptInPreferences(pool, facilityId, { userIds, memberIds })
  const prefByUser = new Map(prefs.filter((p) => p.user_id).map((p) => [Number(p.user_id), p]))
  const prefByMember = new Map(prefs.filter((p) => p.member_id).map((p) => [Number(p.member_id), p]))

  const results = { inApp: 0, email: 0, sms: 0 }

  await Promise.all([
    ...participants.users.map(async (u) => {
      const pref = prefByUser.get(Number(u.id))
      await createInAppNotification({
        facilityId,
        recipientUserId: u.id,
        kind: 'message',
        title: `[Critical] ${title}`,
        body: preview,
        payload: { thread_id: thread.id, message_id: message.id, critical: true },
      }).catch(() => {})
      results.inApp += 1

      if (pref?.allow_critical_email && u.email && sendEmail) {
        await sendEmail({
          to: u.email,
          subject: `[Critical] ${title}`,
          text: `${preview}\n\nLog in to Vortex to read the full message.`,
          html: `<p><strong>Critical message</strong></p><p>${preview}</p><p>Log in to Vortex to read the full message.</p>`,
          category: 'security_notification',
        }).catch(() => {})
        results.email += 1
      }
      if (shouldSendCriticalSms(sendCriticalSms, pref)) {
        const sms = await sendSmsStub({ phone: pref.phone_e164, body: `[Critical] ${title}: ${preview}` })
        if (sms.sent) results.sms += 1
      }
    }),
    ...participants.members.map(async (m) => {
      const pref = prefByMember.get(Number(m.id))
      await createInAppNotification({
        facilityId,
        recipientMemberId: m.id,
        kind: 'message',
        title: `[Critical] ${title}`,
        body: preview,
        payload: { thread_id: thread.id, message_id: message.id, critical: true },
      }).catch(() => {})
      results.inApp += 1

      if (pref?.allow_critical_email && m.email && sendEmail) {
        await sendEmail({
          to: m.email,
          subject: `[Critical] ${title}`,
          text: `${preview}\n\nLog in to Vortex to read the full message.`,
          html: `<p><strong>Critical message</strong></p><p>${preview}</p><p>Log in to Vortex to read the full message.</p>`,
          category: 'security_notification',
        }).catch(() => {})
        results.email += 1
      }
      if (shouldSendCriticalSms(sendCriticalSms, pref)) {
        const sms = await sendSmsStub({ phone: pref.phone_e164, body: `[Critical] ${title}: ${preview}` })
        if (sms.sent) results.sms += 1
      }
    }),
  ])

  return results
}
