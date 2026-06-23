#!/usr/bin/env node
/**
 * Email domain authentication diagnostic.
 *
 * Queries public DNS for SPF, DKIM, and DMARC and reports what is present, missing, or
 * suspicious. It NEVER prints secrets. It does NOT modify DNS.
 *
 * IMPORTANT: DNS presence alone does NOT prove that a specific sent message passed
 * authentication. To prove pass/fail you must inspect the Authentication-Results header
 * of a real message delivered to Gmail/Outlook/Yahoo (see docs/email-monitoring-runbook.md).
 *
 * Usage:
 *   node scripts/check-email-domain-authentication.mjs [domain] [--selector google] [--selector s1]
 *   node scripts/check-email-domain-authentication.mjs vortexathletics.com
 *
 * Exit codes:
 *   0  all required production records present
 *   1  one or more required records missing/invalid
 *   2  usage / resolver error
 */

import { Resolver } from 'node:dns/promises'

const resolver = new Resolver()

function parseArgs(argv) {
  const args = { domain: null, selectors: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--selector') {
      const v = argv[i + 1]
      if (v) {
        args.selectors.push(v)
        i += 1
      }
    } else if (!a.startsWith('--') && !args.domain) {
      args.domain = a
    }
  }
  return args
}

const ICONS = { ok: '✅', warn: '⚠️ ', fail: '❌', info: 'ℹ️ ' }
function line(status, msg) {
  console.log(`${ICONS[status] || ''} ${msg}`)
}

async function txt(name) {
  try {
    const records = await resolver.resolveTxt(name)
    return records.map((chunks) => chunks.join(''))
  } catch (err) {
    if (err && (err.code === 'ENOTFOUND' || err.code === 'ENODATA')) return []
    throw err
  }
}

async function checkSpf(domain) {
  console.log(`\n— SPF (${domain}) —`)
  const records = (await txt(domain)).filter((r) => /^v=spf1/i.test(r))
  if (records.length === 0) {
    line('fail', 'No SPF record (v=spf1) found.')
    return false
  }
  if (records.length > 1) {
    line('fail', `Multiple SPF records found (${records.length}). There must be exactly one.`)
    records.forEach((r) => line('info', r))
    return false
  }
  const spf = records[0]
  line('ok', `SPF present: ${spf}`)

  const lookupMechs = (spf.match(/\b(include|a|mx|ptr|exists|redirect):?/gi) || []).length
  if (lookupMechs > 10) {
    line('fail', `SPF appears to exceed the 10 DNS-lookup limit (~${lookupMechs} lookups).`)
    return false
  }
  if (lookupMechs >= 8) {
    line('warn', `SPF is close to the 10-lookup limit (~${lookupMechs}). Review before adding senders.`)
  }
  if (/include:_spf\.google\.com/i.test(spf)) {
    line('ok', 'Google sender authorized (include:_spf.google.com).')
  } else {
    line('warn', 'Google (_spf.google.com) is not in SPF — required while sending via Google SMTP.')
  }
  if (/[~-]all/.test(spf)) {
    line('ok', `SPF qualifier present (${(spf.match(/[~-]all/) || [])[0]}).`)
  } else {
    line('warn', 'SPF has no ~all/-all qualifier; consider ~all (softfail) or -all (fail).')
  }
  return true
}

async function checkDkim(domain, selectors) {
  console.log(`\n— DKIM (${domain}) —`)
  if (selectors.length === 0) {
    line('warn', 'No DKIM selectors provided. Pass --selector <name> (Google Workspace uses "google").')
    line('info', 'Skipping DKIM lookup; cannot confirm signing key presence.')
    return true // not a hard failure without a known selector
  }
  let allOk = true
  for (const sel of selectors) {
    const name = `${sel}._domainkey.${domain}`
    const records = (await txt(name)).filter((r) => /v=DKIM1|p=/i.test(r))
    if (records.length === 0) {
      line('fail', `No DKIM record at ${name}.`)
      allOk = false
      continue
    }
    const rec = records.join('')
    const pMatch = rec.match(/p=([A-Za-z0-9+/=]+)/)
    if (!pMatch || !pMatch[1]) {
      line('fail', `DKIM record at ${name} has no public key (p=). Key may be revoked.`)
      allOk = false
      continue
    }
    // Rough key-size estimate from base64 public key length.
    const approxBits = Math.round((pMatch[1].length * 6) / 8 / 1.4 / 128) * 1024
    line('ok', `DKIM present at ${name} (~${approxBits >= 2048 ? '2048-bit+' : '1024-bit'} key).`)
    if (approxBits < 2048) {
      line('warn', 'DKIM key looks like 1024-bit. Use 2048-bit where the provider/DNS support it.')
    }
  }
  return allOk
}

async function checkDmarc(domain) {
  console.log(`\n— DMARC (_dmarc.${domain}) —`)
  const records = (await txt(`_dmarc.${domain}`)).filter((r) => /^v=DMARC1/i.test(r))
  if (records.length === 0) {
    line('fail', 'No DMARC record. Publish at least v=DMARC1; p=none; rua=mailto:<monitored>.')
    return false
  }
  if (records.length > 1) {
    line('fail', `Multiple DMARC records (${records.length}); there must be exactly one.`)
    return false
  }
  const dmarc = records[0]
  line('ok', `DMARC present: ${dmarc}`)
  const policy = (dmarc.match(/\bp=([a-z]+)/i) || [])[1]
  if (policy === 'none') {
    line('warn', 'Policy is p=none (monitoring only). Move toward quarantine/reject once senders are verified.')
  } else if (policy) {
    line('ok', `Policy is p=${policy}.`)
  }
  if (!/rua=/i.test(dmarc)) {
    line('warn', 'No rua= aggregate-report address. Add rua=mailto:<monitored mailbox or DMARC service>.')
  }
  return true
}

async function main() {
  const { domain, selectors } = parseArgs(process.argv.slice(2))
  const root = domain || process.env.VORTEX_ROOT_DOMAIN || 'vortexathletics.com'
  const sels = selectors.length ? selectors : (process.env.DKIM_SELECTORS || 'google').split(',').map((s) => s.trim()).filter(Boolean)

  console.log(`Email authentication check for: ${root}`)
  console.log('(DNS presence does not prove a sent message passed authentication.)')

  let ok = true
  try {
    ok = (await checkSpf(root)) && ok
    ok = (await checkDkim(root, sels)) && ok
    ok = (await checkDmarc(root)) && ok
  } catch (err) {
    line('fail', `Resolver error: ${err?.message || err}`)
    process.exit(2)
  }

  console.log('')
  if (ok) {
    line('ok', 'Required production records present. Verify real-message pass via Authentication-Results.')
    process.exit(0)
  }
  line('fail', 'One or more required records are missing/invalid. See docs/email-dns-checklist.md.')
  process.exit(1)
}

main()
