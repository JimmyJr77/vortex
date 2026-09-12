import {createHash,randomUUID} from 'node:crypto'
export const allocationFields=['providerPlanId','participantId','withheldDate','ordinaryPretaxCents','ordinaryRothCents','catchUpPretaxCents','catchUpRothCents','totalCents']
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x)
export function retirementAllocationFormatInput(b){
 if(!b||!['VERIFIED','SUSPENDED'].includes(b.disposition)||b.confirmed!==true||typeof b.reference!=='string'||b.reference.trim().length<20||b.reference.length>2000)throw fail('Confirm the recordkeeper format and retain its specification reference.')
 const base={disposition:b.disposition,reference:b.reference.trim()}
 if(b.disposition==='SUSPENDED')return base
 if(!['CENTS','DOLLARS'].includes(b.amountFormat)||!['ISO','US'].includes(b.dateFormat)||typeof b.includeHeader!=='boolean'||!Array.isArray(b.columns)||b.columns.length!==allocationFields.length)throw fail('Review all allocation columns, amount/date formats and header requirements.')
 const fields=new Set(),headers=new Set(),columns=b.columns.map(c=>{
  if(!allocationFields.includes(c?.field)||fields.has(c.field)||typeof c.header!=='string'||!/^[A-Za-z][A-Za-z0-9 _().-]{0,79}$/.test(c.header)||headers.has(c.header.toLowerCase()))throw fail('Each allocation field needs a unique reviewed column and safe header.')
  fields.add(c.field);headers.add(c.header.toLowerCase());return {field:c.field,header:c.header}
 })
 return {...base,amountFormat:b.amountFormat,dateFormat:b.dateFormat,includeHeader:b.includeHeader,columns,encoding:'UTF-8',delimiter:',',lineEnding:'CRLF'}
}
export async function retirementAllocationFormatHistory(db,facility,planId){
 const plan=(await db.query('SELECT id FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,planId])).rows[0]
 if(!plan)throw fail('Retirement plan not found.',404)
 const history=(await db.query('SELECT id,revision,plan_revision_id,format,created_at FROM payroll_retirement_allocation_format WHERE facility_id=$1 AND plan_id=$2 ORDER BY revision DESC',[facility,planId])).rows.map(r=>({...r,currentPlan:r.plan_revision_id===plan.id}))
 return {planRevisionId:plan.id,history}
}
export function registerRetirementAllocationFormatRoutes(app,pool){
 const base='/api/admin/payroll/retirement-plans/:planId/allocation-format'
 app.get(base,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await retirementAllocationFormatHistory(pool,req.canonicalAccess.facilityId,req.params.planId)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load allocation format.'})}})
 app.post(base,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  const b=req.body||{},facility=req.canonicalAccess.facilityId,planId=req.params.planId,format=retirementAllocationFormatInput(b.format)
  if(!uuid(b.requestKey)||!uuid(b.planRevisionId)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0)throw fail('Use current plan and format revisions with a valid request key.')
  const fingerprint=createHash('sha256').update(JSON.stringify({planId,format,planRevisionId:b.planRevisionId,expectedRevision:b.expectedRevision})).digest('hex')
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_allocation_format WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==fingerprint)throw fail('Request key belongs to different format evidence.',409);await db.query('COMMIT');return res.json({success:true,data:{id:prior.id,reused:true}})}
  const current=await retirementAllocationFormatHistory(db,facility,planId)
  if(current.planRevisionId!==b.planRevisionId||(current.history[0]?.revision||0)!==b.expectedRevision)throw fail('Plan or allocation format changed. Reload the current review.',409)
  const id=randomUUID();await db.query('INSERT INTO payroll_retirement_allocation_format(id,facility_id,plan_id,plan_revision_id,revision,format,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,facility,planId,b.planRevisionId,b.expectedRevision+1,format,b.requestKey,fingerprint,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_ALLOCATION_FORMAT_REVIEWED','retirement_allocation_format',$3,$4)",[facility,req.adminId,id,{planId,revision:b.expectedRevision+1,disposition:format.disposition}])
  await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain allocation format.'})}finally{db.release()}})
}
