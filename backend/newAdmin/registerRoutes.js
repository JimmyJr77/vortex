import { createCanonicalAdminAuth,canonicalAdminPermission } from '../platform/canonicalAdminAuth.js'
import { listAccountDirectory } from '../accounts/accountDirectory.js'
import { createSchedulingHandlers } from '../scheduling/handlers.js'
import { handler,id,inputError } from './common.js'
import { listLeads,createLead,updateLead,convertLead,createScopedMember } from './leads.js'
import { listClasses,classDetail,memberDetail } from './reads.js'
import { schedulingScopeMiddleware } from './scope.js'
import { listFamilies, loadFamilyWorkspace } from './familyWorkspace.js'
import { loadEnrollmentTrend } from './enrollmentTrend.js'
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
  const workspace = async (req, target) => loadFamilyWorkspace(pool, {
    facilityId: facility(req), ...target,
    canViewBilling: await canonicalAdminPermission(pool, req.canonicalAccess.userId, 'billing.view'),
  })
  app.get(`${base}/enrollment-trend`,allow('members.view'),handler(req=>loadEnrollmentTrend(pool,facility(req))))
  app.get(`${base}/families`,allow('members.view'),handler(req=>listFamilies(pool,facility(req),req.query)))
  app.get(`${base}/families/:id/workspace`,allow('members.view'),handler(req=>workspace(req,{familyId:req.params.id})))
  app.get(`${base}/families/:id/history`,allow('members.view'),handler(req=>workspace(req,{familyId:req.params.id,historyCursor:req.query.cursor || null})))
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
  app.patch(`${base}/leads/:id`,allow('members.edit'),handler(req=>updateLead(pool,facility(req),req.params.id,req.body)))
  app.delete(`${base}/leads/:id`,allow('members.edit'),handler(async req=>{
    const result=await pool.query(`UPDATE registrations SET archived=TRUE,updated_at=now() WHERE id=$1 AND facility_id=$2 RETURNING id`,[id(req.params.id),facility(req)])
    if(!result.rows[0]) throw inputError('Lead not found.',404)
    return {id:Number(result.rows[0].id),archived:true}
  }))
  app.post(`${base}/leads/:id/convert`,allow('members.edit'),handler(req=>convertLead(pool,{facilityId:facility(req),leadId:req.params.id,userId:req.canonicalAccess.userId,body:req.body})))
  app.get(`${base}/classes`,allow('classes.view'),handler(req=>listClasses(pool,facility(req),req.query)))
  app.get(`${base}/classes/:id`,allow(['classes.view','members.view']),handler(req=>classDetail(pool,facility(req),req.params.id,req.query)))
  const scheduling=createSchedulingHandlers(pool)
  app.post(`${base}/enrollments`,allow(['members.edit','scheduling.manage']),schedulingScopeMiddleware(pool,'create'),scheduling.adminCreateSignup)
  app.patch(`${base}/enrollments/:id`,allow(['members.edit','scheduling.manage']),schedulingScopeMiddleware(pool,'signup'),scheduling.updateSignupStatus)
  app.patch(`${base}/groups/:id`,allow('scheduling.manage'),schedulingScopeMiddleware(pool,'group'),scheduling.updateSlotGroupMax)
}
