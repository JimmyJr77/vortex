import { acquisitionCampaign, acquisitionReferrerHost } from './businessAcquisition.js'
import { sanitizeHostname } from './eventContract.js'

const aliases = new Map(Object.entries({
  google: 'Google', 'google search': 'Google',
  googleads: 'Google Ads', 'google ads': 'Google Ads', adwords: 'Google Ads', 'google adwords': 'Google Ads',
  gbp: 'Google Business Profile', gmb: 'Google Business Profile',
  'google business profile': 'Google Business Profile', 'google my business': 'Google Business Profile',
  'google maps': 'Google Maps',
  bing: 'Bing', duckduckgo: 'DuckDuckGo', yahoo: 'Yahoo', ecosia: 'Ecosia', 'brave search': 'Brave Search',
  yelp: 'Yelp', 'yelp business': 'Yelp',
  facebook: 'Facebook', fb: 'Facebook',
  instagram: 'Instagram', ig: 'Instagram',
  meta: 'Meta',
  threads: 'Threads', tiktok: 'TikTok', youtube: 'YouTube', reddit: 'Reddit', linkedin: 'LinkedIn',
  pinterest: 'Pinterest', snapchat: 'Snapchat', nextdoor: 'Nextdoor', x: 'X', twitter: 'X',
  internal: 'Internal', 'staff entry': 'Internal', 'staff recorded': 'Internal', 'admin portal': 'Internal',
  direct: 'Direct', unknown: 'Unknown',
}))

const paidAliases = new Map(Object.entries({
  'facebook ads': 'Facebook', 'fb ads': 'Facebook',
  'instagram ads': 'Instagram', 'ig ads': 'Instagram',
  'meta ads': 'Meta', 'yelp ads': 'Yelp',
  'microsoft ads': 'Microsoft Ads', 'bing ads': 'Microsoft Ads',
}))

const domains = new Map(Object.entries({
  'googleadservices.com': 'Google Ads',
  'maps.app.goo.gl': 'Google Maps',
  'bing.com': 'Bing', 'duckduckgo.com': 'DuckDuckGo', 'search.yahoo.com': 'Yahoo',
  'ecosia.org': 'Ecosia', 'search.brave.com': 'Brave Search',
  'facebook.com': 'Facebook', 'fb.com': 'Facebook', 'fb.me': 'Facebook',
  'instagram.com': 'Instagram', 'instagr.am': 'Instagram',
  'threads.net': 'Threads', 'threads.com': 'Threads',
  'tiktok.com': 'TikTok', 'youtube.com': 'YouTube', 'youtu.be': 'YouTube',
  'reddit.com': 'Reddit', 'redd.it': 'Reddit', 'linkedin.com': 'LinkedIn', 'lnkd.in': 'LinkedIn',
  'pinterest.com': 'Pinterest', 'pin.it': 'Pinterest', 'snapchat.com': 'Snapchat',
  'nextdoor.com': 'Nextdoor', 'x.com': 'X', 'twitter.com': 'X', 't.co': 'X',
}))

const searchSources = new Set(['Google', 'Google Ads', 'Google Business Profile', 'Google Maps',
  'Bing', 'Microsoft Ads', 'DuckDuckGo', 'Yahoo', 'Ecosia', 'Brave Search'])
const socialSources = new Set(['Facebook', 'Instagram', 'Meta', 'Threads', 'TikTok', 'YouTube',
  'Reddit', 'LinkedIn', 'Pinterest', 'Snapchat', 'Nextdoor', 'X'])
const explicitMedia = new Map(Object.entries({
  email: 'Email', 'e mail': 'Email', newsletter: 'Email', sms: 'SMS', text: 'SMS', 'text message': 'SMS',
  referral: 'Referral', affiliate: 'Affiliate', internal: 'Internal', direct: 'Direct',
  qr: 'QR code', 'qr code': 'QR code',
  organicsearch: 'Organic search', 'organic search': 'Organic search', seo: 'Organic search',
  social: 'Organic social', 'social media': 'Organic social', organicsocial: 'Organic social',
  'organic social': 'Organic social', 'social organic': 'Organic social',
}))

