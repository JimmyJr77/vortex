export async function currentCheckStopAttempt(db,stopId){
 const retry=(await db.query('SELECT * FROM payroll_check_stop_retry WHERE stop_id=$1 ORDER BY sequence DESC LIMIT 1',[stopId])).rows[0]
 const priorActions=(await db.query('SELECT prior_action_id FROM payroll_check_stop_retry WHERE stop_id=$1 ORDER BY sequence',[stopId])).rows.map(row=>row.prior_action_id).filter(Boolean)
 return {retryId:retry?.id||null,id:retry?.id||stopId,priorActions,actionId:(await db.query('SELECT payroll_check_stop_current_action($1) AS id',[stopId])).rows[0].id}
}
