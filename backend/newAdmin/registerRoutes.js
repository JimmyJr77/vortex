import { classRoster } from './classRoster.js'
import { saveClass,saveClassPrice } from './classPricing.js'
import rateLimit from 'express-rate-limit'
import { createLeadInvitation, deliverLeadInvitation, openLeadRegistration, completeLeadRegistration, leadRegistrationCatalog, invitationSummary } from './leadRegistration.js'
import { createCanonicalAdminAuth,canonicalAdminPermission } from '../platform/canonicalAdminAuth.js'
import { listAccountDirectory } from '../accounts/accountDirectory.js'
import { createSchedulingHandlers } from '../scheduling/handlers.js'
import { handler,id,inputError } from './common.js'
import { listLeads,createLead,saveLead,leadNotes,convertLead,createScopedMember } from './leads.js'
import { listClasses,classDetail,memberDetail } from './reads.js'
import { schedulingScopeMiddleware } from './scope.js'
import { listFamilies, loadFamilyWorkspace } from './familyWorkspace.js'
import { loadEnrollmentTrend } from './enrollmentTrend.js'
import { saveMarketingSpend } from './marketingSpend.js'
import { loadBillingDashboard } from './billingDashboard.js'
import { familyNotes } from './accountNotes.js'
import { timesheetOptions,listTimesheets,changeTimesheet } from './timesheets.js'
import { weeklyTimesheets,saveWeeklyHours,assignTime } from './weeklyTimesheets.js'
export { registerLegacySchedulingScopeGuards } from './scope.js'

export function permissionMiddleware(pool,permission) {
  return async(req,res,next)=>{
    try {
      if(!req.canonicalAccess?.portalAccess.admin) return res.status(403).json({success:false,message:'Admin Portal access required.'})
      const permissions=Array.isArray(permission)?permission:[permission]
      req.newAdminPermissions ||= new Map()
      for(const key of permissions) {
        if(!req.newAdminPermissions.has(key)) req.newAdminPermissions.set(key,canonicalAdminPermission(pool,req.canonicalAccess.userId,key))
        if(!await req.newAdminPermissions.get(key)) return res.status(403).json({success:false,message:`Missing permission: ${key}`})
      }
      id(req.canonicalAccess.facilityId,'facility')
      next()
    }catch(error){res.status(error.statusCode||500).json({success:false,message:'Unable to authorize this request.'})}
  }
}

