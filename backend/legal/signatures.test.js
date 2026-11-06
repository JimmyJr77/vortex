import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { documents, validateSignature } from './registerRoutes.js'
import { legalHarness } from './testing/harness.js'

test('electronic signature requires explicit consent and current document hash', () => {
  const doc = documents[0]
  assert.throws(() => validateSignature({ name: 'Staff Member', consent: true, sha256: 'old' }, doc), /changed/)
  for (const body of [{ name: 'Staff Member' }, { name: ' ' }, { name: 'A' }, { name: 'X'.repeat(201) }, { name: 99 }]) {
    assert.throws(() => validateSignature({ ...body, consent: false, sha256: doc.sha256 }, doc), /consent/)
  }
  assert.equal(validateSignature({ name: ' Staff Member ', consent: true, sha256: doc.sha256 }, doc), 'Staff Member')
})

test('authenticated signatures are durable isolated immutable and shared only through explicit account links', { skip: !process.env.LEGAL_TEST_DATABASE_URL }, async t => {
  const h = await legalHarness(); t.after(h.close)
  const api = async (token, path = '/api/staff/legal', body, status = 200) => {
    const r = await fetch(h.url + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const j = await r.json(); assert.equal(r.status, status, JSON.stringify(j)); return j.data
  }
  await api('invalid', undefined, undefined, 401); assert.equal((await api('member')).eligible, false)
  await api('member', `/api/staff/legal/${documents[0].id}/sign`, {name:'Not Staff',consent:true,sha256:documents[0].sha256}, 403)
  await api('coach', '/api/admin/legal/signatures', undefined, 403)
  const initial = await api('coach'); assert.equal(initial.documents.length, 3); assert.ok(initial.documents.every(d => !d.signature))
  const doc = initial.documents[0], path = `/api/staff/legal/${doc.id}/sign`
  await api('coach', path, { name: 'Linked Coach', consent: true, sha256: 'outdated' }, 409)
  await api('coach', path, { name: 'Linked Coach', consent: false, sha256: doc.sha256 }, 400)
  const signed = await api('coach', path, { name: 'Linked Coach', consent: true, sha256: doc.sha256, userId: 999, facilityId: 2 })
  const original = signed.documents[0].signature; assert.ok(original.signed_at)
  const payroll = await api('linked-payroll', '/api/payroll/employee/legal'); assert.equal(payroll.documents[0].signature.id, original.id)
  await Promise.all(Array.from({ length: 4 }, () => api('coach', path, { name: 'Different Typed Name', consent: true, sha256: doc.sha256 })))
  assert.deepEqual((await api('coach')).documents[0].signature, original)
  assert.equal((await h.pool.query('SELECT count(*) FROM staff_legal_signature')).rows[0].count, '1')
  assert.ok((await api('shared')).documents.every(d => !d.signature)); assert.ok((await api('other')).documents.every(d => !d.signature))
  assert.ok((await api('payroll-only', '/api/payroll/employee/legal')).documents.every(d => !d.signature))
  const payrollDoc = documents[1]
  const employeeSigned = await api('payroll-only', `/api/payroll/employee/legal/${payrollDoc.id}/sign`, {name:'Payroll Only',consent:true,sha256:payrollDoc.sha256})
  assert.equal(employeeSigned.documents[1].signature.signer_name, 'Payroll Only')
  assert.equal((await api('coach')).documents[1].signature, null)
  await h.pool.query('INSERT INTO payroll_employee_account_link VALUES(11,1,5)')
  const linkedMember = await api('member')
  assert.equal(linkedMember.documents[1].signature.id, employeeSigned.documents[1].signature.id)
  await api('former-payroll', '/api/payroll/employee/legal', undefined, 403)
  const report = await api('admin', '/api/admin/legal/signatures')
  assert.equal(report.staff.length, 4); assert.equal(report.staff.find(s => s.user_id === '1').documents[0].signature.id, original.id)
  assert.ok(!JSON.stringify(report).includes('Other Facility')); assert.ok(!JSON.stringify(report).includes('Former Staff'))
  await assert.rejects(h.pool.query("UPDATE staff_legal_signature SET signer_name='Override'"), /immutable/)
  await assert.rejects(h.pool.query('DELETE FROM staff_legal_signature'), /immutable/)
  const file = await fetch(`${h.url}/api/staff/legal/${doc.id}/file`, { headers: { Authorization: 'Bearer coach' } })
  assert.equal(file.status, 200); assert.equal(crypto.createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex'), doc.sha256)
  assert.equal((await fetch(`${h.url}/api/staff/legal/${doc.id}/file`)).status, 401)
  await h.pool.query("UPDATE payroll_employee_session SET revoked_at=now() WHERE employee_id=10")
  await api('linked-payroll', '/api/payroll/employee/legal', undefined, 401)
})
