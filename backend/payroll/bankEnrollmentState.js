export function enrollmentCompletionState(progress,now=Date.now()){
 const start=progress.rows.find(r=>r.stage==='START'),expiresAt=start?new Date(new Date(start.created_at).getTime()+56*86400000).toISOString():null
 const reason=progress.status==='VERIFIED'?null:progress.attempts>=5?'ATTEMPT_LIMIT':expiresAt&&Date.parse(expiresAt)<=now?'EXPIRED':null
 return {verificationStarted:!!start,expiresAt,completionBlockedReason:reason,completionAllowed:!!start&&progress.status==='AWAITING_AMOUNTS'&&!reason}
}
