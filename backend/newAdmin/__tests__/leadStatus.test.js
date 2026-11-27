import test from 'node:test'
import assert from 'node:assert/strict'
import { leadStatusMetadata } from '../leadStatus.js'

test('lead status hides editing stages while retaining overlapping participation tags', () => {
  for (const lead_status of ['new', 'contacted', 'qualified', 'closed']) {
    assert.deepEqual(leadStatusMetadata({ lead_status, inquiry_source: 'admin_portal', invitation: { purpose: 'trial' } }), {
      displayStatus: 'lead', participationTags: ['inquiry','free_trial'], convertedAt: null,
    })
  }
  assert.deepEqual(leadStatusMetadata({ lead_status: 'qualified', inquiry_source: 'free_trial' }), {
    displayStatus: 'lead', participationTags: ['free_trial'], convertedAt: null,
  })
  assert.deepEqual(leadStatusMetadata({ is_converted: false, member_id: 3, inquiry_source: 'admin_portal', has_trial_provenance: true }), {
    displayStatus: 'lead', participationTags: ['inquiry','free_trial'], convertedAt: null,
  })
})

test('only saved conversion dates are exposed and editing timestamps never substitute', () => {
  assert.deepEqual(leadStatusMetadata({ lead_status: 'converted', converted_at: '2026-11-20T13:00:00Z' }), {
    displayStatus: 'converted', participationTags: ['inquiry'], convertedAt: '2026-11-20T13:00:00.000Z',
  })
  assert.equal(leadStatusMetadata({ lead_status: 'converted', updated_at: '2026-11-20T13:00:00Z' }).convertedAt, null)
  assert.equal(leadStatusMetadata({ lead_status: 'converted', converted_at: 'invalid' }).convertedAt, null)
  assert.equal(leadStatusMetadata({ lead_status: 'qualified', converted_at: '2026-11-20T13:00:00Z' }).convertedAt, null)
  assert.deepEqual(leadStatusMetadata({ display_status: 'converted', metadata_converted_at: '2026-11-20T13:00:00Z', participation_tags: ['inquiry','free_trial','drop_in','recent_drop','qualified','inquiry'] }), {
    displayStatus: 'converted', participationTags: ['inquiry','free_trial','drop_in','recent_drop'], convertedAt: '2026-11-20T13:00:00.000Z',
  })
})
