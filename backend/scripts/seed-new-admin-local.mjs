import pg from 'pg'
import bcrypt from 'bcryptjs'
import { localDevelopmentConfig } from '../newAdmin/localDevelopment.js'

const config = localDevelopmentConfig()
const db = new pg.Client({ connectionString: config.connectionString, ssl: false })
const FAMILY_COUNT = 120
const CLASS_COUNT = 24
const LEAD_COUNT = 180
const flag = 'new_admin_local_seed_v1'
const today = new Date()
const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0,10)
const previousMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth()-1, 1)).toISOString().slice(0,10)
const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth()+1, 1)).toISOString().slice(0,10)
const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth()+1, 0)).toISOString().slice(0,10)
const nextYear = new Date(Date.UTC(today.getUTCFullYear()+1, today.getUTCMonth(), 1)).toISOString().slice(0,10)
// A surname cycle coprime to the twelve-family class assignment cycle keeps
// each fictional roster varied rather than repeating the same full name.
const surnames = ['Rivera','Chen','Patel','Williams','Bennett','Santos','Walker','Murphy','Reed','Kim','Brooks','Morgan','Ellis']
const firstNames = ['Avery','Jordan','Riley','Casey','Alex','Taylor','Sam','Robin','Jamie','Quinn','Cameron','Drew']

async function insert(table, record) {
  const keys = Object.keys(record)
  const result = await db.query(`INSERT INTO "${table}" (${keys.map(key=>`"${key}"`).join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`, Object.values(record))
  return result.rows[0]
}

async function ensureMembershipPricing(facilityId) {
  await db.query(`INSERT INTO additional_fee(facility_id,name,description,amount_cents,apply_basis,trigger_type,scope_level,active)
    SELECT $1,'[SIMULATED] Annual membership','Fictional local registration prerequisite',8500,'per_year','once_per_year','global',TRUE
    WHERE NOT EXISTS(SELECT 1 FROM additional_fee WHERE facility_id=$1 AND name='[SIMULATED] Annual membership')`,[facilityId])
}

