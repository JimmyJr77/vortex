export async function retirementDestinationAlert(db,facility,planId,status){
 const key=`retirement-destination-${planId}`
 if(status==='VERIFIED')await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,key])
 else await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Retirement destination needs attention',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,key,`Plan ${planId}: ${status.replaceAll('_',' ').toLowerCase()}. Open Employer setup to review the retirement destination. Contribution delivery remains unverified.`])
}
