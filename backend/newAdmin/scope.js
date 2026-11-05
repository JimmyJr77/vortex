import { inputError,id } from './common.js'
import { canonicalAdminPermission } from '../platform/canonicalAdminAuth.js'

const formTenant=`(EXISTS (SELECT 1 FROM program p WHERE p.id=f.program_id AND p.facility_id=$2)
  OR (f.program_id IS NULL AND EXISTS (SELECT 1 FROM programs pr WHERE pr.id=f.programs_id AND pr.facility_id=$2)))`

export async function assertResourceScope(db,facilityId,kind,recordId,{body={},formId=null,classId=null}={}) {
  const facility=id(facilityId,'facility'),record=id(recordId,kind)
  const queries={
    form:`SELECT f.id FROM scheduling_form f WHERE f.id=$1 AND ${formTenant}`,
    offering:`SELECT o.id FROM scheduling_offering o JOIN scheduling_form f ON f.id=o.form_id WHERE o.id=$1 AND ${formTenant}`,
    slot:`SELECT ts.id FROM scheduling_time_slot ts JOIN scheduling_form f ON f.id=ts.form_id WHERE ts.id=$1 AND ${formTenant}`,
    class:'SELECT id FROM program WHERE id=$1 AND facility_id=$2',
    program:'SELECT id FROM programs WHERE id=$1 AND facility_id=$2',
    member:'SELECT id FROM member WHERE id=$1 AND facility_id=$2',
    orphan:'SELECT s.id FROM scheduling_signup s JOIN member m ON m.id=s.member_id WHERE s.id=$1 AND m.facility_id=$2',
  }
  if(!queries[kind]) throw inputError('Unsupported resource scope.')
  if(!(await db.query(queries[kind],[record,facility])).rows[0]) throw inputError('Record not found in this facility.',404)
  if(kind==='class'||kind==='form') {
    const parent=body.programsId ?? body.categoryId
    if(parent!=null&&!(await db.query('SELECT id FROM programs WHERE id=$1 AND facility_id=$2',[id(parent,'program'),facility])).rows[0]) throw inputError('Target program not found in this facility.',404)
    if(kind==='form'&&body.programId!=null) await assertResourceScope(db,facility,'class',body.programId)
  }
  if(kind==='orphan'&&body.targetFormId!=null) await assertSchedulingScope(db,facility,{kind:'create',body:{formId:body.targetFormId,slotGroupId:body.slotGroupId,timeSlotId:body.timeSlotId}})
  if(body.offeringId!=null) {
    const targetForm=kind==='form'?record:formId
    if(!targetForm||!(await db.query('SELECT id FROM scheduling_offering WHERE id=$1 AND form_id=$2',[id(body.offeringId,'offering'),targetForm])).rows[0]) throw inputError('Offering does not belong to this class.',404)
  }
  if(kind==='slot'&&classId!=null&&!(await db.query('SELECT ts.id FROM scheduling_time_slot ts JOIN scheduling_form f ON f.id=ts.form_id WHERE ts.id=$1 AND f.program_id=$2',[record,id(classId,'class')])).rows[0]) throw inputError('Time slot does not belong to this class.',404)
}

/** The same precondition wraps old and New Admin mutations. It never owns pricing. */
export async function assertSchedulingScope(db,facilityId,{kind,recordId,body={}}) {
  const facility=id(facilityId,'facility')
  let query,values
  if(kind==='signup') {
    query=`SELECT s.id FROM scheduling_signup s JOIN scheduling_form f ON f.id=s.form_id
      JOIN program p ON p.id=f.program_id AND p.facility_id=$2
      JOIN member m ON m.id=s.member_id AND m.facility_id=p.facility_id WHERE s.id=$1`
    values=[id(recordId,'enrollment'),facility]
  } else if(kind==='group') {
    query=`SELECT g.id FROM scheduling_slot_group g JOIN scheduling_form f ON f.id=g.form_id
      JOIN program p ON p.id=f.program_id WHERE g.id=$1 AND p.facility_id=$2`
    values=[id(recordId,'group'),facility]
  } else if(kind==='create') {
    query=`SELECT g.id FROM scheduling_slot_group g JOIN scheduling_form f ON f.id=g.form_id
      JOIN program p ON p.id=f.program_id AND p.facility_id=$3
      WHERE f.id=$1 AND g.id=$2
        AND ($4::bigint IS NULL OR EXISTS (SELECT 1 FROM member m WHERE m.id=$4 AND m.facility_id=p.facility_id AND m.is_active=TRUE))
        AND ($5::bigint IS NULL OR EXISTS (SELECT 1 FROM scheduling_time_slot ts WHERE ts.id=$5 AND ts.slot_group_id=g.id))`
    values=[id(body.formId,'form'),id(body.slotGroupId,'group'),facility,body.memberId==null?null:id(body.memberId,'member'),body.timeSlotId==null?null:id(body.timeSlotId,'time slot')]
  } else throw inputError('Unsupported scheduling action.')
  const result=await db.query(query,values)
  if(!result.rows[0]) throw inputError('Enrollment, class, or member not found in this facility.',404)
}

