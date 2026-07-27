import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isMembershipValidThrough,
  membershipRenewsOnFromPurchase,
  toUtcDateString,
} from '../membershipAnniversary.js'
import { resolveMembershipRenewsOn } from '../../billing/billingAccountView.js'

test('membershipRenewsOnFromPurchase adds one calendar year', () => {
  const renews = membershipRenewsOnFromPurchase(new Date(Date.UTC(2026, 6, 27)))
  assert.equal(toUtcDateString(renews), '2027-07-27')
})

test('isMembershipValidThrough is true before anniversary and false after', () => {
  const purchased = new Date(Date.UTC(2026, 6, 27))
  assert.equal(isMembershipValidThrough(purchased, new Date(Date.UTC(2027, 6, 26))), true)
  assert.equal(isMembershipValidThrough(purchased, new Date(Date.UTC(2027, 6, 27))), false)
})

test('resolveMembershipRenewsOn prefers earliest upcoming annual subscription date', () => {
  const date = resolveMembershipRenewsOn({
    subscriptions: [
      {
        status: 'active',
        sourceType: 'annual_membership',
        nextBillDate: '2027-10-01',
      },
      {
        status: 'active',
        sourceType: 'annual_membership',
        nextBillDate: '2027-07-27',
      },
      {
        status: 'active',
        sourceType: 'scheduling_signup',
        nextBillDate: '2026-08-01',
      },
    ],
    asOf: new Date(Date.UTC(2026, 6, 28)),
  })
  assert.equal(date, '2027-07-27')
})

test('resolveMembershipRenewsOn falls back to redemption purchase + 1 year', () => {
  const date = resolveMembershipRenewsOn({
    subscriptions: [],
    redemptions: [{ created_at: '2026-07-27T16:10:22.674Z' }],
    asOf: new Date(Date.UTC(2026, 6, 28)),
  })
  assert.equal(date, '2027-07-27')
})
