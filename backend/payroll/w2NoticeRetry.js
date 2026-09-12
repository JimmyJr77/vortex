const DAY=86400000
export function noticeRetryPolicy(prior,now=new Date()){
 if(!prior)return {attemptId:null,attemptCount:0,canAttempt:true,state:'FIRST_ATTEMPT',nextAttemptAt:null}
 const count=Number(prior.attempt_count),outcome=prior.outcome||'UNCERTAIN'
 if(outcome!=='NOT_SENT')return {attemptId:Number(prior.id),attemptCount:count,canAttempt:false,state:outcome,nextAttemptAt:null}
 const next=new Date(prior.retry_not_before||new Date(prior.recorded_at).getTime()+DAY)
 return {attemptId:Number(prior.id),attemptCount:count,canAttempt:count<3&&Number.isFinite(next.getTime())&&now.getTime()>=next.getTime(),state:count>=3?'EXHAUSTED':now.getTime()>=next.getTime()?'READY':'WAITING',nextAttemptAt:count>=3||!Number.isFinite(next.getTime())?null:next.toISOString()}
}
export async function readNoticeRetry(db,publicationId,now=new Date()){
 const prior=(await db.query(`SELECT a.id,count(*) OVER() AS attempt_count,r.outcome,r.created_at AS recorded_at,r.retry_not_before FROM payroll_w2_notice_attempt a JOIN payroll_w2_notice_job j ON j.id=a.job_id LEFT JOIN payroll_w2_notice_effective_result r ON r.attempt_id=a.id WHERE j.publication_id=$1 ORDER BY a.id DESC LIMIT 1`,[publicationId])).rows[0]
 return noticeRetryPolicy(prior,now)
}
export const nextNoticeRetry=(now,attemptNumber)=>new Date(now.getTime()+DAY*2**(attemptNumber-1)).toISOString()
