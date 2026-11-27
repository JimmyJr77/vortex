import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import { createSchedulingHandlers } from '../handlers.js'
import { calendarCancellationSummary, dispatchCalendarCancellationNotifications, previewCalendarCancellation,
  retireCalendarCancellation } from '../calendarCancellationNotifications.js'
import { recordDelivery, registerEmailPool } from '../../email/emailDeliveryStore.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) {
  const url = new URL(connectionString)
  if (process.env.NODE_ENV === 'production' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname)
    || url.search || url.hash || !/^vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(url.pathname.slice(1))) {
    throw new Error('Cancellation email tests require an isolated local vortex_new_admin_dev database.')
  }
}

test('calendar cancellation snapshots parent email jobs atomically and recovers deliveries without changing closures', { skip: !connectionString }, async t => {
  const db = new pg.Client({ connectionString, ssl: false })
  await db.connect()
  try {
    await db.query('BEGIN')
    await db.query(await readFile(new URL('../../migrations/880_calendar_cancellation_notifications.sql', import.meta.url),'utf8'))
    const one = async (sql, args = []) => (await db.query(sql,args)).rows[0]
    const suffix = randomUUID()
    const date = '2030-01-07'
    const facilityId = Number((await one("INSERT INTO facility(name,timezone) VALUES($1,'America/New_York') RETURNING id", [`Email closure ${suffix}`])).id)
    const otherFacilityId = Number((await one("INSERT INTO facility(name,timezone) VALUES($1,'America/New_York') RETURNING id", [`Foreign closure ${suffix}`])).id)
    const programId = Number((await one('INSERT INTO programs(facility_id,name,display_name) VALUES($1,$2,$2) RETURNING id', [facilityId,`Email closure ${suffix}`])).id)
    const addClass = async (label, hour, { hidden = false, inactive = false, trial = false } = {}) => {
      const classId = Number((await one(`INSERT INTO program(facility_id,category,programs_id,name,display_name,is_active,archived,is_trial_assessment)
        VALUES($1,(enum_range(NULL::program_category))[1],$2,$3,$3,$4,FALSE,$5) RETURNING id`, [facilityId,programId,label,!inactive,trial])).id)
      const formId = Number((await one(`INSERT INTO scheduling_form(program_id,programs_id,title,is_active,start_date)
        VALUES($1,$2,$3,$4,'2029-12-01') RETURNING id`, [classId,programId,label,!hidden])).id)
      const groupId = Number((await one(`INSERT INTO scheduling_slot_group(form_id,schedule_mode,active_start,max_participants)
        VALUES($1,'date','2029-12-01',100) RETURNING id`, [formId])).id)
      const slotId = Number((await one(`INSERT INTO scheduling_time_slot(form_id,slot_group_id,schedule_mode,specific_date,start_time,end_time,active_start)
        VALUES($1,$2,'date',$3,$4,$5,'2029-12-01') RETURNING id`, [formId,groupId,date,`${hour}:00`,`${hour+1}:00`])).id)
      return { classId, formId, groupId, slotId }
    }
    const main = await addClass('Gymnastics class',16)
    const hidden = await addClass('Private evaluation',18,{ hidden:true,trial:true })
    const inactive = await addClass('Hidden booked class',19,{ hidden:true,inactive:true })
    const member = async (name,email,{ adult = false, owner = facilityId } = {}) => Number((await one(`INSERT INTO member
      (facility_id,first_name,last_name,email,date_of_birth,is_active) VALUES($1,$2,'Closure',$3,$4,TRUE) RETURNING id`,
    [owner,name,email,adult ? '1980-01-01' : '2020-01-01'])).id)
    const child = await member('Child','athlete-private@example.test')
    const sibling = await member('Sibling','sibling-private@example.test')
    const guardian = await member('Parent','PARENT@example.test',{ adult:true })
    const guardian2 = await member('Second parent','second-parent@example.test',{ adult:true })
    const unauthorized = await member('No authority','no-authority@example.test',{ adult:true })
    const foreign = await member('Foreign','foreign-private@example.test',{ owner:otherFacilityId })
    const familyId = Number((await one('INSERT INTO family(facility_id,family_name) VALUES($1,$2) RETURNING id', [facilityId,`Closure household ${suffix}`])).id)
    await db.query('INSERT INTO family_member(family_id,member_id) SELECT $1,unnest($2::bigint[])', [familyId,[child,sibling,guardian,guardian2,unauthorized]])
    await db.query(`INSERT INTO parent_guardian_authority(parent_member_id,child_member_id,has_legal_authority)
      VALUES($1,$3,TRUE),($2,$3,TRUE),($1,$4,TRUE),($2,$4,TRUE),($5,$3,FALSE)`, [guardian,guardian2,child,sibling,unauthorized])
    const payerChild = await member('Payer child','payer-athlete-private@example.test')
    const payer = await member('Payer','payer@example.test',{ adult:true })
    const payerFamilyId = Number((await one('INSERT INTO family(facility_id,family_name) VALUES($1,$2) RETURNING id', [facilityId,`Payer household ${suffix}`])).id)
    await db.query('INSERT INTO family_member(family_id,member_id) SELECT $1,unnest($2::bigint[])', [payerFamilyId,[payerChild,payer]])
    await db.query(`INSERT INTO family_billing_account(family_id,payer_member_id,billing_email) VALUES($1,$2,'payer@example.test')
      ON CONFLICT(family_id) DO UPDATE SET payer_member_id=EXCLUDED.payer_member_id,billing_email=EXCLUDED.billing_email`, [payerFamilyId,payer])
    const enroll = async (athlete,email,start = '2029-12-01') => one(`INSERT INTO scheduling_signup
      (form_id,slot_group_id,time_slot_id,member_id,first_name,last_name,email,status,enrollment_start_date)
      VALUES($1,$2,$3,$4,'Submitted','Parent',$5,'confirmed',$6) RETURNING id`, [main.formId,main.groupId,main.slotId,athlete,email,start])
    await enroll(child,'submitted-child@example.test')
    await enroll(sibling,'submitted-sibling@example.test')
    await enroll(payerChild,'submitted-payerchild@example.test')
    await enroll(null,'legacy-parent@example.test')
    await enroll(null,'')
    await enroll(null,'future-parent@example.test','2030-01-08')
    const booking = async (klass,athlete,email,status = 'confirmed',expired = false) => one(`INSERT INTO drop_in_registration
      (form_id,slot_group_id,member_id,class_date,first_name,last_name,email,status,benefit_type,expires_at)
      VALUES($1,$2,$3,$4,'Booked','Parent',$5,$6,'free_trial',CASE WHEN $7::boolean THEN now()-interval '1 hour' ELSE now()+interval '1 hour' END)
      RETURNING id`, [klass.formId,klass.groupId,athlete,date,email,status,expired])
    await booking(hidden,sibling,'submitted-trialchild@example.test')
    await booking(hidden,null,'pending-parent@example.test','account_required')
    await booking(hidden,null,'expired-parent@example.test','account_required',true)
    await booking(main,null,'checkout-parent@example.test','payment_pending')
    await booking(main,foreign,'foreign-booking-private@example.test')
    await booking(inactive,null,'inactive-parent@example.test')
    const commands = { BEGIN:'SAVEPOINT calendar_mail_update', COMMIT:'RELEASE SAVEPOINT calendar_mail_update', ROLLBACK:'ROLLBACK TO SAVEPOINT calendar_mail_update' }
    let failQueue = false, failSummary = false
    const pool = { query:(sql,args) => {
      if (failSummary && sql.includes('COUNT(delivery.id)::int AS recipient_count')) throw new Error('simulated summary read failure')
      return db.query(sql,args)
    }, connect:async () => ({
      query:(sql,args) => {
        if (failQueue && sql.includes('INSERT INTO scheduling_cancellation_delivery')) throw new Error('simulated queue write failure')
        return db.query(commands[sql] || sql,args)
      }, release() {},
    }) }
    const handlers = createSchedulingHandlers(pool)
    const request = async (method,body,scope = facilityId) => {
      const res = { code:200,status(code) { this.code=code;return this },json(result) { this.result=result } }
      await handlers[method]({ canonicalAccess:{ facilityId:scope },body },res)
      return res
    }
    const scope = { facilityId,date,slotId:main.slotId }
    const update = (cancelled,emailBody) => request('updateCalendarOccurrence',{ date,slotId:main.slotId,cancelled,...(emailBody===undefined ? {} : { emailBody }) })
    const notices = async () => Number((await one('SELECT COUNT(*)::int AS count FROM scheduling_cancellation_notice WHERE facility_id=$1',[facilityId])).count)

    await t.test('preview includes exact dated sessions and only their actual parent contacts', async () => {
      const preview = await previewCalendarCancellation(db,{ facilityId,date })
      assert.equal(preview.recipientCount,7)
      assert.equal(preview.missingContactCount,2)
      assert.equal(preview.affectedSessions.length,3,'hidden and inactive calendar sessions with bookings remain affected')
      assert.match(preview.body,/Monday, January 7, 2030/)
      assert.match(preview.body,/Gymnastics class.*4:00 PM–5:00 PM/)
      assert.match(preview.body,/work with you to facilitate a make-up date/)
      assert.deepEqual(preview.recipients.map(row=>row.email).sort(),['checkout-parent@example.test','inactive-parent@example.test','legacy-parent@example.test','parent@example.test','payer@example.test','pending-parent@example.test','second-parent@example.test'])
      const response = await request('previewCalendarCancellation',{ date,slotId:main.slotId })
      assert.equal(response.code,200)
      assert.equal(response.result.data.recipientCount,5)
      assert.equal(response.result.data.recipients,undefined,'the preview does not expose a parent address list')
      assert.equal((await request('previewCalendarCancellation',{ date,slotId:main.slotId },otherFacilityId)).code,404)
      for (const invalid of [null,['2030-01-07'],' 2030-01-07','2030-02-31']) {
        assert.equal((await request('previewCalendarCancellation',{ date:invalid,slotId:main.slotId })).code,400)
      }
      assert.equal((await request('previewCalendarCancellation',{ date },null)).code,403)
    })
    const edited = 'Dear families,\n\nGymnastics class on Monday, January 7, 2030, 4:00 PM–5:00 PM has been canceled.\nWe will work with you on a make-up date. <Please reply>\n\nThank you!'
    await t.test('blank or prohibited message errors occur before cancellation; edited text is retained exactly', async () => {
      assert.equal((await update(true,'  ')).code,400)
      assert.equal((await update(true,'Get 20% off a special offer')).code,400)
      assert.equal(await notices(),0)
      assert.equal((await update(true,edited)).code,200)
      const notice = await one('SELECT body FROM scheduling_cancellation_notice WHERE facility_id=$1 AND scope_key=$2',[facilityId,`slot:${main.slotId}`])
      assert.equal(notice.body,edited)
      assert.equal(await notices(),1)
      const summary = await calendarCancellationSummary(db,scope)
      assert.deepEqual(summary,{ sent:0,pending:5,failed:0,recipientCount:5,missingContactCount:2 })
      await update(true,'Repeated request should not send again')
      assert.equal(await notices(),1)
    })
    const sent = []
    const send = async mail => { sent.push(mail);return { sent:true } }
    await t.test('delivery failure keeps cancellation in place and pending jobs retry automatically', async () => {
      await dispatchCalendarCancellationNotifications(pool,{ limit:1,send:async () => { throw new Error('simulated SMTP failure') } })
      const delivery = await one(`SELECT * FROM scheduling_cancellation_delivery WHERE notice_id IN
        (SELECT id FROM scheduling_cancellation_notice WHERE facility_id=$1) AND attempt_count=1`,[facilityId])
      assert.equal(delivery.status,'pending')
      assert.equal(delivery.last_error,'Email could not be delivered; an automatic retry is scheduled.')
      assert.ok((await one('SELECT 1 FROM scheduling_occurrence_cancellation WHERE time_slot_id=$1 AND occurrence_date=$2',[main.slotId,date])))
      await db.query('UPDATE scheduling_cancellation_delivery SET next_attempt_at=now()-interval \'1 second\' WHERE id=$1',[delivery.id])
      await dispatchCalendarCancellationNotifications(pool,{ limit:20,send })
      assert.equal(sent.length,5)
      assert.ok(sent.every(mail=>mail.text===edited && mail.category==='schedule_change' && mail.skipPolicy===true))
      assert.ok(sent.every(mail=>mail.html.includes('&lt;Please reply&gt;') && !mail.html.includes('<Please reply>')))
      assert.equal(new Set(sent.map(mail=>mail.to)).size,5)
      await dispatchCalendarCancellationNotifications(pool,{ limit:20,send })
      assert.equal(sent.length,5,'already sent recipient jobs are not resent')
      assert.equal((await update(true,edited)).result.data.notifications.sent,5)
    })
    await t.test('full-day mail excludes separately cancelled sessions and restore retires unsent jobs', async () => {
      const full = await request('updateCalendarDay',{ date,cancelled:true })
      assert.equal(full.code,200)
      assert.equal(full.result.data.notifications.recipientCount,4)
      const dayNotice = await one("SELECT * FROM scheduling_cancellation_notice WHERE facility_id=$1 AND scope_key='day' AND restored_at IS NULL",[facilityId])
      assert.equal(dayNotice.body.includes('Gymnastics class'),false)
      assert.match(dayNotice.body,/Private evaluation/)
      assert.equal((await request('updateCalendarDay',{ date,cancelled:false })).code,200)
      assert.deepEqual((await db.query('SELECT DISTINCT status FROM scheduling_cancellation_delivery WHERE notice_id=$1',[dayNotice.id])).rows,[{ status:'cancelled' }])
      await dispatchCalendarCancellationNotifications(pool,{ limit:20,send })
      assert.equal(sent.length,5)
      assert.equal((await request('updateCalendarDay',{ date,cancelled:true })).code,200)
      assert.equal(await notices(),3,'restoring then cancelling creates a new notification episode')
      await request('updateCalendarDay',{ date,cancelled:false })
    })
    await t.test('a queue write failure rolls back the cancellation and the new notice together', async () => {
      await update(false)
      const count = await notices()
      failQueue = true
      assert.equal((await update(true,edited)).code,500)
      failQueue = false
      assert.equal(await notices(),count)
      assert.equal((await db.query('SELECT 1 FROM scheduling_occurrence_cancellation WHERE time_slot_id=$1 AND occurrence_date=$2',[main.slotId,date])).rows.length,0)
      await update(true,edited)
    })
    await t.test('an accepted delivery is reconciled after process loss and never resubmitted', async () => {
      const row = await one(`SELECT delivery.id FROM scheduling_cancellation_delivery delivery JOIN scheduling_cancellation_notice notice ON notice.id=delivery.notice_id
        WHERE notice.facility_id=$1 AND notice.restored_at IS NULL AND delivery.status='pending' ORDER BY delivery.id LIMIT 1`,[facilityId])
      await db.query(`INSERT INTO email_delivery(category,stream,status,idempotency_key,accepted_at)
        VALUES('schedule_change','transactional','accepted',$1,now())`,[`calendar-cancellation:${row.id}`])
      let sends = 0
      await dispatchCalendarCancellationNotifications(pool,{ limit:1,send:async () => { sends+=1;return { sent:true } } })
      assert.equal(sends,0)
      assert.equal((await one('SELECT status FROM scheduling_cancellation_delivery WHERE id=$1',[row.id])).status,'sent')
    })
    await t.test('restoring a claimed closure before SMTP prevents a stale cancellation message', async () => {
      let sends = 0, restored = false
      const restoringPool = { query:async (sql,args) => {
        if (!restored && sql.startsWith('SELECT accepted_at FROM email_delivery')) {
          restored=true
          await retireCalendarCancellation(db,scope)
        }
        return db.query(sql,args)
      } }
      await dispatchCalendarCancellationNotifications(restoringPool,{ limit:1,send:async () => { sends+=1;return { sent:true } } })
      assert.equal(restored,true)
      assert.equal(sends,0)
    })
    await t.test('concurrent dispatchers send distinct recipients and suppressed addresses are reported as failed', async () => {
      await update(false)
      await update(true,edited)
      let release, started
      const gate = new Promise(resolve=>{ release=resolve })
      const sending = new Promise(resolve=>{ started=resolve })
      const addresses = []
      const first = dispatchCalendarCancellationNotifications(pool,{ limit:1,send:async mail=>{
        addresses.push(mail.to);started();await gate;return { sent:true }
      } })
      await sending
      await dispatchCalendarCancellationNotifications(pool,{ limit:1,send:async mail=>{
        addresses.push(mail.to);return { sent:true }
      } })
      release()
      await first
      assert.equal(new Set(addresses).size,2)
      await dispatchCalendarCancellationNotifications(pool,{ limit:1,send:async()=>({ sent:false,suppressed:true,reason:'hard_bounce' }) })
      const summary = await calendarCancellationSummary(db,scope)
      assert.equal(summary.sent,2)
      assert.equal(summary.failed,1)
      assert.equal(summary.pending,2)
    })
    await t.test('only failed calendar-template delivery logs can be requeued; accepted mail stays idempotent', async () => {
      registerEmailPool(pool)
      try {
        const input = { category:'schedule_change',stream:'transactional',templateVersion:'calendar-cancellation-v1',email:'parent@example.test',idempotencyKey:`calendar-test:${suffix}` }
        const failed = await recordDelivery({ ...input,status:'failed' })
        const retried = await recordDelivery({ ...input,status:'queued' })
        assert.equal(retried.id,failed.id)
        assert.equal(retried.duplicate,undefined)
        await db.query("UPDATE email_delivery SET status='accepted',accepted_at=now() WHERE id=$1",[retried.id])
        assert.equal((await recordDelivery({ ...input,status:'queued' })).duplicate,true)
        const other = { ...input,templateVersion:'another-schedule-email',idempotencyKey:`other-calendar-test:${suffix}` }
        await recordDelivery({ ...other,status:'failed' })
        assert.equal((await recordDelivery({ ...other,status:'queued' })).duplicate,true)
      } finally { registerEmailPool(null) }
    })
    await t.test('a failed delivery-summary read does not report an already committed closure as failed', async () => {
      failSummary = true
      const result = await update(true,edited)
      failSummary = false
      assert.equal(result.code,200)
      assert.equal(result.result.data.cancelled,true)
      assert.equal(result.result.data.notificationSummaryUnavailable,true)
      assert.equal(result.result.data.notifications,undefined)
    })
  } finally {
    registerEmailPool(null)
    await db.query('ROLLBACK')
    await db.end()
  }
})
