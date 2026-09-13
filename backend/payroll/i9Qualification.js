import {createHash} from 'node:crypto'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export function i9QualificationInput(raw){
 const keys=['siteName','eVerifyEnrolled','goodStanding','allSitesEnrolled','trainingComplete','consistentProcedure','observedOn','evidence']
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!keys.includes(k)))throw fail('Use the supported employer qualification fields.')
 for(const [key,min,max] of [['siteName',1,200],['evidence',12,2000]])if(typeof raw[key]!=='string'||raw[key].trim().length<min||raw[key].length>max||/[\u0000-\u001f\u007f]/.test(raw[key]))throw fail('Identify the covered hiring site and retain meaningful qualification evidence.')
 for(const key of keys.slice(1,6))if(typeof raw[key]!=='boolean')throw fail('Explicitly record each current employer qualification finding.')
 if(typeof raw.observedOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(raw.observedOn)||!Number.isFinite(Date.parse(raw.observedOn))||new Date(raw.observedOn).toISOString().slice(0,10)!==raw.observedOn)throw fail('Record a real qualification observation date.')
 return Object.fromEntries(keys.map(k=>[k,typeof raw[k]==='string'?raw[k].trim().normalize('NFC'):raw[k]]))
}
export async function readI9Qualification(db,ctx){
 const settings=(await db.query('SELECT facility_id,(clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility])).rows[0]
 if(!settings)throw fail('Payroll facility not found.',404)
 const history=(await db.query('SELECT revision,findings,actor_user_id AS "actorUserId",recorded_at AS "recordedAt" FROM payroll_i9_qualification WHERE facility_id=$1 ORDER BY revision DESC',[ctx.facility])).rows
 return {revision:history[0]?.revision||0,current:history[0]||null,history,today:settings.today}
}
export async function saveI9Qualification(db,ctx,body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['findings','expectedRevision','requestKey'].includes(k)))throw fail('Use the supported qualification save fields.')
 const current=await readI9Qualification(db,ctx),findings=i9QualificationInput(body.findings)
 if(findings.observedOn>current.today)throw fail('Qualification observations cannot be dated in the future.')
 if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Reload the qualification revision and use a unique save key.')
 const requestHash=hash({findings,expectedRevision:body.expectedRevision})
 const prior=(await db.query('SELECT revision,request_hash,actor_user_id FROM payroll_i9_qualification WHERE facility_id=$1 AND request_key=$2',[ctx.facility,body.requestKey])).rows[0]
 if(prior){if(prior.request_hash!==requestHash||String(prior.actor_user_id)!==String(ctx.admin))throw fail('This save key belongs to different qualification evidence.',409);return {recordedRevision:prior.revision,...current}}
 if(body.expectedRevision!==current.revision)throw fail('Employer qualification changed. Reload before recording your findings.',409)
 const revision=current.revision+1
 await db.query('INSERT INTO payroll_i9_qualification(facility_id,revision,findings,actor_user_id,request_key,request_hash) VALUES($1,$2,$3,$4,$5,$6)',[ctx.facility,revision,findings,ctx.admin,body.requestKey,requestHash])
 const participationChanged=!current.current||['eVerifyEnrolled','allSitesEnrolled','siteName'].some(key=>current.current.findings[key]!==findings[key])
 if(participationChanged)await db.query(`INSERT INTO payroll_compliance_task(facility_id,task_key,title,category,jurisdiction,due_date,status,severity,description,source_url,source_authority) VALUES($1,$2,'Review E-Verify participation and hiring scope','ONBOARDING','US',$3,'OPEN','WARNING',$4,'https://www.e-verify.gov/employers/verification-process','Employer participation review')`,[ctx.facility,`I9_PARTICIPATION_REVIEW:${revision}`,current.today,`Qualification revision ${revision} records ${findings.eVerifyEnrolled?'enrolled':'not currently verified as enrolled'} participation for ${findings.siteName}. Review the official enrollment agreement, covered hiring sites, effective dates and any applicable federal-contract requirements. Reconcile new-hire case obligations and existing case follow-ups; determine whether any existing employee is within a permitted verification scope before creating a case. Record the scope, affected cases, actions and rule basis in the completion note. This is an internal review target for today, not a calculated government deadline. This task creates no external case and does not change earned pay.`])
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'I9_QUALIFICATION_RECORDED','payroll_settings',$3,$4)",[ctx.facility,ctx.admin,String(ctx.facility),{revision,observedOn:findings.observedOn}])
 return {recordedRevision:revision,...await readI9Qualification(db,ctx)}
}

export const qualificationAllowsAlternative=(qualification,fallback)=>qualification?['eVerifyEnrolled','goodStanding','allSitesEnrolled','trainingComplete','consistentProcedure'].every(key=>qualification.findings[key]===true):fallback===true
