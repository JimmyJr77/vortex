import {correctionPaymentPreview} from './correctionPaymentPreview.js'
import {correctionSettlementPlan} from './correctionSettlementPlan.js'
const fail=message=>Object.assign(new Error(message),{status:409})
export async function includeAuthorizedCorrections(db,facility,periodId,paymentDate,excludedRunId,loadBasePreview){
 const base=await loadBasePreview(db,facility,periodId,paymentDate,excludedRunId)
 if(!base)return null
 const rows=(await db.query(`SELECT latest.*,q.employee_id,q.status AS request_status,q.payload,q.kind FROM
  (SELECT DISTINCT ON(entity_id) id,entity_id,after_data FROM payroll_audit_log WHERE facility_id=$1 AND entity_type='employee_request' AND action='CORRECTION_PAYMENT_AUTHORIZED' ORDER BY entity_id,id DESC) latest
  JOIN payroll_employee_request q ON q.id::text=latest.entity_id AND q.facility_id=$1
  WHERE q.status='PENDING' AND latest.after_data->'input'->'payment'->>'payPeriodId'=$2`,[facility,String(periodId)])).rows
 if(!rows.length)return base
 const seen=new Set(),adjustments=[],leave=[],authorizations=[],time=[],settlements=[]
 for(const row of rows){
  if(row.kind!=='TIME_CORRECTION'||row.after_data.version!==1)throw fail('Reconcile the correction authorization type before payroll.')
  const employeeId=Number(row.employee_id)
  if(seen.has(employeeId))throw fail('Multiple corrections for one employee require a combined payment and leave review before payroll.')
  seen.add(employeeId)
  const input=row.after_data.input.payment
  if(input.paymentDate!==new Date(base.period.pay_date).toISOString().slice(0,10))throw fail('Use the payment date authorized for this correction or review a new authorization.')
  const request={id:Number(row.entity_id),facility_id:facility,employee_id:employeeId,status:row.request_status,payload:row.payload,kind:row.kind}
  const current=await correctionPaymentPreview(db,facility,request,input,loadBasePreview,excludedRunId)
  if(current.fingerprint!==row.after_data.preview.fingerprint)throw fail('The correction authorization is stale. Review current payroll, taxes and leave before rebuilding.')
  const item=current.payItems.find(p=>p.kind==='WAGE_CORRECTION'&&p.correction?.requestId===request.id)
  if(!item||item.amountCents!==current.priorWageCorrectionCents)throw fail('The authorized correction earning does not reconcile.')
  const evidence={authorizationId:Number(row.id),requestId:request.id,fingerprint:current.fingerprint}
  adjustments.push({...item,employeeId,taxTreatmentVerified:true,correction:{...item.correction,authorizationId:Number(row.id)}})
  leave.push({employeeId,calculationId:current.calculationId,fingerprint:current.calculationFingerprint,plan:current.correctionLeave})
  time.push({...request.payload,employeeId})
  authorizations.push({...evidence,employeeId})
  const original=request.payload.entryId?(await db.query('SELECT * FROM payroll_effective_time_entry WHERE facility_id=$1 AND employee_id=$2 AND id=$3',[facility,employeeId,request.payload.entryId])).rows[0]:null
  settlements.push({request,authorizationId:Number(row.id),preview:current,original})
 }
 const result=await loadBasePreview(db,facility,periodId,paymentDate,excludedRunId,false,time,adjustments,leave)
 for(const employee of result.preview.employees){
  employee.correctionAuthorizations=authorizations.filter(a=>a.employeeId===Number(employee.employeeId))
  employee.correctionSettlements=settlements.filter(s=>s.preview.employeeId===Number(employee.employeeId)).map(s=>correctionSettlementPlan({...s,employee}))
 }
 return result
}
