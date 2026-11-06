import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { payrollEmployeeAuth, lockPayrollEmployeeSession } from '../payroll/employeeAuth.js'

export const consentText = 'I have read this document, acknowledge receipt and my responsibilities under it, and intend my typed name to be my electronic signature.'
export const documents = JSON.parse(fs.readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'))
for (const document of documents) {
  const file = fs.readFileSync(new URL(`./documents/${document.filename}`, import.meta.url))
  if (crypto.createHash('sha256').update(file).digest('hex') !== document.sha256) throw new Error('Legal document integrity check failed')
}
const fail = (message, status = 400) => Object.assign(new Error(message), { status })
export function validateSignature(body, document) {
  if (body?.sha256 !== document.sha256) throw fail('This document changed. Reload and review it before signing.', 409)
  if (body?.consent !== true || typeof body?.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 200) throw fail('Enter your full name and confirm your electronic signature consent.')
  return body.name.trim()
}
async function identity(db, req) {
  if (req.payrollEmployee) {
    const e = req.payrollEmployee
    if (e.employment_status === 'TERMINATED') throw fail('Active staff access required.', 403)
    const link = (await db.query('SELECT user_id FROM payroll_employee_account_link WHERE facility_id=$1 AND employee_id=$2', [e.facility_id, e.employee_id])).rows[0]
    return { facility: e.facility_id, user: link?.user_id ?? null, employee: e.employee_id, name: `${e.legal_first_name} ${e.legal_last_name}` }
  }
  const ctx = req.platformAuth
  const u = ctx.user
  const link = (await db.query(`SELECT l.employee_id,e.employment_status FROM payroll_employee_account_link l
    JOIN payroll_employee e ON e.id=l.employee_id AND e.facility_id=l.facility_id
    WHERE l.facility_id=$1 AND l.user_id=$2`, [u.facility_id, u.id])).rows[0]
  if (!ctx?.portalAccess?.admin && !ctx?.portalAccess?.coach && !['ACTIVE','ONBOARDING','LEAVE'].includes(link?.employment_status)) return null
  return { facility: u.facility_id, user: u.id, employee: link?.employee_id ?? null, name: u.full_name || u.email }
}
async function signatureRows(db, who) {
  return (await db.query(`SELECT id,document_id,document_sha256,document_version,document_title,signer_name,signed_at
    FROM staff_legal_signature WHERE facility_id=$1 AND (user_id=$2 OR employee_id=$3) ORDER BY signed_at DESC`, [who.facility, who.user, who.employee])).rows
}
function packet(rows) {
  return documents.map(d => ({ id: d.id, title: d.title, version: d.version, sha256: d.sha256, text: d.text,
    signature: rows.find(r => r.document_id === d.id && r.document_sha256 === d.sha256) ?? null }))
}
export function registerStaffLegalRoutes(app, pool, { staffAuth, adminAuth }) {
  const wrap = fn => async (req, res) => {
    try { await fn(req, res) } catch (e) {
      if (!e.status) console.error('[staff-legal]', e.message)
      res.status(e.status || 500).json({ success: false, message: e.status ? e.message : 'Unable to load or save legal acknowledgments.' })
    }
  }
  for (const [base, middleware] of [['/api/staff/legal', staffAuth], ['/api/payroll/employee/legal', payrollEmployeeAuth(pool)]]) {
    app.get(base, middleware, wrap(async (req, res) => {
      const who = await identity(pool, req)
      res.setHeader('Cache-Control', 'no-store')
      if (!who) return res.json({success:true,data:{eligible:false,documents:[],consentText,accountName:''}})
      res.json({ success: true, data: { documents: packet(await signatureRows(pool, who)), consentText, accountName: who.name } })
    }))
    app.get(`${base}/:id/file`, middleware, wrap(async (req, res) => {
      if (!await identity(pool, req)) throw fail('Active staff access required.', 403)
      const doc = documents.find(d => d.id === req.params.id)
      if (!doc) throw fail('Document not found.', 404)
      res.setHeader('Cache-Control', 'private, no-store')
      res.download(fileURLToPath(new URL(`./documents/${doc.filename}`, import.meta.url)), `${doc.id}-${doc.version}.docx`)
    }))
    app.post(`${base}/:id/sign`, middleware, wrap(async (req, res) => {
      const doc = documents.find(d => d.id === req.params.id)
      if (!doc) throw fail('Document not found.', 404)
      const name = validateSignature(req.body, doc)
      const db = await pool.connect()
      try {
        await db.query('BEGIN')
        if (req.payrollEmployee) await lockPayrollEmployeeSession(db, req.payrollEmployee, { method: 'POST', path: req.path })
        const who = await identity(db, req)
        if (!who) throw fail('Active staff access required.', 403)
        // Linked portal identities serialize to the same key; repeat submissions never replace a signature.
        await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`legal:${who.facility}:${who.employee ? `employee:${who.employee}` : `user:${who.user}`}`])
        const prior = (await signatureRows(db, who)).find(r => r.document_id === doc.id && r.document_sha256 === doc.sha256)
        if (!prior) await db.query(`INSERT INTO staff_legal_signature
          (facility_id,user_id,employee_id,document_id,document_sha256,document_version,document_title,signer_name,account_name,consent_text)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
        [who.facility, who.user, who.employee, doc.id, doc.sha256, doc.version, doc.title, name, who.name, consentText])
        const result = packet(await signatureRows(db, who))
        await db.query('COMMIT')
        res.json({ success: true, data: { documents: result, consentText, accountName: who.name } })
      } catch (e) { await db.query('ROLLBACK'); throw e } finally { db.release() }
    }))
  }
  app.get('/api/admin/legal/signatures', ...adminAuth, wrap(async (req, res) => {
    const facility = req.platformAuth.user.facility_id
    // Explicit account links deduplicate people. Shared email addresses never establish identity.
    const roster = (await pool.query(`
      SELECT 'user:'||a.user_id AS key,a.user_id,l.employee_id,COALESCE(a.full_name,a.email,'Staff') AS name,a.email,array_to_string(a.staff_roles,', ') AS roles
      FROM v_app_user_access_context a
      LEFT JOIN payroll_employee_account_link l ON l.user_id=a.user_id AND l.facility_id=a.facility_id
      WHERE a.facility_id=$1 AND a.is_active AND (a.can_access_admin_portal OR a.can_access_coach_portal)
      UNION ALL
      SELECT 'employee:'||e.id,l.user_id,e.id,concat_ws(' ',e.legal_first_name,e.legal_last_name),e.personal_email,'Payroll employee'
      FROM payroll_employee e
      LEFT JOIN payroll_employee_account_link l ON l.employee_id=e.id AND l.facility_id=e.facility_id
      WHERE e.facility_id=$1 AND e.employment_status IN ('ONBOARDING','ACTIVE','LEAVE')
      AND NOT EXISTS (SELECT 1 FROM v_app_user_access_context a WHERE a.user_id=l.user_id AND a.facility_id=e.facility_id
        AND a.is_active AND (a.can_access_admin_portal OR a.can_access_coach_portal))
      ORDER BY name,key`, [facility])).rows
    const signatures = (await pool.query('SELECT * FROM staff_legal_signature WHERE facility_id=$1 ORDER BY signed_at DESC', [facility])).rows
    res.setHeader('Cache-Control', 'no-store')
    res.json({ success: true, data: { documents: documents.map(({ id, title, version, sha256 }) => ({ id, title, version, sha256 })),
      staff: roster.map(person => ({ ...person, documents: documents.map(d => ({ id: d.id,
        signature: signatures.find(s => s.document_id === d.id && s.document_sha256 === d.sha256 &&
          ((person.user_id != null && s.user_id === person.user_id) || (person.employee_id != null && s.employee_id === person.employee_id))) ?? null })) })) } })
  }))
}
