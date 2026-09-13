export async function reconcileComplianceDueAlerts(pool,facilityId){
 return pool.query(`WITH active AS MATERIALIZED (
   SELECT 'due-task-'||id||'-'||COALESCE(due_date::text,'none') AS dedupe_key,
     severity,'Payroll task needs attention: '||title AS title,
     CASE WHEN due_date IS NULL THEN description ELSE description||' Due: '||due_date::text END AS message
   FROM payroll_compliance_task
   WHERE facility_id=$1 AND status NOT IN ('COMPLETE','NOT_APPLICABLE')
     AND (due_date IS NULL OR due_date <= CURRENT_DATE + 14)
 ), refreshed AS (
   INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message)
   SELECT $1,dedupe_key,severity,title,message FROM active
   ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET
     status='OPEN',severity=EXCLUDED.severity,title=EXCLUDED.title,message=EXCLUDED.message,
     dismissed_at=NULL,dismissed_by=NULL
   RETURNING id
 )
 UPDATE payroll_alert a SET status='DISMISSED',dismissed_at=now(),dismissed_by=NULL
 WHERE a.facility_id=$1 AND a.status='OPEN' AND a.dedupe_key LIKE 'due-task-%'
   AND NOT EXISTS(SELECT 1 FROM active WHERE active.dedupe_key=a.dedupe_key)`,[facilityId])
}