const labelKey = (label) => label?.toLowerCase().replace(/[-_\s]+/g, ' ')

function platformForHost(host) {
  if (!host) return null
  if (/^maps\.google\.(?:[a-z]{2,3}|(?:co|com)\.[a-z]{2})$/.test(host)) return 'Google Maps'
  if (/^google\.(?:[a-z]{2,3}|(?:co|com)\.[a-z]{2})$/.test(host)) return 'Google'
  if (/(?:^|\.)yelp\.(?:[a-z]{2,3}|co\.[a-z]{2})$/.test(host)) return 'Yelp'
  for (const [domain, platform] of domains) {
    if (host === domain || host.endsWith(`.${domain}`)) return platform
  }
  return null
}

function describePaidChannel(medium, source, paidSource) {
  if (['paid search', 'paidsearch', 'sem'].includes(medium)) return 'Paid search'
  if (['paid social', 'paidsocial', 'social paid'].includes(medium)) return 'Paid social'
  if (['display', 'paid display', 'programmatic', 'banner'].includes(medium)) return 'Display'
  if (paidSource || /^(?:cpc|ppc|paid|cpm|cpv|cpa|sponsored|ads|advertising)(?: |$)/.test(medium ?? '')) {
    if (socialSources.has(source)) return 'Paid social'
    if (searchSources.has(source) && ['cpc', 'ppc'].includes(medium)) return 'Paid search'
    return 'Paid'
  }
  return null
}

export function describeAcquisitionSource(row) {
  const tags = acquisitionCampaign(row)
  const medium = tags.medium?.toLowerCase() ?? null
  const mediumKey = labelKey(medium)
  const campaign = tags.campaign
  const host = (row.referrer_host && acquisitionReferrerHost(`https://${row.referrer_host}`)) ||
    acquisitionReferrerHost(row.legacy_referrer)
  const referrer = platformForHost(host) ?? host
  const sourceKey = labelKey(tags.source)
  const paidAlias = paidAliases.get(sourceKey)
  let source = paidAlias ?? aliases.get(sourceKey) ?? platformForHost(sanitizeHostname(tags.source)) ??
    tags.source?.toLowerCase() ?? referrer

  if (source === 'Meta' && ['Facebook', 'Instagram'].includes(referrer)) source = referrer

  let channel
  const isSelfReported = mediumKey === 'self reported'
  const isPaidSource = Boolean(paidAlias) || ['Google Ads', 'Microsoft Ads'].includes(source)
  const paidChannel = describePaidChannel(mediumKey, source, isPaidSource)

  if (isSelfReported && source) channel = 'Self-reported'
  else if (paidChannel) {
    channel = paidChannel
    if (source === 'Google') source = 'Google Ads'
    if (source === 'Bing') source = 'Microsoft Ads'
  } else if (explicitMedia.has(mediumKey)) channel = explicitMedia.get(mediumKey)
  else if (mediumKey === 'organic') {
    channel = source === 'Yelp' ? 'Referral' : socialSources.has(source) ? 'Organic social' : 'Organic search'
  } else if (source === 'Internal' || source === 'Direct' || source === 'Unknown') channel = source
  else if (!mediumKey && referrer && source === referrer && searchSources.has(referrer)) channel = 'Organic search'
  else if (!mediumKey && referrer && source === referrer && socialSources.has(referrer)) channel = 'Organic social'
  else if (!mediumKey && (source === 'Yelp' || (!tags.source && referrer))) channel = 'Referral'
  else if (tags.source || medium || campaign) channel = 'Tagged campaign'
  else if (row.staff_entry) channel = 'Internal'
  else if (row.has_visit) channel = 'Direct'
  else channel = 'Unknown'

  if (!source) source = ['Internal', 'Direct'].includes(channel) ? channel : 'Unknown'
  return { source, channel, medium, campaign }
}
