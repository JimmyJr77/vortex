import assert from 'node:assert/strict'
import test from 'node:test'
import { describeAcquisitionSource } from '../acquisitionSource.js'

function expectSource(row, source, channel) {
  const described = describeAcquisitionSource(row)
  assert.deepEqual([described.source, described.channel], [source, channel])
}

test('classifies Google Ads separately from organic Google traffic', () => {
  assert.deepEqual(describeAcquisitionSource({
    source: ' GOOGLE ', medium: 'CPC', campaign: 'Trial classes', referrer_host: 'google.com',
  }), { source: 'Google Ads', channel: 'Paid search', medium: 'cpc', campaign: 'Trial classes' })
  expectSource({ source: 'google_ads', medium: 'display' }, 'Google Ads', 'Display')
  expectSource({ source: 'google', medium: 'paid_display' }, 'Google Ads', 'Display')
  expectSource({ referrer_host: 'www.google.co.uk' }, 'Google', 'Organic search')
  expectSource({ source: 'google', medium: 'organic', referrer_host: 'www.google.com' }, 'Google', 'Organic search')
  expectSource({ source: 'gbp', medium: 'organic' }, 'Google Business Profile', 'Organic search')
  expectSource({ referrer_host: 'search.yahoo.com' }, 'Yahoo', 'Organic search')
  expectSource({ source: 'google' }, 'Google', 'Tagged campaign')
})

test('uses Meta placements only when the tags or referrer identify a platform', () => {
  expectSource({ source: 'FB', medium: 'paid_social', referrer_host: 'instagram.com' }, 'Facebook', 'Paid social')
  expectSource({ source: 'ig', medium: 'cpc' }, 'Instagram', 'Paid social')
  expectSource({ source: 'meta', medium: 'cpc' }, 'Meta', 'Paid social')
  expectSource({ source: 'meta', medium: 'cpc', referrer_host: 'l.instagram.com' }, 'Instagram', 'Paid social')
  expectSource({ source: 'meta', medium: 'cpc', referrer_host: 'other.com' }, 'Meta', 'Paid social')
  expectSource({ referrer_host: 'lm.facebook.com', fbclid: 'fixture' }, 'Facebook', 'Organic social')
  expectSource({ has_visit: true, fbclid: 'fixture' }, 'Direct', 'Direct')
  expectSource({ legacy_referrer: 'https://l.instagram.com/?u=private' }, 'Instagram', 'Organic social')
})

test('normalizes Yelp while preserving other referrers and campaign media', () => {
  expectSource({ legacy_referrer: 'https://m.yelp.com/biz/vortex' }, 'Yelp', 'Referral')
  expectSource({ source: 'YELP', medium: 'cpc' }, 'Yelp', 'Paid')
  expectSource({ source: 'yelp.com', medium: 'organic' }, 'Yelp', 'Referral')
  expectSource({ source: 'school_newsletter', medium: 'email' }, 'school_newsletter', 'Email')
  expectSource({ source: 'parent outreach', medium: 'sms' }, 'parent outreach', 'SMS')
  expectSource({ source: 'open house', medium: 'qr' }, 'open house', 'QR code')
  expectSource({ source: 'school partner', medium: 'backpack-flyer' }, 'school partner', 'Tagged campaign')
  expectSource({ referrer_host: 'www.not-facebook.com' }, 'not-facebook.com', 'Referral')
})

test('distinguishes recorded sources, staff entry, direct, and missing attribution', () => {
  expectSource({ staff_entry: true, source: 'Google', medium: 'self_reported' }, 'Google', 'Self-reported')
  expectSource({ staff_entry: true, source: 'Google Ads', medium: 'self_reported' }, 'Google Ads', 'Self-reported')
  expectSource({ staff_entry: true }, 'Internal', 'Internal')
  expectSource({ source: 'internal', medium: 'internal' }, 'Internal', 'Internal')
  expectSource({ source: 'vortex', medium: 'email', staff_entry: true }, 'vortex', 'Email')
  expectSource({ referrer_host: 'vortex-gymnastics.com', legacy_referrer: 'https://www.yelp.com' }, 'Yelp', 'Referral')
  expectSource({ has_visit: true, referrer_host: 'vortexathletics.com' }, 'Direct', 'Direct')
  expectSource({ has_visit: true, referrer_host: 'checkout.stripe.com' }, 'Direct', 'Direct')
  expectSource({ source: 'person@example.com', referrer_host: 'bad host' }, 'Unknown', 'Unknown')
  expectSource({ campaign: 'Fall trial' }, 'Unknown', 'Tagged campaign')
})
