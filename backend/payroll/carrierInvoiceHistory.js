const invalid=()=>Object.assign(new Error('Reload invoice evidence history with a valid cursor.'),{status:400})
const integer=value=>typeof value==='string'&&/^\d{1,19}$/.test(value)&&BigInt(value)<=9223372036854775807n
export async function carrierInvoiceHistory(db,facility,invoiceId,rawCursor){
 let cursor=null
 if(rawCursor!==undefined){
  try{
   if(typeof rawCursor!=='string'||!/^[A-Za-z0-9_-]{1,1500}$/.test(rawCursor))throw invalid()
   cursor=JSON.parse(Buffer.from(rawCursor,'base64url').toString())
   if(cursor.invoiceId!==invoiceId||![cursor.maxAssessmentId,cursor.maxCheckId,cursor.id].every(integer)||![1,2].includes(cursor.kind)||typeof cursor.at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursor.at)||!Number.isFinite(Date.parse(cursor.at))||cursor.at.startsWith('0000')||new Date(cursor.at).toISOString().slice(0,19)!==cursor.at.slice(0,19))throw invalid()
  }catch{throw invalid()}
 }
 const caps=cursor|| (await db.query(`SELECT
  COALESCE((SELECT max(id) FROM payroll_carrier_invoice_assessment WHERE invoice_id=$1 AND facility_id=$2),0)::text AS "maxAssessmentId",
  COALESCE((SELECT max(id) FROM payroll_carrier_invoice_check WHERE invoice_id=$1 AND facility_id=$2),0)::text AS "maxCheckId"`,[invoiceId,facility])).rows[0]
 const rows=(await db.query(`WITH events AS (
  SELECT id,1 AS kind,created_at AS sort_at,assessment,NULL::text AS message FROM payroll_carrier_invoice_assessment WHERE invoice_id=$1 AND facility_id=$2 AND id<=$3::bigint
  UNION ALL
  SELECT id,2 AS kind,checked_at AS sort_at,NULL::jsonb AS assessment,message FROM payroll_carrier_invoice_check WHERE invoice_id=$1 AND facility_id=$2 AND status='FAILED' AND id<=$4::bigint
 ) SELECT id::text,kind,to_char(sort_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "occurredAt",assessment,message
 FROM events WHERE ($5::timestamptz IS NULL OR (sort_at,kind,id)<($5::timestamptz,$6::integer,$7::bigint)) ORDER BY sort_at DESC,kind DESC,events.id DESC LIMIT 21`,[invoiceId,facility,caps.maxAssessmentId,caps.maxCheckId,cursor?.at||null,cursor?.kind||null,cursor?.id||null])).rows
 const page=rows.slice(0,20),last=page.at(-1)
 return {invoiceId,events:page,nextCursor:rows.length>20?Buffer.from(JSON.stringify({invoiceId,maxAssessmentId:caps.maxAssessmentId,maxCheckId:caps.maxCheckId,at:last.occurredAt,kind:last.kind,id:last.id})).toString('base64url'):null}
}
