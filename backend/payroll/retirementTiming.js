import {createHash,randomUUID} from 'node:crypto'
import {previousBankBusinessDay} from './bankCalendar.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x)
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(`${x}T00:00:00Z`))&&new Date(`${x}T00:00:00Z`).toISOString().slice(0,10)===x
function shift(day,n){let d=new Date(`${day}T00:00:00Z`);while(n!==0){d.setUTCDate(d.getUTCDate()+Math.sign(n));if(previousBankBusinessDay(d.toISOString().slice(0,10))===d.toISOString().slice(0,10))n-=Math.sign(n)}return d.toISOString().slice(0,10)}
export function retirementTimingInput(input){
 if(!input||!date(input.effectiveOn)||input.effectiveOn<'2026-01-01'||input.effectiveOn>'2026-12-31'||!['REVIEWED','SUSPENDED'].includes(input.disposition)||typeof input.reference!=='string'||input.reference.trim().length<20||input.reference.length>2000||input.confirmed!==true)throw fail('Review the effective date, disposition, timing evidence and confirmation.')
 const base={effectiveOn:input.effectiveOn,disposition:input.disposition,reference:input.reference.trim()}
 if(input.disposition==='SUSPENDED')return base
 if(!Number.isInteger(input.depositBusinessDays)||input.depositBusinessDays<0||input.depositBusinessDays>10||!Number.isInteger(input.providerLeadBusinessDays)||input.providerLeadBusinessDays<0||input.providerLeadBusinessDays>10||!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.cutoffTime||'')||input.calendarConfirmed!==true||input.earliestConfirmed!==true)throw fail('Review actual segregation timing, provider lead time, cutoff and bank calendar applicability.')
 return {...base,depositBusinessDays:input.depositBusinessDays,providerLeadBusinessDays:input.providerLeadBusinessDays,cutoffTime:input.cutoffTime,timeZone:'America/New_York',calendar:'FEDERAL_RESERVE'}
}
export function retirementTimingDates(policy,withheldDate,now=new Date()){
 if(!date(withheldDate)||!withheldDate.startsWith('2026-'))throw fail('Timing requires a supported actual withholding date.',409)
 // Same-day segregation on a closed bank day needs an actual alternate
 // delivery review; do not invent an earlier or later withholding/deposit day.
 if(policy.depositBusinessDays===0&&previousBankBusinessDay(withheldDate)!==withheldDate)return {status:'CALENDAR_REVIEW_REQUIRED'}
 const depositDate=policy.depositBusinessDays===0?withheldDate:shift(withheldDate,policy.depositBusinessDays)
 const submissionDate=shift(depositDate,-policy.providerLeadBusinessDays)
 // Bank days exclude Sunday DST transitions; noon's NY offset applies at cutoff.
 const offset=new Intl.DateTimeFormat('en-US',{timeZone:policy.timeZone,timeZoneName:'shortOffset'}).formatToParts(new Date(`${submissionDate}T12:00:00Z`)).find(p=>p.type==='timeZoneName').value
 const hours=Number(offset.replace('GMT',''))
 const submissionAt=new Date(Date.parse(`${submissionDate}T${policy.cutoffTime}:00Z`)-hours*3600000).toISOString()
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:policy.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now))
 return {depositDate,submissionDate,submissionAt,cutoffTime:policy.cutoffTime,timeZone:policy.timeZone,status:submissionDate<withheldDate?'ADVANCE_SUBMISSION_REVIEW_REQUIRED':today>depositDate?'DEPOSIT_TARGET_PASSED':new Date(now)>=new Date(submissionAt)?'SUBMISSION_CUTOFF_PASSED':today===submissionDate?'SUBMISSION_DUE_TODAY':'UPCOMING'}
}
export async function retirementTimingHistory(db,facility,planId){
 const plan=(await db.query('SELECT id FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,planId])).rows[0]
 if(!plan)throw fail('Retirement plan not found.',404)
 const history=(await db.query('SELECT id,revision,plan_revision_id,policy,created_at FROM payroll_retirement_timing_review WHERE facility_id=$1 AND plan_id=$2 ORDER BY revision DESC',[facility,planId])).rows
 return {planRevisionId:plan.id,history:history.map(r=>({...r,currentPlan:r.plan_revision_id===plan.id}))}
}
export async function retirementTimingAssessment(db,facility,planId,withheldDate,{now=new Date()}={}){
 const {planRevisionId,history}=await retirementTimingHistory(db,facility,planId),row=history.find(r=>r.policy.effectiveOn<=withheldDate)
 if(!row)return {status:'REVIEW_REQUIRED',reviewId:null}
 const basis={reviewId:row.id,planRevisionId}
 if(!row.currentPlan)return {...basis,status:'PLAN_CHANGED'}
 if(row.policy.disposition==='SUSPENDED')return {...basis,status:'SUSPENDED'}
 return {...basis,...retirementTimingDates(row.policy,withheldDate,now)}
}
export function registerRetirementTimingRoutes(app,pool){
 const path='/api/admin/payroll/retirement-plans/:planId/timing'
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await retirementTimingHistory(pool,req.canonicalAccess.facilityId,req.params.planId)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load retirement timing.'})}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  const b=req.body||{},facility=req.canonicalAccess.facilityId,planId=req.params.planId,policy=retirementTimingInput(b.policy)
  if(!uuid(b.requestKey)||!uuid(b.planRevisionId)||!Number.isInteger(b.expectedRevision)||b.expectedRevision<0)throw fail('Use current plan/timing revisions and a valid request key.')
  const fingerprint=hash({planId,policy,planRevisionId:b.planRevisionId,expectedRevision:b.expectedRevision})
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_retirement_timing_review WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(prior){if(prior.request_fingerprint!==fingerprint)throw fail('Request key belongs to different timing evidence.',409);await db.query('COMMIT');return res.json({success:true,data:{id:prior.id,reused:true}})}
  const current=await retirementTimingHistory(db,facility,planId)
  if(current.planRevisionId!==b.planRevisionId||(current.history[0]?.revision||0)!==b.expectedRevision)throw fail('Plan or timing changed. Reload the latest review.',409)
  const id=randomUUID();await db.query('INSERT INTO payroll_retirement_timing_review(id,facility_id,plan_id,plan_revision_id,revision,policy,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,facility,planId,b.planRevisionId,b.expectedRevision+1,policy,b.requestKey,fingerprint,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_TIMING_REVIEWED','retirement_timing_review',$3,$4)",[facility,req.adminId,id,{planId,revision:b.expectedRevision+1,disposition:policy.disposition}])
  await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain retirement timing.'})}finally{db.release()}})
}
