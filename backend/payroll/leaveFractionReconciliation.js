import {legacyLeaveFraction} from './leaveRemainder.js'
import {createHash} from 'node:crypto'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export function fractionRecovery(rows,checkpoint=null){
 let remainder=checkpoint?.remainder??0,start=checkpoint?rows.findIndex(r=>String(r.id)===String(checkpoint.through_run_id))+1:0
 if(checkpoint&&start===0)throw fail('The prior fraction reconciliation no longer matches finalized payroll.')
 for(let i=start;i<rows.length;i++)if(rows[i].statement_snapshot?.sickLeaveFraction?.version===1){
  remainder=rows[i].statement_snapshot.sickLeaveFraction.remainderAfter;start=i+1
 }
 if(!Number.isInteger(remainder)||remainder<0||remainder>=30)throw fail('The prior fraction checkpoint is invalid.')
 const reviewed=rows.slice(start),items=[]
 for(const row of reviewed){
  const worked=Number(row.regular_minutes)+Number(row.overtime_minutes),accrued=Number(row.sick_leave_accrual_minutes)
  if(!Number.isSafeInteger(worked)||worked<0||!Number.isSafeInteger(accrued)||accrued<0)throw fail('Reconcile invalid historical worked or accrued minutes first.')
  const fraction=legacyLeaveFraction(row)
  remainder+=fraction;items.push({runId:String(row.id),workedMinutes:worked,accruedMinutes:accrued,recoveredThirtieths:fraction})
 }
 if(!items.length||!items.some(i=>i.recoveredThirtieths))throw fail('No untracked fractional accrual remains to reconcile.')
 return {items,creditMinutes:Math.floor(remainder/30),remainder:remainder%30,throughRunId:String(reviewed.at(-1).id)}
}
export function registerLeaveFractionRoutes(app,pool){
 for(const [path,save] of [['preview',false],['apply',true]])app.post(`/api/admin/payroll/employees/:id/leave-fractions/${path}`,async(req,res)=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId,employee=req.params.id,body=req.body||{}
  try{
   await db.query('BEGIN')
   const settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   if(!settings)throw fail('Employer settings not found.',404)
   if(!(await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employee])).rows.length)throw fail('Employee not found.',404)
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
   const rows=(await db.query(`SELECT r.id,re.regular_minutes,re.overtime_minutes,re.sick_leave_accrual_minutes,re.statement_snapshot FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id JOIN payroll_pay_period p ON p.id=r.pay_period_id
    WHERE r.facility_id=$1 AND re.employee_id=$2 AND r.run_kind='REGULAR' AND r.status='FINALIZED' AND COALESCE(r.payment_date,p.pay_date)<=$3::date ORDER BY COALESCE(r.payment_date,p.pay_date),p.period_end,r.id`,[facility,employee,today])).rows
   const checkpoint=(await db.query('SELECT * FROM payroll_leave_fraction_reconciliation WHERE facility_id=$1 AND employee_id=$2 ORDER BY id DESC LIMIT 1',[facility,employee])).rows[0]||null
   const plan=fractionRecovery(rows,checkpoint),previewToken=createHash('sha256').update(JSON.stringify({rows,checkpoint,plan,today})).digest('hex')
   if(save){
    if(body.confirmed!==true||String(body.source||'').trim().length<12)throw fail('Confirm the historical review and provide its source reference.',400)
    if(body.previewToken!==previewToken)throw fail('Historical payroll changed. Preview the reconciliation again.')
    if(plan.creditMinutes)await db.query(`INSERT INTO payroll_leave_transaction(facility_id,employee_id,transaction_date,minutes,reason,transaction_kind,created_by) VALUES($1,$2,$3,$4,'Historical sick-leave fraction recovery','RESTORATION',$5)`,[facility,employee,today,plan.creditMinutes,req.adminId])
    const saved=(await db.query('INSERT INTO payroll_leave_fraction_reconciliation(facility_id,employee_id,through_run_id,effective_on,credited_minutes,remainder,source,history_snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[facility,employee,plan.throughRunId,today,plan.creditMinutes,plan.remainder,String(body.source).trim().slice(0,2000),JSON.stringify(plan.items),req.adminId])).rows[0]
    await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'LEAVE_FRACTIONS_RECONCILED','leave_fraction_reconciliation',$3,$4)`,[facility,req.adminId,String(saved.id),{...plan,source:String(body.source).trim().slice(0,2000),effectiveOn:today}])
   }
   await db.query('COMMIT');res.json({success:true,data:{...plan,previewToken,effectiveOn:today,saved:save}})
  }catch(e){await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to reconcile historical leave fractions.'})}finally{db.release()}
 })
}
