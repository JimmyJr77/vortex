export async function updateCarrierPaymentAlert(db,facility,id,result,paymentDate,now=new Date()){
 const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]?.timezone||'America/New_York'
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
 const settled=result.settlementStatus==='BANK_POSTED',pending=['PROVIDER_APPROVED','PROCESSING','SENT','COMPLETED'].includes(result.status)
 const needsReview=!settled&&(!pending||paymentDate<today||result.dateMatches===false||['NEEDS_REVIEW','UNAVAILABLE','EXCEPTION'].includes(result.settlementStatus))
 const key=`carrier-payment-${id}`
 if(needsReview)await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Carrier payment needs attention','Open the invoice payment history in Reports & QuickBooks. Review provider approval, payment dates or recovery evidence. Keep the claimed amount reserved; recovery does not send another payment.') ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,key])
 else await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,key])
 return needsReview
}
