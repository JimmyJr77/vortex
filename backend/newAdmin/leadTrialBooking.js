import { id, inputError } from './common.js'
import { leadDirectoryCtes, loadCanonicalLeadGroup } from './leadDeduplication.js'
import { relatedAthletes } from './leadParticipation.js'
import { currentHouseholdLinkSql } from './householdStatus.js'
import { assertCurrentTrialWaivers, bookMemberFreeTrial } from '../scheduling/freeTrials.js'
import { recordFreeTrialLead } from './trialLeads.js'
import { normalizeSignupEmail } from '../auth/memberLoginIdentifiers.js'
import { inquiryMemberMatchJoin } from './inquiryMemberMatch.js'

async function matchingContact(db,facilityId,leadId){
  const row=(await db.query(`SELECT contact.id,concat_ws(' ',contact.first_name,contact.last_name) AS name,contact.email
    FROM registrations r ${inquiryMemberMatchJoin('r.facility_id','r.email')}
    JOIN member contact ON contact.id=inquiry_contact.member_id AND contact.facility_id=r.facility_id AND contact.is_active IS TRUE
    WHERE r.id=$1 AND r.facility_id=$2`,[leadId,facilityId])).rows[0]
  return row?{memberId:Number(row.id),name:row.name,email:row.email}:null
}

async function trialContext(db, facilityId, leadId, {lock=false,allowMatch=false}={}) {
  facilityId=id(facilityId,'facility')
  const group=await loadCanonicalLeadGroup(db,facilityId,leadId)
  if(lock)await db.query('SELECT id FROM registrations WHERE id=$1 AND facility_id=$2 FOR UPDATE',[group.canonicalId,facilityId])
  const lead=(await db.query(`WITH ${leadDirectoryCtes('$1')}
    SELECT id,archived,is_converted FROM effective_leads WHERE id=$2`,[facilityId,group.canonicalId])).rows[0]
  if(!lead||lead.archived===true)throw inputError('This lead is no longer open for a free trial.',409)
  if(lead.is_converted===true)throw inputError('Open this member account to manage its registrations.',409)
  if(group.memberId==null){
    const matchedContact=allowMatch?await matchingContact(db,facilityId,group.canonicalId):null
    if(!matchedContact)throw inputError('A verified parent or guardian account is required before booking a trial.',409)
    return {facilityId,canonicalId:group.canonicalId,contactMemberId:null,children:[],matchedContact}
  }
  const today="(CURRENT_TIMESTAMP AT TIME ZONE COALESCE((SELECT NULLIF(timezone,'') FROM facility WHERE id=$1),'America/New_York'))::date"
  const children=(await db.query(`WITH ${leadDirectoryCtes('$1')}
    SELECT DISTINCT child.id,child.first_name,child.last_name,child.date_of_birth::text
    FROM effective_leads r
    JOIN member guardian ON guardian.id=$3 AND guardian.facility_id=$1 AND guardian.is_active IS TRUE
    JOIN parent_guardian_authority authority ON authority.parent_member_id=guardian.id AND authority.has_legal_authority IS TRUE
    JOIN member child ON child.id=authority.child_member_id AND child.facility_id=$1 AND child.is_active IS TRUE
    LEFT JOIN LATERAL (SELECT NULL::bigint AS member_id) inquiry_contact ON TRUE
    WHERE r.id=$2 AND guardian.date_of_birth<=(${today}-INTERVAL '18 years')::date
      AND child.date_of_birth>(${today}-INTERVAL '18 years')::date AND child.date_of_birth<=${today}
      AND EXISTS(SELECT 1 FROM family household WHERE household.facility_id=$1 AND household.archived IS NOT TRUE
        AND ${currentHouseholdLinkSql('guardian','household.id')} AND ${currentHouseholdLinkSql('child','household.id')})
      AND EXISTS(${relatedAthletes} SELECT 1 FROM athletes athlete WHERE athlete.id=child.id)
    ORDER BY child.id`,[facilityId,group.canonicalId,group.memberId])).rows
  return {facilityId,canonicalId:group.canonicalId,contactMemberId:group.memberId,
    children:children.map((child,index)=>({memberId:Number(child.id),memberIndex:index+1,
      firstName:child.first_name,lastName:child.last_name,dateOfBirth:child.date_of_birth}))}
}

