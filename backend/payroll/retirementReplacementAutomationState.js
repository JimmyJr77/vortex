export const replacementAllocationCandidates=`SELECT a.id,a.facility_id,a.auto_process,
 EXISTS(SELECT 1 FROM payroll_retirement_replacement_cancellation c WHERE c.authorization_id=a.id) AS cancelled,
 latest.created_at AS checked_at,latest.status
 FROM payroll_retirement_replacement_authorization a
 LEFT JOIN LATERAL(
 SELECT created_at,status FROM (
 SELECT created_at,result->>'status' AS status FROM payroll_retirement_replacement_observation WHERE authorization_id=a.id AND kind='ALLOCATION'
 UNION ALL SELECT created_at,status FROM payroll_retirement_replacement_attempt WHERE authorization_id=a.id AND kind='ALLOCATION'
 UNION ALL SELECT created_at,'UNOBSERVED' AS status FROM payroll_retirement_replacement_claim WHERE authorization_id=a.id AND kind='ALLOCATION'
 ) evidence ORDER BY created_at DESC LIMIT 1
 ) latest ON true`
export function replacementAllocationDue(row,now){return !!row&&row.auto_process&&!row.cancelled&&(!row.checked_at||+new Date(row.checked_at)<=+new Date(now)-(row.status==='REMOTE_FILE_VERIFIED'?86400000:300000))}