export function registerNewAdminRoutes(app,pool,{jwtSecret}) {
  const base='/api/admin/new-admin',auth=createCanonicalAdminAuth(pool,jwtSecret)
  app.use(base,(req,res,next)=>req.canonicalAccess?next():auth(req,res,next))
  const allow=permission=>permissionMiddleware(pool,permission)
  const facility=req=>req.canonicalAccess.facilityId
  app.get(`${base}/timesheets/options`,allow([]),handler(req=>timesheetOptions(pool,req.canonicalAccess)))
  app.get(`${base}/timesheets/week`,allow([]),handler(req=>weeklyTimesheets(pool,req.canonicalAccess,req.query)))
  app.put(`${base}/timesheets/week`,allow([]),handler(req=>saveWeeklyHours(pool,req.canonicalAccess,req.body)))
  app.post(`${base}/timesheets/assignments`,allow([]),handler(req=>assignTime(pool,req.canonicalAccess,req.body)))
  app.delete(`${base}/timesheets/assignments/:id`,allow([]),handler(req=>assignTime(pool,req.canonicalAccess,req.body,req.params.id)))
  app.get(`${base}/timesheets`,allow([]),handler(req=>listTimesheets(pool,req.canonicalAccess,req.query)))
  app.post(`${base}/timesheets`,allow([]),handler(req=>changeTimesheet(pool,req.canonicalAccess,'create',null,req.body)))
  app.post(`${base}/timesheets/clock-in`,allow([]),handler(req=>changeTimesheet(pool,req.canonicalAccess,'clock_in',null)))
  app.post(`${base}/timesheets/:id/clock-out`,allow([]),handler(req=>changeTimesheet(pool,req.canonicalAccess,'clock_out',req.params.id,req.body)))
  app.patch(`${base}/timesheets/:id`,allow([]),handler(req=>changeTimesheet(pool,req.canonicalAccess,'edit',req.params.id,req.body)))
  app.delete(`${base}/timesheets/:id`,allow([]),handler(req=>changeTimesheet(pool,req.canonicalAccess,'remove',req.params.id,req.body)))
  const workspace = async (req, target) => loadFamilyWorkspace(pool, {
    facilityId: facility(req), ...target,
    canViewBilling: await canonicalAdminPermission(pool, req.canonicalAccess.userId, 'billing.view'),
  })
  app.get(`${base}/enrollment-trend`,allow('members.view'),handler(async req=>{
    const canViewFinancial = await canonicalAdminPermission(pool,req.canonicalAccess.userId,'billing.view')
    const canEditMarketing = canViewFinancial && await canonicalAdminPermission(pool,req.canonicalAccess.userId,'marketing.manage')
    return { ...await loadEnrollmentTrend(pool,facility(req),new Date(),{canViewFinancial}), permissions: {canViewFinancial,canEditMarketing} }
  }))
  app.put(`${base}/marketing-spend/:month`,allow(['members.view','billing.view','marketing.manage']),
    handler(req=>saveMarketingSpend(pool,facility(req),req.canonicalAccess.userId,req.params.month,req.body)))
  app.get(`${base}/billing-dashboard`,allow('billing.view'),handler(req=>loadBillingDashboard(pool,facility(req))))
  app.get(`${base}/families`,allow('members.view'),handler(req=>listFamilies(pool,facility(req),req.query)))
  app.get(`${base}/families/:id/workspace`,allow('members.view'),handler(req=>workspace(req,{familyId:req.params.id})))
  app.get(`${base}/families/:id/history`,allow('members.view'),handler(req=>workspace(req,{familyId:req.params.id,historyCursor:req.query.cursor || null})))
  app.get(`${base}/families/:id/notes`,allow('members.view'),handler(req=>familyNotes(pool,facility(req),req.params.id)))
  app.get(`${base}/members/:id/workspace`,allow('members.view'),handler(req=>workspace(req,{memberId:req.params.id})))
  // Retain the old lead screen's full array contract and existing edit handlers,
  // but apply the same facility boundary and permissions used by New Admin.
  app.get('/api/admin/registrations',allow('members.view'),handler(async req=>{
    const result=await pool.query('SELECT * FROM registrations WHERE facility_id=$1 AND archived IS NOT TRUE ORDER BY created_at DESC,id DESC',[facility(req)])
    return result.rows
  }))
  const legacyLeadGuard=async(req,res,next)=>{
    try {
      const result=await pool.query('SELECT id FROM registrations WHERE id=$1 AND facility_id=$2',[id(req.params.id),facility(req)])
      if(!result.rows[0]) return res.status(404).json({success:false,message:'Lead not found.'})
      next()
    }catch(error){res.status(error.statusCode||500).json({success:false,message:'Unable to verify lead access.'})}
  }
  app.put('/api/admin/registrations/:id',allow('members.edit'),legacyLeadGuard,(_req,_res,next)=>next())
  app.delete('/api/admin/registrations/:id',allow('members.edit'),legacyLeadGuard,(_req,_res,next)=>next())
  app.get(`${base}/members`,allow('members.view'),handler(req=>listAccountDirectory(pool,{facilityId:facility(req),query:req.query})))
  app.get(`${base}/members/:id`,allow('members.view'),handler(req=>memberDetail(pool,facility(req),req.params.id,req.query)))
  app.post(`${base}/members`,allow('members.edit'),handler(async req=>{
    const client=await pool.connect()
    try{await client.query('BEGIN');const result=await createScopedMember(client,facility(req),req.body);await client.query('COMMIT');return result}
    catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  }))
  app.get(`${base}/leads`,allow('members.view'),handler(req=>listLeads(pool,facility(req),req.query)))
  app.post(`${base}/leads`,allow('members.edit'),handler(req=>createLead(pool,facility(req),req.body)))
  app.patch(`${base}/leads/:id`,allow('members.edit'),handler(req=>saveLead(pool,facility(req),req.params.id,req.body,req)))
  app.delete(`${base}/leads/:id`,allow('members.edit'),handler(async req=>{
    const result=await pool.query(`UPDATE registrations SET archived=TRUE,updated_at=now() WHERE id=$1 AND facility_id=$2 RETURNING id`,[id(req.params.id),facility(req)])
    if(!result.rows[0]) throw inputError('Lead not found.',404)
    return {id:Number(result.rows[0].id),archived:true}
  }))
  app.get(`${base}/leads/:id/notes`,allow('members.view'),handler(req=>leadNotes(pool,facility(req),req.params.id)))
  app.post(`${base}/leads/:id/convert`,allow('members.edit'),handler(async req=>{
    if (req.body?.mode === 'invite') {
      if ((req.body.selections || []).some(item=>item.kind==='reserved') && !await canonicalAdminPermission(pool,req.canonicalAccess.userId,'scheduling.manage')) throw inputError('Scheduling permission is required to reserve a class.',403)
      return createLeadInvitation(pool,{facilityId:facility(req),leadId:req.params.id,userId:req.canonicalAccess.userId,body:req.body})
    }
    return convertLead(pool,{facilityId:facility(req),leadId:req.params.id,userId:req.canonicalAccess.userId,body:req.body})
  }))
  app.get(`${base}/lead-registration/catalog`,allow('members.edit'),handler(req=>leadRegistrationCatalog(pool,facility(req))))
  app.get(`${base}/lead-registration/:id`,allow('members.edit'),handler(async req=>{
    const row=(await pool.query("SELECT * FROM account_invite WHERE id=$1 AND facility_id=$2 AND invite_type='lead_registration'",[id(req.params.id),facility(req)])).rows[0]
    if(!row) throw inputError('Invitation not found.',404)
    return invitationSummary(row)
  }))
  app.post(`${base}/lead-registration/:id/send`,allow('members.edit'),handler(req=>deliverLeadInvitation(pool,{facilityId:facility(req),inviteId:req.params.id,resend:true})))
  const invitationLoginLimit=rateLimit({windowMs:15*60*1000,max:20,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'Too many sign-in attempts. Please try again later.'}})
  app.post('/api/signup/lead/:id/session',invitationLoginLimit,handler(req=>openLeadRegistration(pool,req.params.id,req.body)))
  app.post('/api/signup/lead/:id/complete',invitationLoginLimit,handler(req=>completeLeadRegistration(pool,req.params.id,req.body,{ip:req.ip,userAgent:req.get('user-agent')})))
  app.get(`${base}/classes`,allow('classes.view'),handler(req=>listClasses(pool,facility(req),req.query)))
  app.get(`${base}/pricing/classes`,allow('pricing.view'),handler(async req=>{
    const result=await listClasses(pool,facility(req),req.query)
    return {...result,rows:result.rows.map(({id,formId,programsId,name,programName,isActive,monthlyPriceCents,costAmountCents,costUnit})=>({id,formId,programsId,name,programName,isActive,monthlyPriceCents,costAmountCents,costUnit}))}
  }))
  app.patch(`${base}/pricing/classes/:id`,allow('pricing.manage'),handler(req=>saveClassPrice(pool,facility(req),req.params.id,req.body)))
  app.get(`${base}/pricing/assignments`,allow('pricing.view'),handler(async req=>(await pool.query(`
    SELECT b.benefit_id AS "ruleId",b.scope_level AS "scopeLevel",b.scope_ref_id AS "scopeRefId",
      CASE WHEN b.scope_level='program' THEN p.display_name ELSE f.title END AS name
    FROM pricing_benefit_selection b
    LEFT JOIN programs p ON b.scope_level='program' AND p.id=b.scope_ref_id
    LEFT JOIN scheduling_form f ON b.scope_level='class' AND f.id=b.scope_ref_id
    LEFT JOIN program c ON c.id=f.program_id
    WHERE b.benefit_type='discount_rule' AND (p.facility_id=$1 OR c.facility_id=$1)
    ORDER BY b.scope_level,b.scope_ref_id,b.benefit_id`,[facility(req)])).rows.map(row=>({...row,ruleId:Number(row.ruleId),scopeRefId:Number(row.scopeRefId)}))))
  app.get(`${base}/classes/:id`,allow(['classes.view','members.view']),handler(req=>classDetail(pool,facility(req),req.params.id,req.query)))
  app.post(`${base}/classes`,allow('classes.manage'),handler(req=>saveClass(pool,facility(req),null,req.body)))
  app.put(`${base}/classes/:id`,allow('classes.manage'),handler(req=>saveClass(pool,facility(req),req.params.id,req.body)))
  app.get(`${base}/classes/:id/roster`,allow(['classes.view','members.view']),handler(req=>classRoster(pool,facility(req),req.params.id,req.query)))
  const scheduling=createSchedulingHandlers(pool)
  app.post(`${base}/enrollments`,allow(['members.edit','scheduling.manage']),schedulingScopeMiddleware(pool,'create'),scheduling.adminCreateSignup)
  app.patch(`${base}/enrollments/:id`,allow(['members.edit','scheduling.manage']),schedulingScopeMiddleware(pool,'signup'),scheduling.updateSignupStatus)
  app.patch(`${base}/groups/:id`,allow('scheduling.manage'),schedulingScopeMiddleware(pool,'group'),scheduling.updateSlotGroupMax)
}
