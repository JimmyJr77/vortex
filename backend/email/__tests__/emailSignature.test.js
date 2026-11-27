import assert from 'node:assert/strict'
import test from 'node:test'
import nodemailer from 'nodemailer'
import { registerEmailPool } from '../emailDeliveryStore.js'
import { EMAIL_CATEGORIES, isMarketing } from '../emailCategories.js'
import { composeEmailHtml, emailFooterHtml, escapeHtml, EMAIL_LAYOUT_MARKER, EMAIL_LAYOUT_VERSION, EMAIL_LOGO_CID, EMAIL_LOGO_URL, EMAIL_SIGNATURE, EMAIL_SIGNATURE_LOGO_CID, EMAIL_SIGNATURE_MARKER } from '../emailHtml.js'

const occurrences = (text, value) => String(text).split(value).length - 1
const readableHtml = html => String(html).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

function assertFullSignature(mail) {
  assert.ok(mail.text.includes(EMAIL_SIGNATURE.name))
  assert.ok(mail.html.includes(escapeHtml(EMAIL_SIGNATURE.name)), 'HTML identifies the home-page brand in the logo alternative text')
  for (const value of [EMAIL_SIGNATURE.address, EMAIL_SIGNATURE.website, EMAIL_SIGNATURE.phone]) {
    assert.ok(mail.text.includes(value), `plain text includes ${value}`)
    assert.ok(readableHtml(mail.html).includes(value), `HTML includes ${value}`)
  }
  assert.equal(occurrences(mail.text, EMAIL_SIGNATURE.address), 1, 'plain-text signature is added once')
  assert.equal(occurrences(readableHtml(mail.html), EMAIL_SIGNATURE.address), 1, 'HTML signature is added once')
  assert.equal(occurrences(mail.text, 'Warmly,'), 1)
  assert.equal(occurrences(mail.text, 'The Vortex Athletics Team'), 1)
  assert.equal(occurrences(readableHtml(mail.html), 'Warmly,'), 1)
  assert.equal(occurrences(readableHtml(mail.html), 'The Vortex Athletics Team'), 1)
  assert.ok(mail.text.indexOf('Warmly,') < mail.text.indexOf(EMAIL_SIGNATURE.address))
  assert.ok(mail.html.indexOf('Warmly,') < mail.html.lastIndexOf(`cid:${EMAIL_SIGNATURE_LOGO_CID}`))
  assert.ok(readableHtml(mail.html).indexOf('Warmly,') < readableHtml(mail.html).indexOf(EMAIL_SIGNATURE.address))
  const logo = mail.attachments.find(attachment => attachment.cid === EMAIL_SIGNATURE_LOGO_CID)
  assert.ok(logo, 'the signature logo is attached inline')
  assert.equal(logo.filename, 'vortex-athletics-gymnastics-logo.png')
  assert.equal(logo.contentType, 'image/png')
  assert.equal(logo.path, EMAIL_SIGNATURE.logoUrl)
  assert.equal(EMAIL_SIGNATURE.logoUrl, EMAIL_LOGO_URL, 'header and signature share the home-page artwork')
  assert.equal(EMAIL_SIGNATURE_LOGO_CID, EMAIL_LOGO_CID)
  assert.equal(occurrences(mail.html, `cid:${EMAIL_LOGO_CID}`), 2, 'the header and signature display the same inline logo')
  assert.equal(mail.attachments.length, 1, 'the shared logo is attached only once')
}

