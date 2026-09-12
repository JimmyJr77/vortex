import {payrollEmployeeAuth} from './employeeAuth.js'
import {retirementRemittanceSources} from './retirementRemittanceSources.js'
import {retirementReceiptBindingState} from './retirementReceiptBinding.js'
import {decryptDocument} from './onboarding.js'
const fields=['ordinaryPretaxCents','ordinaryRothCents','catchUpPretaxCents','catchUpRothCents','totalCents']
export async function employeeRetirementContributions(db,facility,employeeId,{beforeRunId=null,now=new Date()}={}){
 if(beforeRunId!==null&&(!/^[1-9]\d{0,18}$/.test(String(beforeRunId))||BigInt(beforeRunId)>9223372036854775807n))throw Object.assign(new Error('Choose a valid contribution history cursor.'),{status:400})
 const runs=(await db.query(`SELECT DISTINCT r.id FROM payroll_run r JOIN payroll_retirement_run_ledger l ON l.run_id=r.id AND l.facility_id=r.facility_id WHERE r.facility_id=$1 AND l.employee_id=$2 AND r.status='FINALIZED' AND ($3::bigint IS NULL OR r.id<$3) ORDER BY r.id DESC LIMIT 21`,[facility,employeeId,beforeRunId])).rows,items=[]
 for(const run of runs.slice(0,20)){
  const source=(await retirementRemittanceSources(db,facility,{runId:run.id,now})).items[0]
  if(!source||source.status==='RECONCILIATION_REQUIRED'){items.push({runId:String(run.id),status:'REVIEW_REQUIRED',contributions:[]});continue}
  const contributions=[]
  for(const a of source.allocations.filter(a=>String(a.employeeId)===String(employeeId))){
   const row={planName:a.planName,amountCents:a.totalCents,status:a.totalCents?'RECEIPT_UNVERIFIED':'NO_CONTRIBUTION',fundingStatus:'NO_RETURN_RECORDED',postedCents:null,reportedCents:null,providerRecordedAt:null,checkedAt:null}
   if(a.totalCents)try{
    const deliveries=(await db.query(`SELECT d.id,d.remittance_id,parent.basis FROM payroll_retirement_allocation_authorization d JOIN payroll_retirement_remittance_authorization parent ON parent.id=d.remittance_id WHERE d.facility_id=$1 AND parent.facility_id=$1 AND parent.run_id=$2 AND parent.plan_id=$3 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_allocation_cancellation c WHERE c.authorization_id=d.id) AND NOT EXISTS(SELECT 1 FROM payroll_retirement_remittance_cancellation c WHERE c.authorization_id=parent.id)`,[facility,run.id,a.planId])).rows
    if(deliveries.length>1)throw new Error('Ambiguous contribution delivery')
    if(deliveries.length){
     const d=deliveries[0],original=d.basis.allocations.filter(p=>String(p.employeeId)===String(employeeId))
     if(original.length!==1||fields.some(k=>original[0][k]!==a[k]))throw new Error('Contribution evidence changed')
     const binding=await retirementReceiptBindingState(db,facility,d.remittance_id,d.id),observation=(await db.query('SELECT id,binding_id,decision,summary,encrypted_result,created_at FROM payroll_retirement_receipt_observation WHERE facility_id=$1 AND allocation_id=$2 ORDER BY sequence DESC LIMIT 1',[facility,d.id])).rows[0]
     if(observation){
      row.checkedAt=new Date(observation.created_at).toISOString()
      if(binding.status!=='BOUND'||binding.history[0]?.id!==observation.binding_id||observation.decision!=='RECONCILED'||+new Date(now)-+new Date(observation.created_at)>86400000)throw new Error('Receipt requires renewed review')
      const result=JSON.parse(decryptDocument(observation.encrypted_result,`payroll-retirement-receipt:${facility}:${observation.id}:result`).toString()),participants=result.participants.filter(p=>String(p.employeeId)===String(employeeId))
      if(participants.length!==1||participants[0].authorizedCents!==a.totalCents)throw new Error('Participant receipt does not reconcile')
      const p=participants[0];row.status=p.status==='POSTED'?(p.fullyAccounted?'POSTED':'PARTIALLY_POSTED'):p.status;row.reportedCents=p.reported.totalCents;row.postedCents=p.status==='POSTED'?p.reported.totalCents:0;row.providerRecordedAt=p.recordedAt
     }
    }
   }catch{row.status='REVIEW_REQUIRED';row.postedCents=null;row.reportedCents=null;row.providerRecordedAt=null}
   if(a.totalCents){
    const returned=(await db.query("SELECT EXISTS(SELECT 1 FROM payroll_retirement_remittance_authorization p JOIN payroll_retirement_remittance_observation o ON o.authorization_id=p.id WHERE p.facility_id=$1 AND p.run_id=$2 AND p.plan_id=$3 AND o.result->>'status' IN ('RETURNED','REVERSED') AND EXISTS(SELECT 1 FROM jsonb_array_elements(p.basis->'allocations') x WHERE x->>'employeeId'=$4)) AS recorded",[facility,run.id,a.planId,String(employeeId)])).rows[0].recorded
    if(returned){row.fundingStatus='RETURN_REVIEW_REQUIRED';row.status='REVIEW_REQUIRED';row.postedCents=null;row.reportedCents=null;row.providerRecordedAt=null}
   }
   contributions.push(row)
  }
  items.push({runId:String(run.id),paymentDate:source.paymentDate,status:'RETAINED',contributions})
 }
 return {items,nextCursor:runs.length>20?String(runs[19].id):null}
}
export function registerEmployeeRetirementContributions(app,pool){
 app.get('/api/payroll/employee/retirement-contributions',payrollEmployeeAuth(pool),async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const data=await employeeRetirementContributions(db,req.payrollEmployee.facility_id,req.payrollEmployee.employee_id,{beforeRunId:req.query.beforeRunId??null});await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load your retirement contributions.'})}finally{db.release()}
 })
}
