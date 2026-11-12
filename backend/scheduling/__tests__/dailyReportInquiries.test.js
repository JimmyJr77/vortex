import test from 'node:test'
import assert from 'node:assert/strict'
import { loadDailyReportInquiries } from '../dailyReportInquiries.js'

test('daily inquiries retain siblings, legacy ages, and distinct requests from a single contact', async () => {
  const through = new Date('2026-11-12T11:00:00Z')
  const since = new Date('2026-11-11T11:00:00Z')
  const receivedAt = new Date('2026-11-12T04:30:00Z')
  const first = {
    id: 6,
    received_at: receivedAt,
    received_date: '2026-11-11',
    first_name: ' Casey ',
    last_name: 'Parent',
    email: 'casey@example.test',
    phone: '2025550100',
    submitter_role: 'Parent/Guardian',
    campers: [{ firstName: 'Taylor', dateOfBirth: '2018-11-12' }, { dateOfBirth: '2026-11-11' }],
    interests_array: ['Tumbling'],
    interests: 'Tumbling',
    class_types: ['Youth Classes'],
    message: 'A separate note',
  }
  const db = { query: async (_sql, bounds) => {
    assert.deepEqual(bounds, [since, through])
    return { rows: [
      first,
      { ...first, id: 5, email: 'CASEY@example.test' },
      { ...first, id: 4, message: 'A different request' },
      { id: 3, campers: [{ dateOfBirth: '2018-02-30' }], child_ages: [6, 9], interest: 'Camps' },
      { id: 2, athlete_age: 12, message: '  Interested in a Friday\ntrial.  ' },
    ] }
  } }

  const inquiries = await loadDailyReportInquiries(db, { since, through })
  assert.deepEqual(inquiries.map(({ id }) => id), [6, 4, 3, 2])
  assert.deepEqual(inquiries[0], {
    id: 6,
    receivedAt,
    contactName: 'Casey Parent',
    contactEmail: 'casey@example.test',
    contactPhone: '2025550100',
    contactRole: 'Parent/Guardian',
    children: [{ name: 'Taylor', age: 7 }, { name: '', age: 0 }],
    interest: 'Tumbling, Youth Classes',
  })
  assert.deepEqual(inquiries[2].children, [{ name: '', age: 6 }, { name: '', age: 9 }])
  assert.deepEqual(inquiries[3].children, [{ name: '', age: 12 }])
  assert.equal(inquiries[3].interest, 'Interested in a Friday trial.')
})
