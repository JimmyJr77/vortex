import { createPortalFamilyMember, initializeSignupBillingAccount, isAdultOnDate } from '../platform/familySignup.js'
import { id, inputError, pagination, pageResult, searchValue } from './common.js'

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'closed']
export function leadRow(row) {
  return { id: Number(row.id), firstName: row.first_name, lastName: row.last_name,
    email: row.email, phone: row.phone, status: (row.converted_member_id || row.member_id) ? 'converted' : row.lead_status || 'new',
    notes: row.admin_notes || '', message: row.message || '', createdAt: row.created_at,
    convertedMemberId: (row.converted_member_id ?? row.member_id) == null ? null : Number(row.converted_member_id ?? row.member_id) }
}

export async function listLeads(db, facilityId, query = {}) {
  const paging = pagination(query)
  const status = String(query.status || '')
  if (status && !LEAD_STATUSES.includes(status)) throw inputError('Invalid lead status.')
  const values = [id(facilityId, 'facility'), searchValue(query.search), status]
  const where = `facility_id = $1 AND archived IS NOT TRUE
    AND (concat_ws(' ',first_name,last_name,email,phone) ILIKE $2 ESCAPE '\\')
    AND ($3::text = '' OR (CASE WHEN COALESCE(converted_member_id,member_id) IS NOT NULL THEN 'converted' ELSE COALESCE(lead_status,'new') END) = $3)`
  const [rows, count] = await Promise.all([
    db.query(`SELECT id,first_name,last_name,email,phone,lead_status,admin_notes,message,created_at,converted_member_id,member_id
      FROM registrations WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT $4 OFFSET $5`, [...values, paging.pageSize, paging.offset]),
    db.query(`SELECT COUNT(*)::int AS total FROM registrations WHERE ${where}`, values),
  ])
  return pageResult(rows.rows.map(leadRow), count.rows[0].total, paging)
}

function text(value, label, max, required = false) {
  const normalized = String(value ?? '').trim()
  if (required && !normalized) throw inputError(`${label} is required.`)
  if (normalized.length > max) throw inputError(`${label} must be at most ${max} characters.`)
  return normalized || null
}

export function leadInput(body, { partial = false } = {}) {
  const result = {}
  for (const [key, label, max, required] of [['firstName','First name',50,true],['lastName','Last name',50,true],['email','Email',255,true],['phone','Phone',20,false],['notes','Notes',10000,false],['message','Message',10000,false]]) {
    if (!partial || Object.hasOwn(body, key)) result[key] = text(body[key], label, max, required)
  }
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw inputError('A valid email is required.')
  if (Object.hasOwn(body, 'status')) {
    if (!LEAD_STATUSES.includes(body.status) || body.status === 'converted') throw inputError('Use conversion to mark a lead as converted.')
    result.status = body.status
  }
  return result
}

