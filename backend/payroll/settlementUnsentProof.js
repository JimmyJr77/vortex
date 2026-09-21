// Load scoped immutable observations and retry claims under the employer lock.
// This proves no send only; current source checks and provider absence are separate.
export function settlementUnsentProof(observations, retries = []) {
 const reject = reason => ({canRetry:false, observationId:null, reason})
 if (!Array.isArray(observations) || !Array.isArray(retries) || !observations.length ||
     observations.some(o => !o || !/^[1-9][0-9]*$/.test(String(o.id)) || !['SUBMISSION','RECOVERY'].includes(o.source) ||
       o.create_attempted !== false || !['UNCERTAIN','BLOCKED_CONFIGURATION','NOT_FOUND'].includes(o.result?.status)) ||
     new Set(observations.map(o=>String(o.id))).size !== observations.length) {
  return reject('Every observation must retain explicit no-send evidence without a matched or conflicting journal.')
 }
 const submissions = observations.filter(o => o.source === 'SUBMISSION')
 const initial = submissions.filter(o => o.retry_id == null)
 if (initial.length !== 1 || observations.some(o => BigInt(o.id) < BigInt(initial[0].id))) {
  return reject('The original submission must have completed without sending before recovery or retries.')
 }
 if (retries.some(r => !r || typeof r.id !== 'string' || !r.id) || new Set(retries.map(r=>r.id)).size !== retries.length ||
     submissions.length !== retries.length + 1 || retries.some(r => submissions.filter(o=>o.retry_id===r.id).length !== 1) ||
     submissions.some(o => o.retry_id != null && !retries.some(r=>r.id===o.retry_id))) {
  return reject('Every retained retry must have its own completed no-send submission evidence.')
 }
 const latest = submissions.reduce((a,b) => BigInt(a.id) > BigInt(b.id) ? a : b)
 return {canRetry:true, observationId:String(latest.id), reason:null}
}