export function schedulingScopeMiddleware(pool,kind) {
  return async(req,res,next)=>{
    try {await assertSchedulingScope(pool,req.canonicalAccess?.facilityId,{kind,recordId:req.params.id,body:req.body});next()}
    catch(error){res.status(error.statusCode||500).json({success:false,message:error.statusCode?error.message:'Unable to verify scheduling access.'})}
  }
}

/** Install after canonical admin auth and before legacy scheduling routes. */
export function registerLegacySchedulingScopeGuards(app,pool) {
  const pass=(_req,_res,next)=>next()
  app.post('/api/admin/scheduling/signups',schedulingScopeMiddleware(pool,'create'),pass)
  app.patch('/api/admin/scheduling/signups/:id',schedulingScopeMiddleware(pool,'signup'),pass)
  app.patch('/api/admin/scheduling/slot-groups/:id',schedulingScopeMiddleware(pool,'group'),pass)
  app.delete('/api/admin/scheduling/enrollments/:id',schedulingScopeMiddleware(pool,'signup'),pass)
  app.post('/api/admin/scheduling/signups/:id/discount',schedulingScopeMiddleware(pool,'signup'),pass)
  app.post('/api/admin/scheduling/signups/:id/resend-email',schedulingScopeMiddleware(pool,'signup'),pass)
  app.patch('/api/admin/scheduling/signups/:id/member-password',schedulingScopeMiddleware(pool,'signup'),pass)

  const resource=(kind,key='id')=>async(req,res,next)=>{
    try {
      await assertResourceScope(pool,req.canonicalAccess?.facilityId,kind,req.params[key],{body:req.body,formId:req.params.formId,classId:req.params.classId})
      // Preserve the existing route family's permissions, including member
      // enrollment reads that belong to scheduling rather than member editing.
      const permission=req.path.includes('/scheduling/')?(req.method==='GET'?'scheduling.view':'scheduling.manage'):(req.method==='GET'?'classes.view':'classes.manage')
      if(!await canonicalAdminPermission(pool,req.canonicalAccess.userId,permission)) return res.status(403).json({success:false,message:`Missing permission: ${permission}`})
      next()
    }catch(error){res.status(error.statusCode||500).json({success:false,message:error.statusCode?error.message:'Unable to verify resource access.'})}
  }
  for(const [method,path,kind,key] of [
    ['get','/api/admin/scheduling/forms/:id','form'],['put','/api/admin/scheduling/forms/:id','form'],['delete','/api/admin/scheduling/forms/:id','form'],
    ['post','/api/admin/scheduling/forms/:id/pricing/reset','form'],['patch','/api/admin/scheduling/forms/:id/active','form'],
    ['put','/api/admin/scheduling/forms/:id/signup-fields','form'],['put','/api/admin/scheduling/forms/:id/active-dates','form'],
    ['get','/api/admin/scheduling/forms/:formId/offerings','form','formId'],['post','/api/admin/scheduling/forms/:formId/offerings','form','formId'],
    ['post','/api/admin/scheduling/forms/:formId/slot-batches','form','formId'],['get','/api/admin/scheduling/forms/:formId/slot-enrollments','form','formId'],
    ['put','/api/admin/scheduling/offerings/:id','offering'],['patch','/api/admin/scheduling/offerings/:id/select','offering'],['delete','/api/admin/scheduling/offerings/:id','offering'],
    ['post','/api/admin/scheduling/orphaned-signups/:id/re-enroll','orphan'],['delete','/api/admin/scheduling/orphaned-signups/:id','orphan'],
    ['patch','/api/admin/scheduling/time-slots/:id','slot'],['delete','/api/admin/scheduling/time-slots/:id','slot'],
    ['get','/api/admin/scheduling/members/:memberId/enrollments','member','memberId'],['get','/api/admin/scheduling/members/:memberId/pricing-summary','member','memberId'],
    ['get','/api/admin/programs/:programsId/class-events','program','programsId'],['post','/api/admin/programs/:programsId/class-events','program','programsId'],
    ['get','/api/admin/class-events/:id/scheduling-form','class'],['post','/api/admin/programs/:id/duplicate','class'],
    ['put','/api/admin/programs/:id','class'],['patch','/api/admin/programs/:id/archive','class'],['delete','/api/admin/programs/:id','class'],
    ['patch','/api/admin/programs/:classId/time-slots/:slotId/archive','slot','slotId'],
    ['put','/api/admin/programs-top/:id','program'],['patch','/api/admin/programs-top/:id/archive','program'],['delete','/api/admin/programs-top/:id','program'],
    ['post','/api/admin/programs-top/:id/pricing/reset-classes','program'],
  ]) app[method](path,resource(kind,key),pass)
  app.delete('/api/admin/scheduling/slot-groups/:id',schedulingScopeMiddleware(pool,'group'),pass)
  app.get('/api/admin/class-events/:id/scheduling-form',async(req,res,next)=>{
    try {
      // The retained handler creates a form on demand. Reading an existing form
      // needs classes.view; initializing a schedule additionally needs manage.
      const existing=await pool.query('SELECT id FROM scheduling_form WHERE program_id=$1 AND deleted_at IS NULL LIMIT 1',[id(req.params.id,'class')])
      if(!existing.rows[0]&&!await canonicalAdminPermission(pool,req.canonicalAccess.userId,'scheduling.manage')) return res.status(403).json({success:false,message:'Missing permission: scheduling.manage'})
      next()
    }catch(error){res.status(error.statusCode||500).json({success:false,message:'Unable to verify scheduling access.'})}
  },pass)

  // Compatibility list routes retain their existing DTOs, restricted to the
  // authenticated facility before serialization. New Admin uses bounded SQL.
  const filterList=(kind,rowKey='id')=>async(req,res,next)=>{
    try {
      const permission=['form','signup'].includes(kind)?'scheduling.view':'classes.view'
      if(!await canonicalAdminPermission(pool,req.canonicalAccess?.userId,permission)) return res.status(403).json({success:false,message:`Missing permission: ${permission}`})
      const query=kind==='form'?`SELECT f.id FROM scheduling_form f WHERE ${formTenant.replaceAll('$2','$1')}`
        :kind==='signup'?`SELECT s.id FROM scheduling_signup s JOIN member m ON m.id=s.member_id WHERE m.facility_id=$1`
        :`SELECT id FROM ${kind==='program'?'programs':'program'} WHERE facility_id=$1`
      const permitted=new Set((await pool.query(query,[id(req.canonicalAccess?.facilityId,'facility')])).rows.map(r=>Number(r.id)))
      const send=res.json.bind(res)
      res.json=payload=>{
        if(payload?.success!==false) {
          for(const key of ['data','programs','classes','forms','categories','signups']) {
            if(Array.isArray(payload?.[key])) payload={...payload,[key]:payload[key].filter(row=>permitted.has(Number(row[rowKey])))}
          }
          if(Array.isArray(payload?.data?.rows)) payload={...payload,data:{...payload.data,rows:payload.data.rows.filter(row=>permitted.has(Number(row[rowKey])))}}
        }
        return send(payload)
      }
      next()
    }catch(error){res.status(error.statusCode||500).json({success:false,message:'Unable to scope the catalog.'})}
  }
  app.get('/api/admin/scheduling/forms',filterList('form'),pass)
  app.get('/api/admin/scheduling/signups',filterList('signup'),pass)
  app.get('/api/admin/scheduling/orphaned-signups',filterList('signup'),pass)
  app.get('/api/admin/programs-top',filterList('program'),pass)
  app.get('/api/admin/programs',filterList('class'),pass)
  app.get('/api/admin/categories',filterList('program'),pass)
  app.get('/api/admin/class-setup/overview',filterList('class','classId'),pass)
  app.get('/api/admin/scheduling/daily-roster',async(req,res,next)=>{
    try {
      const facility=id(req.canonicalAccess?.facilityId,'facility')
      const [forms,signups]=await Promise.all([
        pool.query(`SELECT f.id FROM scheduling_form f WHERE ${formTenant.replaceAll('$2','$1')}`,[facility]),
        pool.query(`SELECT s.id FROM scheduling_signup s JOIN scheduling_form f ON f.id=s.form_id
          JOIN member m ON m.id=s.member_id AND m.facility_id=$1
          WHERE ${formTenant.replaceAll('$2','$1')}`,[facility]),
      ])
      const permitted=new Set(forms.rows.map(r=>Number(r.id)))
      const permittedSignups=new Set(signups.rows.map(r=>Number(r.id)))
      const send=res.json.bind(res)
      res.json=payload=>{
        if(payload?.success!==false&&Array.isArray(payload?.data?.classes)) {
          const classes=payload.data.classes.filter(row=>permitted.has(Number(row.formId)))
          const newRegistrations=(payload.data.newRegistrations||[]).filter(row=>permittedSignups.has(Number(row.signupId)))
          payload={...payload,data:{...payload.data,classes,classCount:classes.length,athleteCount:classes.reduce((n,row)=>n+Number(row.athleteCount||0),0),newRegistrations,newRegistrationCount:newRegistrations.length}}
        }
        return send(payload)
      };next()
    }catch(error){res.status(500).json({success:false,message:'Unable to scope the roster.'})}
  },pass)
  for(const path of ['/api/admin/scheduling/pricing-pass-attachments','/api/admin/scheduling/pricing-benefit-selections']) {
    for(const method of ['get','put']) app[method](path,async(req,res,next)=>{
      try {
        const input=req.method==='GET'?req.query:req.body
        if(!['program','class'].includes(input.scopeLevel)) throw inputError('Select a program or class pricing scope.')
        await assertResourceScope(pool,req.canonicalAccess?.facilityId,input.scopeLevel==='program'?'program':'form',input.scopeRefId)
        next()
      }catch(error){res.status(error.statusCode||500).json({success:false,message:error.statusCode?error.message:'Unable to verify pricing scope.'})}
    },pass)
  }
}