export async function createLead(db, facilityId, body) {
  const input = leadInput(body)
  const result = await db.query(`INSERT INTO registrations
    (facility_id,first_name,last_name,email,phone,admin_notes,message,lead_status,contacted)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
  [id(facilityId),input.firstName,input.lastName,input.email,input.phone,input.notes,input.message,input.status || 'new',input.status === 'contacted'])
  return leadRow(result.rows[0])
}

export async function updateLead(db, facilityId, leadId, body) {
  const input = leadInput(body, { partial: true })
  const columns = { firstName:'first_name',lastName:'last_name',email:'email',phone:'phone',notes:'admin_notes',message:'message',status:'lead_status' }
  const values = [id(leadId), id(facilityId)]
  const updates = Object.entries(input).map(([key,value]) => { values.push(value); return `${columns[key]} = $${values.length}` })
  if (!updates.length) throw inputError('No supported changes were supplied.')
  if (input.status) updates.push(`contacted = (CASE WHEN converted_member_id IS NOT NULL THEN TRUE ELSE '${input.status}' <> 'new' END)`)
  const result = await db.query(`UPDATE registrations SET ${updates.join(',')},updated_at=now()
    WHERE id=$1 AND facility_id=$2 AND archived IS NOT TRUE RETURNING *`, values)
  if (!result.rows[0]) throw inputError('Lead not found.',404)
  return leadRow(result.rows[0])
}

/** Shared canonical member creation; never provisions remote billing or guesses identity. */
export async function createScopedMember(client, facilityId, body) {
  const firstName = text(body.firstName,'First name',100,true)
  const lastName = text(body.lastName,'Last name',100,true)
  const dateOfBirth = text(body.dateOfBirth,'Date of birth',10,true)
  const timezone = await client.query(`SELECT (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(timezone,''),'America/New_York'))::date::text AS today FROM facility WHERE id=$1`,[facilityId])
  if (!timezone.rows[0]) throw inputError('Facility not found.',404)
  if (dateOfBirth > timezone.rows[0].today) throw inputError('Date of birth cannot be in the future.')
  let familyId = body.familyId ? id(body.familyId,'family') : null
  let responsible = null
  const newFamily = !familyId
  if (familyId) {
    const family = await client.query(`SELECT f.id,m.email FROM family f
      LEFT JOIN family_billing_account b ON b.family_id=f.id AND b.is_active=TRUE
      LEFT JOIN member m ON m.id=b.payer_member_id AND m.facility_id=f.facility_id
      WHERE f.id=$1 AND f.facility_id=$2 AND f.archived=FALSE FOR UPDATE OF f`,[familyId,facilityId])
    if (!family.rows[0]) throw inputError('Family not found.',404)
    responsible = { email: family.rows[0].email }
  } else {
    if (!isAdultOnDate(dateOfBirth,timezone.rows[0].today)) throw inputError('A new household requires an adult payer. For a youth member choose an existing family and legal guardian.')
    const family = await client.query(`INSERT INTO family (facility_id,family_name) VALUES ($1,$2) RETURNING id`,[facilityId,text(body.familyName,'Family name',200) || `${lastName} family`])
    familyId = Number(family.rows[0].id)
  }
  let member
  try {
    member = await createPortalFamilyMember(client,{ facilityId,familyId,responsibleMember:responsible,
      legalGuardianMemberId:body.legalGuardianMemberId || null,
      input:{firstName,lastName,dateOfBirth,email:body.email || null,phone:body.phone || null} })
  } catch (error) {
    if (!error.code) error.statusCode = /already exists/.test(error.message) ? 409 : 400
    throw error
  }
  if (newFamily) await initializeSignupBillingAccount(client,{enabled:true,familyId,payerMemberId:member.id,billingEmail:member.email,billingPhone:member.phone})
  return { memberId:Number(member.id),familyId }
}

export async function convertLead(pool,{facilityId,leadId,userId,body={}}) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const locked = await client.query(`SELECT * FROM registrations WHERE id=$1 AND facility_id=$2 AND archived IS NOT TRUE FOR UPDATE`,[id(leadId),id(facilityId)])
    const lead = locked.rows[0]
    if (!lead) throw inputError('Lead not found.',404)
    const existingMemberId = lead.converted_member_id ?? lead.member_id
    if (existingMemberId) {
      const member = await client.query('SELECT id FROM member WHERE id=$1 AND facility_id=$2',[existingMemberId,facilityId])
      if (!member.rows[0]) throw inputError('Existing lead member is outside this facility.',409)
      const family = await client.query(`SELECT family_id FROM family_member WHERE member_id=$1 AND is_active=TRUE`,[existingMemberId])
      await client.query('COMMIT')
      return {memberId:Number(existingMemberId),familyId:family.rows[0]?.family_id == null ? null : Number(family.rows[0].family_id),alreadyConverted:true}
    }
    let result
    if (body.memberId) {
      const member = await client.query(`SELECT m.id,fm.family_id FROM member m LEFT JOIN family_member fm ON fm.member_id=m.id AND fm.is_active=TRUE
        WHERE m.id=$1 AND m.facility_id=$2 AND m.is_active=TRUE FOR UPDATE OF m`,[id(body.memberId,'member'),facilityId])
      if (!member.rows[0]) throw inputError('Member not found.',404)
      result={memberId:Number(member.rows[0].id),familyId:member.rows[0].family_id == null ? null : Number(member.rows[0].family_id)}
    } else result=await createScopedMember(client,facilityId,{firstName:lead.first_name,lastName:lead.last_name,email:lead.email,phone:lead.phone,...body})
    await client.query(`UPDATE registrations SET converted_member_id=$3,converted_at=now(),converted_by_user_id=$4,lead_status='converted',contacted=TRUE,updated_at=now() WHERE id=$1 AND facility_id=$2`,[lead.id,facilityId,result.memberId,userId])
    await client.query('COMMIT')
    return {...result,alreadyConverted:false}
  } catch(error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}