test('all outbound SMTP messages receive one complete Vortex signature without weakening mail guardrails', async t => {
  const names = ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_FROM','SMTP_REPLY_TO','EMAIL_KILL_SWITCH',
    ...Object.keys(EMAIL_CATEGORIES).map(category => `EMAIL_KILL_SWITCH_${category.toUpperCase()}`)]
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]))
  const createTransport = nodemailer.createTransport
  const sent = []
  let suppressed = false
  let deliveryId = 0
  Object.assign(process.env, {
    SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', SMTP_USER: 'sender@example.test', SMTP_PASS: 'synthetic-password',
    SMTP_FROM: 'Vortex Athletics & Gymnastics <sender@example.test>', SMTP_REPLY_TO: 'frontdesk@example.test',
    EMAIL_KILL_SWITCH: 'false',
    ...Object.fromEntries(names.filter(name => name.startsWith('EMAIL_KILL_SWITCH_')).map(name => [name, 'false'])),
  })
  nodemailer.createTransport = () => ({ sendMail: async mail => {
    sent.push(mail)
    return { accepted: [mail.to], rejected: [], messageId: `signature-test-${sent.length}` }
  } })
  registerEmailPool({ query: async sql => ({ rows: sql.includes('FROM email_suppression') && suppressed
    ? [{ scope: 'global', reason: 'manual' }]
    : sql.includes('INSERT INTO email_delivery') ? [{ id: ++deliveryId }] : [] }) })
  try {
    const { sendEmail } = await import(`../sendEmail.js?signature-regression=${Date.now()}`)
    const base = { to: 'parent@example.test', subject: 'Class schedule update', category: 'schedule_change', skipPolicy: true }

    await t.test('every email category uses the approved header and footer at the SMTP boundary', async () => {
      for (const category of Object.keys(EMAIL_CATEGORIES)) {
        const before = sent.length
        const result = await sendEmail({
          ...base, category, subject: 'An update from Vortex',
          text: 'Your Vortex account update.', html: '<p>Your Vortex account update.</p>',
          ...(isMarketing(category) ? { listUnsubscribeUrl: 'https://vortexathletics.com/email/unsubscribe/synthetic-token' } : {}),
        })
        assert.equal(result.sent, true, `${category} reaches the shared sender`)
        assert.equal(sent.length, before + 1, `${category} produces one message`)
        const mail = sent.at(-1)
        assertFullSignature(mail)
        assert.ok(mail.html.includes(EMAIL_LAYOUT_MARKER), `${category} uses the standard document`)
        assert.ok(mail.html.includes(`data-vortex-email-layout-version="${EMAIL_LAYOUT_VERSION}"`), `${category} uses the approved version`)
        assert.ok(mail.html.includes(EMAIL_SIGNATURE_MARKER), `${category} uses the approved signature`)
        assert.ok(mail.html.includes(emailFooterHtml.html), `${category} retains the complete approved footer`)
        assert.ok(mail.html.indexOf(`cid:${EMAIL_LOGO_CID}`) < mail.html.indexOf('Your Vortex account update.'), `${category} displays its header before the message`)
      }
    })

    await t.test('HTML and plain-text bodies retain their spacing above the standardized signature', async () => {
      const text = 'Dear family,\n\nPrevious schedule:\nMonday at 4:00 PM\n\nUpdated schedule:\nTuesday at 5:00 PM\n\nWarmly,\nThe Vortex Athletics Team'
      await sendEmail({ ...base, text, html: `<div style="white-space:pre-wrap">${text}</div>` })
      const mail = sent.at(-1)
      assertFullSignature(mail)
      assert.ok(mail.text.includes('\n\nPrevious schedule:'))
      assert.ok(mail.text.includes('\n\nUpdated schedule:'))
      assert.ok(mail.text.includes('\n\nWarmly,'))
    })

    await t.test('text-only emails receive safe HTML as well as the signature', async () => {
      await sendEmail({ ...base, text: 'Hello <Family> & friends.\n\nYour class is Tuesday.' })
      const mail = sent.at(-1)
      assertFullSignature(mail)
      assert.ok(mail.text.startsWith('Hello <Family> & friends.'))
      assert.match(mail.html, /Hello &lt;Family&gt; &amp; friends\./)
      assert.doesNotMatch(mail.html, /<Family>/)
    })

    await t.test('HTML-only emails retain a useful plain-text body and complete signature', async () => {
      await sendEmail({ ...base, html: '<p>Your class is Wednesday.</p><p>Please reply with questions.</p>' })
      const mail = sent.at(-1)
      assertFullSignature(mail)
      assert.match(mail.text, /Your class is Wednesday\./)
      assert.match(mail.text, /Please reply with questions\./)
      assert.doesNotMatch(mail.text, /<p>/)
    })

    await t.test('templates that already append a signature do not receive a second one', async () => {
      await sendEmail({ ...base, text: `Your account is ready.\n\n${emailFooterHtml.text}`,
        html: composeEmailHtml('<p>Your account is ready.</p>') })
      assertFullSignature(sent.at(-1))
    })

    await t.test('saved emails with the previous logos upgrade both images and keep one signature', async () => {
      const oldContact = ['Vortex Gymnastics', EMAIL_SIGNATURE.address, EMAIL_SIGNATURE.website, EMAIL_SIGNATURE.phone].join('\n')
      await sendEmail({ ...base, text: `Saved update.\n\nWarmly,\nThe Vortex Athletics Team\n\n${oldContact}`,
        html: `<html data-vortex-email-layout="vortex" data-vortex-email-layout-version="v3-full-signature"><body>
          <img src="cid:vortex-athletics-logo@vortex" alt="Vortex Athletics" />
          <p>Saved update.</p>
          <!-- vortex-email-footer:start --><div data-vortex-email-signature="v1">
            <p>Warmly,<br />The Vortex Athletics Team</p>
            <img src="cid:vortex-gymnastics-logo@vortex" alt="Vortex Gymnastics" />
            <p>${EMAIL_SIGNATURE.address}<br />${EMAIL_SIGNATURE.website}<br />${EMAIL_SIGNATURE.phone}</p>
          </div><!-- vortex-email-footer:end -->
        </body></html>` })
      const mail = sent.at(-1)
      assertFullSignature(mail)
      assert.doesNotMatch(mail.html, /cid:vortex-(?:athletics|gymnastics)-logo@vortex/)
      assert.ok(mail.html.includes(`data-vortex-email-layout-version="${EMAIL_LAYOUT_VERSION}"`))
      assert.match(mail.html, /Saved update\./)
    })

    await t.test('previously composed branded HTML receives the current signature', async () => {
      const html = '<!DOCTYPE html><html data-vortex-email-layout="vortex"><body><table><tr><td><p>Saved class update.</p></td></tr><tr><td>Vortex Athletics · <a href="https://www.vortexathletics.com" style="color: #000000; text-decoration: none;">www.vortexathletics.com</a></td></tr></table></body></html>'
      await sendEmail({ ...base, text: 'Saved class update.\n\n— Vortex Athletics\nwww.vortexathletics.com', html })
      const mail = sent.at(-1)
      assertFullSignature(mail)
      assert.match(mail.html, /Saved class update\./)
      assert.equal(occurrences(readableHtml(mail.html), EMAIL_SIGNATURE.website), 1, 'old contact footer is upgraded rather than duplicated')
    })

    await t.test('older branded documents without a footer do not repeat an existing closing', async () => {
      await sendEmail({ ...base, text: 'Your class is Friday.\n\nWarmly,\nThe Vortex Athletics Team',
        html: '<html data-vortex-email-layout="vortex"><body><p>Your class is Friday.</p><p>Warmly,<br />The Vortex Athletics Team</p></body></html>' })
      assertFullSignature(sent.at(-1))
    })

    await t.test('legacy uncategorized administrative emails receive the same complete signature', async () => {
      await sendEmail({ ...base, category: undefined, text: 'An update from our front desk.', html: '<p>An update from our front desk.</p>' })
      assertFullSignature(sent.at(-1))
    })

    await t.test('security and marketing messages retain their distinct sending headers', async () => {
      await sendEmail({ ...base, category: 'signin_magic_link', subject: 'Your sign-in link', text: 'Use your sign-in link.', html: '<p>Use your sign-in link.</p>' })
      const security = sent.at(-1)
      assertFullSignature(security)
      assert.equal(security.headers['Auto-Submitted'], 'auto-generated')
      assert.equal(security.headers['List-Unsubscribe'], undefined)
      const unsubscribe = 'https://vortexathletics.com/email/unsubscribe/synthetic-token'
      await sendEmail({ ...base, category: 'newsletter', subject: 'Vortex news', text: 'News for our families.', html: '<p>News for our families.</p>', listUnsubscribeUrl: unsubscribe })
      const marketing = sent.at(-1)
      assertFullSignature(marketing)
      assert.equal(marketing.headers['List-Unsubscribe'], `<${unsubscribe}>`)
      assert.equal(marketing.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
      assert.equal(marketing.headers['Auto-Submitted'], undefined)
    })

    await t.test('classification and recipient suppression still prevent transport', async () => {
      const before = sent.length
      await assert.rejects(sendEmail({ ...base, text: 'Get 20% off this week.', html: '<p>Update</p>' }), /promotional content/)
      await assert.rejects(sendEmail({ ...base, category: 'newsletter', text: 'News.', html: '<p>News</p>' }), /requires a one-click unsubscribe/)
      suppressed = true
      const result = await sendEmail({ ...base, text: 'Your class is Thursday.', html: '<p>Your class is Thursday.</p>' })
      assert.equal(result.suppressed, true)
      assert.equal(sent.length, before)
    })
  } finally {
    nodemailer.createTransport = createTransport
    registerEmailPool(null)
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]
      else process.env[name] = previous[name]
    }
  }
})
