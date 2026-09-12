const DAY=86400000
const localDate=(value,timeZone)=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))
export function noticeReturnTarget(returnedAt,timeZone,now=new Date(),paper=null,retainedDueOn=null){
 const returnedOn=localDate(returnedAt,timeZone),dueOn=retainedDueOn||new Date(Date.parse(`${returnedOn}T00:00:00Z`)+30*DAY).toISOString().slice(0,10),today=localDate(now,timeZone)
 const resolvedOn=paper?.status==='PAPER_RECORDED'?localDate(paper.occurredAt,timeZone):null
 const daysRemaining=Math.round((Date.parse(`${dueOn}T00:00:00Z`)-Date.parse(`${today}T00:00:00Z`))/DAY)
 return {returnedOn,dueOn,timeZone,daysRemaining,resolvedOn,status:resolvedOn?resolvedOn<=dueOn?'RESOLVED_ON_TIME':'RESOLVED_LATE':daysRemaining<0?'OVERDUE':daysRemaining<=7?'DUE_SOON':'OPEN'}
}
export async function readNoticeReturnTarget(db,facility,publicationId,now,paper){
 const row=(await db.query(`SELECT r.returned_at,COALESCE(r.followup_timezone,s.timezone) AS timezone,r.followup_due_on::text AS due_on FROM payroll_w2_current_return r JOIN payroll_w2_notice_attempt a ON a.id=r.attempt_id JOIN payroll_w2_notice_job j ON j.id=a.job_id JOIN payroll_settings s ON s.facility_id=j.facility_id WHERE NOT r.is_retracted AND j.facility_id=$1 AND j.publication_id=$2 ORDER BY r.returned_at,r.id LIMIT 1`,[facility,publicationId])).rows[0]
 return row?noticeReturnTarget(row.returned_at,row.timezone,now,paper,row.due_on):null
}