await db.connect()
try {
  await db.query('BEGIN')
  await db.query('SELECT pg_advisory_xact_lock(8410211)')
  await db.query('CREATE TABLE IF NOT EXISTS new_admin_local_seed (version TEXT PRIMARY KEY, summary JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())')
  const existing = await db.query('SELECT summary FROM new_admin_local_seed WHERE version=$1', [flag])
  if (existing.rowCount) {
    await ensureMembershipPricing(existing.rows[0].summary.facilityId)
    await db.query('UPDATE facility SET owner_user_id=$1 WHERE id=$2 AND owner_user_id IS NULL', [existing.rows[0].summary.adminUserId, existing.rows[0].summary.facilityId])
    await db.query('INSERT INTO new_admin_public_lead_facility(singleton,facility_id) VALUES(TRUE,$1) ON CONFLICT(singleton) DO NOTHING', [existing.rows[0].summary.facilityId])
    console.log(JSON.stringify({ unchanged: true, ...existing.rows[0].summary }))
    await db.query('COMMIT')
  } else {
    const facility = (await db.query('SELECT id FROM facility ORDER BY id LIMIT 1')).rows[0]
    if (!facility) throw new Error('Run the local schema setup first.')
    const facilityId = Number(facility.id)
    await ensureMembershipPricing(facilityId)
    const collision = await db.query("SELECT 1 FROM app_user WHERE lower(username)='admin2'")
    if (collision.rowCount) throw new Error('admin2 already exists outside this seed; use the dedicated database reset.')
    const passwordHash = await bcrypt.hash('adminadmin', 12)
    const admin = await insert('app_user', { facility_id: facilityId, role: 'ADMIN', full_name: 'Local Development Administrator', username: 'admin2', email: 'admin2@new-admin.example.test', password_hash: passwordHash, is_active: true, staff_access_active: true })
    await insert('app_user_role', { user_id: admin.id, role: 'ADMIN' })
    await insert('admin_profile', { user_id: admin.id, is_master_admin: false })
    await db.query('UPDATE facility SET owner_user_id=$1 WHERE id=$2 AND owner_user_id IS NULL', [admin.id, facilityId])
    await db.query('INSERT INTO new_admin_public_lead_facility(singleton,facility_id) VALUES(TRUE,$1) ON CONFLICT(singleton) DO NOTHING', [facilityId])

    const programs = []
    for (const [index,name] of ['Gymnastics','Ninja','Athletic Development','Adult Fitness'].entries()) {
      programs.push(await insert('programs', { facility_id: facilityId, name: `DEV_NEW_ADMIN_${index}`, display_name: `[DEV] ${name}`, is_active:true, scheduling_active:true, pricing_slot_cost_monthly_cents: 10000, pricing_cost_amount_cents:10000, pricing_cost_unit:'month', scheduling_enroll_sites:['hub'], pricing_cost_options:JSON.stringify([{key:'monthly',label:'Monthly',amountCents:10000,unit:'month'}]) }))
    }
    const classes=[]
    for (let index=0;index<CLASS_COUNT;index++) {
      const program=programs[index%programs.length]
      const cls=await insert('program',{facility_id:facilityId,programs_id:program.id,category:'GYMNASTICS',name:`[DEV] ${['Foundations','Tumbling','Strength','Movement'][index%4]} ${String(index+1).padStart(2,'0')}`,display_name:`[DEV] Class ${index+1}`,age_min:5,age_max:18,is_active:true,archived:false})
      const form=await insert('scheduling_form',{program_id:cls.id,programs_id:program.id,title:cls.name,is_active:true,start_date:previousMonth,end_date:nextYear,signup_fields:JSON.stringify(['first_name','last_name','email']),slot_cost_monthly_cents:10000,cost_amount_cents:10000,cost_unit:'month'})
      const offering=await insert('scheduling_offering',{form_id:form.id,label:'[DEV] Year-round offering',start_date:previousMonth,end_date:nextYear,is_selected:true})
      const group=await insert('scheduling_slot_group',{form_id:form.id,offering_id:offering.id,schedule_mode:'day',max_participants:index%5===0?10:18,active_start:previousMonth,active_end:nextYear,is_active:true})
      const slot=await insert('scheduling_time_slot',{form_id:form.id,slot_group_id:group.id,day_of_week:index%6+1,start_time:`${15+index%5}:00`,end_time:`${16+index%5}:00`,max_participants:group.max_participants,active_start:previousMonth,active_end:nextYear,is_active:true,schedule_mode:'day'})
      classes.push({cls,form,group,slot})
    }
    let memberCount=0,enrollmentCount=0,chargeCents=0,paymentCents=0,refundCents=0
    for (let index=0;index<FAMILY_COUNT;index++) {
      const suffix=String(index+1).padStart(3,'0'),last=surnames[index%surnames.length]
      const family=await insert('family',{facility_id:facilityId,family_name:`[DEV] ${last} Family ${suffix}`,family_username:`newadmin_family_${suffix}`})
      const accountLogin=await insert('app_user',{facility_id:facilityId,role:'MEMBER_ATHLETE',full_name:`${firstNames[index%12]} ${last}`,username:`newadmin_parent_${suffix}`,email:`parent.${suffix}@new-admin.example.test`,password_hash:passwordHash,is_active:true})
      await insert('app_user_role',{user_id:accountLogin.id,role:'MEMBER_ATHLETE'})
      const parent=await insert('member',{facility_id:facilityId,first_name:firstNames[index%12],last_name:last,date_of_birth:`198${index%10}-06-15`,email:accountLogin.email,app_user_id:accountLogin.id,is_active:true,profile_complete:true,internal_flags:flag,signup_source:'dev_seed'})
      await insert('family_member',{family_id:family.id,member_id:parent.id})
      const account=await insert('family_billing_account',{family_id:family.id,payer_member_id:parent.id,billing_email:parent.email,is_active:true,household_monthly_billing_enabled:true})
      memberCount++
      const charges=[]
      for (let childIndex=0;childIndex<2;childIndex++) {
        const child=await insert('member',{facility_id:facilityId,first_name:firstNames[(index+childIndex+3)%12],last_name:last,date_of_birth:`201${2+(index+childIndex)%7}-03-12`,is_active:true,profile_complete:true,internal_flags:flag,signup_source:'dev_seed'})
        await insert('family_member',{family_id:family.id,member_id:child.id})
        await insert('parent_guardian_authority',{parent_member_id:parent.id,child_member_id:child.id,has_legal_authority:true,relationship:'parent'})
        memberCount++
        const schedule=classes[(index*2+childIndex)%CLASS_COUNT]
        const status=['confirmed','confirmed','confirmed','paused','waitlisted','cancelled'][(index+childIndex)%6]
        const enrollment=await insert('scheduling_signup',{form_id:schedule.form.id,time_slot_id:schedule.slot.id,slot_group_id:schedule.group.id,member_id:child.id,first_name:child.first_name,last_name:last,email:parent.email,status,enrollment_start_date:previousMonth,admin_stub:true,field_responses:JSON.stringify({source:'local_simulation'}),responses:JSON.stringify({source:'local_simulation'})})
        enrollmentCount++
        if (status==='waitlisted' || status==='cancelled') continue
        const subscription=await insert('billing_subscription',{family_billing_account_id:account.id,member_id:child.id,source_type:'scheduling_signup',source_id:String(enrollment.id),description:`[SIMULATED] ${schedule.cls.name}`,monthly_amount_cents:10000,net_monthly_cents:10000,status:status==='paused'?'paused':'active',start_date:previousMonth,next_bill_date:nextMonth,auto_renewal:false})
        const charge=await insert('billing_charge',{family_billing_account_id:account.id,member_id:child.id,source_type:'scheduling_signup',source_id:`${enrollment.id}:${month}`,subscription_id:subscription.id,description:`[SIMULATED] ${schedule.cls.name}`,charge_type:'recurring',billing_interval:'month',amount_cents:10000,gross_amount_cents:10000,service_period_start:month,service_period_end:monthEnd,metadata:JSON.stringify({simulated:true,seed:flag})})
        charges.push(charge)
        chargeCents+=10000
      }
      // Six ledger scenarios: paid, unpaid, partial, failed, credit, refunded.
      const total=charges.reduce((sum,row)=>sum+row.amount_cents,0),state=index%6
      const amount=state===1||state===3?0:state===2?Math.floor(total/2):total+(state>=4?2500:0)
      let payment=null
      if(amount) {
        payment=await insert('billing_payment',{family_billing_account_id:account.id,amount_cents:amount,method:'cash',note:'[SIMULATED] Local development payment; no processor call',external_processor:'local_simulation',external_reference:`local-payment-${suffix}`,external_status:'settled',request_key:`${flag}:payment:${suffix}`,recorded_by_user_id:admin.id})
        paymentCents+=amount
        let remaining=Math.min(total,amount)
        for(const charge of charges) {
          const applied=Math.min(remaining,charge.amount_cents)
          if(applied>0) await insert('billing_payment_application',{billing_payment_id:payment.id,billing_charge_id:charge.id,amount_cents:applied,application_kind:'application'})
          remaining-=applied
        }
      }
      if(state===5 && payment) {
        await insert('billing_refund',{family_billing_account_id:account.id,payment_id:payment.id,amount_cents:2500,reason:'[SIMULATED] Return overpayment',external_reference:`local-refund-${suffix}`,external_status:'succeeded',request_key:`${flag}:refund:${suffix}`,ledger_treatment:'return_overpayment',created_by_user_id:admin.id})
        refundCents+=2500
      }
      if(total>0) {
        const invoice=await insert('billing_monthly_invoice',{family_billing_account_id:account.id,billing_month:month,status:state===3?'failed':amount>=total?'paid':'open',subtotal_cents:total,total_cents:total,paid_at:amount>=total?new Date():null,failure_message:state===3?'[SIMULATED] Payment requires attention':null})
        for(const charge of charges) await insert('billing_monthly_invoice_line',{billing_monthly_invoice_id:invoice.id,billing_charge_id:charge.id,member_id:charge.member_id,line_type:'charge',description:charge.description,amount_cents:charge.amount_cents})
      }
      await insert('billing_account_activity',{family_billing_account_id:account.id,event_type:'local_simulation_seed',summary:'[SIMULATED] Fictional account prepared for local testing',actor_type:'system',details:JSON.stringify({simulated:true,scenario:['paid','unpaid','partial','failed','credit','refunded'][state]})})
    }
    for(let index=0;index<LEAD_COUNT;index++) {
      await insert('registrations',{facility_id:facilityId,first_name:firstNames[index%12],last_name:surnames[(index+5)%12],email:`lead.${String(index+1).padStart(3,'0')}@new-admin.example.test`,phone:'202-555-0100',interest:['Gymnastics','Ninja','Athletic Development'][index%3],message:'[SIMULATED] Interested in an introductory class.',contacted:index%3===0,follow_up:index%5===0,admin_notes:'Fictional local development inquiry',inquiry_source:'new_admin_local',created_at:new Date(Date.now()-index*3600000)})
    }
    const summary={facilityId,adminUserId:Number(admin.id),families:FAMILY_COUNT,members:memberCount,classes:CLASS_COUNT,enrollments:enrollmentCount,leads:LEAD_COUNT,chargeCents,paymentCents,refundCents,simulated:true}
    await insert('new_admin_local_seed',{version:flag,summary:JSON.stringify(summary)})
    await db.query('COMMIT')
    console.log(JSON.stringify(summary))
    console.log('Local administrator: admin2 / adminadmin. All billing is simulated; no Stripe objects were created.')
  }
} catch(error) { await db.query('ROLLBACK'); throw error }
finally { await db.end() }
