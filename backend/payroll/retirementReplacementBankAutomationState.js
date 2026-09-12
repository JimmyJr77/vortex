export const replacementBankCandidates=`SELECT a.id,a.facility_id,a.auto_process,
 EXISTS(SELECT 1 FROM payroll_retirement_replacement_cancellation c WHERE c.authorization_id=a.id) AS cancelled,
 EXISTS(SELECT 1 FROM payroll_retirement_replacement_claim c WHERE c.authorization_id=a.id AND c.kind='BANK') AS claimed,
 (SELECT result->>'status'='REMOTE_FILE_VERIFIED' FROM payroll_retirement_replacement_observation WHERE authorization_id=a.id AND kind='ALLOCATION' ORDER BY id DESC LIMIT 1) AS file_ready,
 latest.created_at AS checked_at,latest.status
 FROM payroll_retirement_replacement_authorization a
 LEFT JOIN LATERAL(
 SELECT created_at,status FROM (
 SELECT created_at,CASE WHEN result->>'status'='COMPLETED' AND result->>'settlementStatus'='BANK_POSTED' THEN 'BANK_POSTED' ELSE result->>'status' END AS status FROM payroll_retirement_replacement_observation WHERE authorization_id=a.id AND kind='BANK'
 UNION ALL SELECT created_at,status FROM payroll_retirement_replacement_attempt WHERE authorization_id=a.id AND kind='BANK'
 UNION ALL SELECT created_at,'UNOBSERVED' AS status FROM payroll_retirement_replacement_claim WHERE authorization_id=a.id AND kind='BANK'
 ) evidence ORDER BY created_at DESC LIMIT 1
 ) latest ON true`
export function replacementBankDue(row,now){return !!row&&row.auto_process&&!row.cancelled&&(row.claimed||row.file_ready)&&(!row.checked_at||+new Date(row.checked_at)<=+new Date(now)-(row.status==='BANK_POSTED'?86400000:300000))}