export async function loadLeadTrialBooking(db, facilityId, leadId) {
  const context=await trialContext(db,facilityId,leadId,{allowMatch:true})
  const bookings=context.children.length?(await db.query(`SELECT booking.id,booking.member_id AS "memberId",booking.status,
    booking.benefit_type AS "benefitType",booking.amount_cents AS "totalCents",booking.class_date::text AS "classDate",
    COALESCE(NULLIF(class.display_name,''),class.name,form.title) AS "className"
    FROM drop_in_registration booking JOIN scheduling_form form ON form.id=booking.form_id
    JOIN program class ON class.id=form.program_id AND class.facility_id=$1
    WHERE booking.member_id=ANY($2::bigint[]) AND booking.benefit_type='free_trial' AND booking.status IN ('confirmed','attended')
    ORDER BY booking.class_date DESC,booking.id DESC`,[context.facilityId,context.children.map(child=>child.memberId)])).rows:[]
  return {facilityId:context.facilityId,children:context.children,bookings:bookings.map(booking=>({...booking,id:Number(booking.id),memberId:Number(booking.memberId),totalCents:Number(booking.totalCents)})),
    ...(context.matchedContact?{matchedContact:context.matchedContact}:{})}
}

export async function bookLeadTrialForStaff(pool,{facilityId,leadId,body={}}) {
  const db=await pool.connect()
  try{
    await db.query('BEGIN')
    if(Object.hasOwn(body,'linkMemberId')){
      if(body.confirmContact!==true)throw inputError('Confirm that this member is the lead’s parent or guardian before linking.',400)
      const memberId=id(body.linkMemberId,'member')
      const candidateContext=await trialContext(db,facilityId,leadId,{allowMatch:true})
      const candidate=await matchingContact(db,candidateContext.facilityId,candidateContext.canonicalId)
      if(!candidate||candidate.memberId!==memberId
        ||(candidateContext.contactMemberId!=null&&candidateContext.contactMemberId!==memberId)){
        throw inputError('The matching member changed. Close and reopen the trial booking before confirming.',409)
      }
      const guardian=await db.query('SELECT id FROM member WHERE id=$1 AND facility_id=$2 AND is_active IS TRUE FOR UPDATE',
        [memberId,candidateContext.facilityId])
      if(!guardian.rows.length)throw inputError('The matching member is no longer available.',409)
      const context=await trialContext(db,facilityId,leadId,{lock:true,allowMatch:true})
      const matched=await matchingContact(db,context.facilityId,context.canonicalId)
      if(!matched||matched.memberId!==memberId||(context.contactMemberId!=null&&context.contactMemberId!==memberId)){
        throw inputError('The matching member changed. Close and reopen the trial booking before confirming.',409)
      }
      await db.query('UPDATE registrations SET trial_contact_member_id=$3,updated_at=now() WHERE id=$1 AND facility_id=$2',
        [context.canonicalId,context.facilityId,memberId])
      const result=await loadLeadTrialBooking(db,context.facilityId,context.canonicalId)
      await db.query('COMMIT')
      return result
    }
    const memberId=id(body.memberId,'athlete')
    const context=await trialContext(db,facilityId,leadId)
    if(!context.children.some(child=>child.memberId===memberId))throw inputError('Choose a child authorized for this lead’s guardian.',403)
    await assertCurrentTrialWaivers(db,memberId,context.facilityId)
    const contact=(await db.query(`SELECT COALESCE(NULLIF(btrim(guardian.email),''),NULLIF(btrim(login.email),'')) AS email,guardian.phone
      FROM member guardian LEFT JOIN app_user login ON login.id=guardian.app_user_id AND login.facility_id=guardian.facility_id
      WHERE guardian.id=$1 AND guardian.facility_id=$2`,
      [context.contactMemberId,context.facilityId])).rows[0]
    const email=normalizeSignupEmail(contact?.email)
    if(!email)throw inputError('The guardian account needs a valid contact email before booking.',400)
    const booking=await bookMemberFreeTrial(db,body.freeTrial,{memberId,facilityId:context.facilityId,
      contactEmail:email,contactPhone:contact.phone})
    await recordFreeTrialLead(db,{facilityId:context.facilityId,payerMemberId:context.contactMemberId,memberId})
    // Recheck after the shared booking lock order (child, entitlement, class,
    // guardian, household, lead). A concurrent archive/conversion rolls back all.
    const current=await trialContext(db,context.facilityId,leadId,{lock:true})
    if(!current.children.some(child=>child.memberId===memberId))throw inputError('This child is no longer available for this lead.',409)
    const details=(await db.query(`SELECT booking.class_date::text AS "classDate",
      COALESCE(NULLIF(class.display_name,''),class.name,form.title) AS "className"
      FROM drop_in_registration booking JOIN scheduling_form form ON form.id=booking.form_id
      JOIN program class ON class.id=form.program_id AND class.facility_id=$2
      WHERE booking.id=$1 AND booking.member_id=$3`,[booking.id,current.facilityId,memberId])).rows[0]
    await db.query('COMMIT')
    return {...booking,...details}
  }catch(error){await db.query('ROLLBACK');throw error}finally{db.release()}
}
