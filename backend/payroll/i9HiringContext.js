const fail=(message,status=400)=>Object.assign(new Error(message),{status})
async function scope(db,ctx,taskId,cycle){
 const employee=(await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[ctx.facility,ctx.employee])).rows[0]
 if(!employee)throw fail('Employee not found.',404)
 const task=(await db.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND id=$3 AND task_key='I9' FOR UPDATE",[ctx.facility,ctx.employee,taskId])).rows[0]
 if(!task)throw fail('I-9 step not found.',404)
 if(Number(cycle)!==task.onboarding_cycle)throw fail('Onboarding cycle changed. Reload this step.',409)
 return task
}
export async function readI9HiringContext(db,ctx,taskId,cycle){
 await scope(db,ctx,taskId,cycle)
 const history=(await db.query('SELECT revision,offer_accepted_on::text AS "offerAcceptedOn",e_verify AS "eVerify",evidence,actor_user_id AS "actorUserId",recorded_at AS "recordedAt" FROM payroll_i9_hiring_context WHERE task_id=$1 AND onboarding_cycle=$2 AND facility_id=$3 AND employee_id=$4 ORDER BY revision DESC',[taskId,cycle,ctx.facility,ctx.employee])).rows
 return {revision:history[0]?.revision||0,current:history[0]||null,history}
}
export async function saveI9HiringContext(db,ctx,taskId,body){
 const task=await scope(db,ctx,taskId,body.onboardingCycle)
 if(!['OPEN','CHANGES_REQUESTED','SUBMITTED'].includes(task.status))throw fail('Reopen the I-9 step before changing its preparation context.',409)
 if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)throw fail('Reload the I-9 context revision.')
 if(typeof body.eVerify!=='boolean'||body.offerAccepted!==true)throw fail('Explicitly confirm the accepted offer and employer E-Verify participation.')
 const date=body.offerAcceptedOn
 const today=(await db.query('SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[ctx.facility])).rows[0]?.today
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||!today||date>today)throw fail('Enter a valid offer acceptance date that is not in the future.')
 if(typeof body.evidence!=='string'||body.evidence.trim().length<12||body.evidence.length>2000||/[\u0000-\u001f\u007f]/.test(body.evidence))throw fail('Provide 12–2000 characters of offer and employer participation verification evidence.')
 const previous=await readI9HiringContext(db,ctx,taskId,body.onboardingCycle)
 if(previous.revision!==body.expectedRevision)throw fail('I-9 preparation context changed. Reload before saving.',409)
 const revision=previous.revision+1
 await db.query('INSERT INTO payroll_i9_hiring_context(facility_id,employee_id,task_id,onboarding_cycle,revision,offer_accepted_on,e_verify,evidence,actor_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[ctx.facility,ctx.employee,taskId,body.onboardingCycle,revision,date,body.eVerify,body.evidence.trim(),ctx.admin])
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'I9_HIRING_CONTEXT_RECORDED','payroll_onboarding_task',$3,$4)",[ctx.facility,ctx.admin,String(taskId),{employeeId:ctx.employee,onboardingCycle:body.onboardingCycle,revision,eVerify:body.eVerify,offerAcceptedOn:date}])
 return readI9HiringContext(db,ctx,taskId,body.onboardingCycle)
}
