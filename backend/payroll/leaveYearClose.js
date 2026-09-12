import {createHash} from 'node:crypto'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export function leaveYearOpening({balance,policy,carryCapMinutes,frontloadMinutes}){
 if(!Number.isSafeInteger(balance)||balance<0)throw fail('Reconcile negative or invalid leave balances before closing the year.')
 if(!Number.isSafeInteger(carryCapMinutes)||carryCapMinutes<2400||carryCapMinutes>3840||!Number.isSafeInteger(frontloadMinutes)||frontloadMinutes<2400||frontloadMinutes>3840)throw fail('Use a carryover and frontload allowance between 40 and 64 hours.',400)
 if(policy==='FRONTLOAD')return {carryMinutes:0,rolloverDelta:-balance,grantMinutes:frontloadMinutes,openingBalance:frontloadMinutes}
 if(policy!=='ACCRUAL')throw fail('Review exempt or unsupported leave policies before closing the year.')
 const carryMinutes=Math.min(balance,carryCapMinutes)
 return {carryMinutes,rolloverDelta:carryMinutes-balance,grantMinutes:0,openingBalance:carryMinutes}
}
export async function leaveYearClosePlan(db,facility,settings,body,now=new Date()){
 const year=Number(body.year),today=new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
 if(!Number.isInteger(year)||year<2001||year>Number(today.slice(0,4)))throw fail('Choose an opening year that has already started.',400)
 const start=`${year}-01-01`,policy={carryCapMinutes:body.carryCapMinutes??2400,frontloadMinutes:body.frontloadMinutes??2400}
 leaveYearOpening({balance:0,policy:'ACCRUAL',...policy})
 if((await db.query('SELECT id FROM payroll_leave_year_close WHERE facility_id=$1 AND opening_year=$2',[facility,year])).rows.length)throw fail('This leave year has already been opened.')
 const used=(await db.query(`SELECT EXISTS(SELECT 1 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1
  AND ((COALESCE(r.payment_date,p.pay_date)<$2::date AND r.status NOT IN ('FINALIZED','VOID')) OR (COALESCE(r.payment_date,p.pay_date)>=$2::date AND r.status IN ('APPROVED','FINALIZED')))) AS used`,[facility,start])).rows[0].used
 if(used)throw fail('Finalize or void earlier drafts and complete rollover before approving payroll in the new leave year.')
 const laterClose=(await db.query('SELECT id FROM payroll_leave_year_close WHERE facility_id=$1 AND opening_year>$2 LIMIT 1',[facility,year])).rows.length
 if(laterClose)throw fail('A later leave year is already closed. Use a documented current-year correction.')
 const employees=(await db.query(`SELECT e.id,e.legal_first_name,e.legal_last_name,e.sick_leave_policy,e.employment_status,
  EXISTS(SELECT 1 FROM payroll_employment_period ep WHERE ep.facility_id=e.facility_id AND ep.employee_id=e.id AND ep.started_on<=$2::date AND (ep.ended_on IS NULL OR ep.ended_on>=$2::date)) AS employed_at_opening,
  COALESCE(SUM(l.minutes),0)::int AS balance FROM payroll_employee e LEFT JOIN payroll_leave_transaction l ON l.employee_id=e.id AND l.facility_id=e.facility_id AND l.leave_type='MD_SICK_SAFE' AND l.transaction_date<$2::date
  WHERE e.facility_id=$1 AND EXISTS(SELECT 1 FROM payroll_employment_period ep WHERE ep.facility_id=e.facility_id AND ep.employee_id=e.id AND ep.started_on<=$2::date) GROUP BY e.id ORDER BY e.id`,[facility,start])).rows
 const rows=employees.map(e=>({...e,...(!e.employed_at_opening?{carryMinutes:e.balance,rolloverDelta:0,grantMinutes:0,openingBalance:e.balance}:leaveYearOpening({balance:e.balance,policy:e.sick_leave_policy,...policy}))}))
 const existing=(await db.query("SELECT id FROM payroll_leave_transaction WHERE facility_id=$1 AND leave_type='MD_SICK_SAFE' AND transaction_date>=$2::date AND transaction_date<($2::date+interval '1 year') AND transaction_kind IN ('FRONTLOAD','ROLLOVER')",[facility,start])).rows
 if(existing.length)throw fail('The new year already contains a frontload or rollover entry. Reconcile it before applying an annual opening.')
 const laterLedger=(await db.query("SELECT employee_id,transaction_date::text,SUM(minutes)::int AS minutes FROM payroll_leave_transaction WHERE facility_id=$1 AND leave_type='MD_SICK_SAFE' AND transaction_date>=$2::date GROUP BY employee_id,transaction_date ORDER BY employee_id,transaction_date",[facility,start])).rows
 for(const e of rows){
  let available=e.openingBalance
  for(const entry of laterLedger.filter(l=>Number(l.employee_id)===Number(e.id))){available+=entry.minutes;if(available<0)throw fail(`Rollover would leave ${e.legal_first_name} ${e.legal_last_name} short of used or reserved leave on ${entry.transaction_date}. Reconcile those records first.`)}
 }
 const token=createHash('sha256').update(JSON.stringify({year,policy,rows,laterLedger})).digest('hex')
 return {year,start,policy,employees:rows,previewToken:token}
}
// Caller holds employer settings lock inside a transaction.
export async function applyLeaveYearPlan(db,facility,plan,source,actor=null){
    for(const e of plan.employees){
     if(e.rolloverDelta)await db.query(`INSERT INTO payroll_leave_transaction(facility_id,employee_id,transaction_date,minutes,reason,transaction_kind,created_by) VALUES($1,$2,$3,$4,$5,'ROLLOVER',$6)`,[facility,e.id,plan.start,e.rolloverDelta,`Annual leave opening ${plan.year}: carryover policy`,actor])
     if(e.grantMinutes)await db.query(`INSERT INTO payroll_leave_transaction(facility_id,employee_id,transaction_date,minutes,reason,transaction_kind,created_by) VALUES($1,$2,$3,$4,$5,'FRONTLOAD',$6)`,[facility,e.id,plan.start,e.grantMinutes,`Annual leave opening ${plan.year}: frontloaded grant`,actor])
    }
    const saved=(await db.query('INSERT INTO payroll_leave_year_close(facility_id,opening_year,policy_snapshot,employee_snapshot,source,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[facility,plan.year,plan.policy,JSON.stringify(plan.employees),source,actor])).rows[0]
    await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'LEAVE_YEAR_OPENED','leave_year',$3,$4)`,[facility,actor,String(saved.id),{year:plan.year,policy:plan.policy,employees:plan.employees,source:source}])
}
export function registerLeaveYearCloseRoutes(app,pool){
 for(const [path,save] of [['preview',false],['apply',true]])app.post(`/api/admin/payroll/leave-year/${path}`,async(req,res)=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId,body=req.body||{}
  try{
   await db.query('BEGIN')
   const settings=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])).rows[0]
   if(!settings)throw fail('Employer settings not found.',404)
   const plan=await leaveYearClosePlan(db,facility,settings,body)
   if(save){
    if(body.confirmed!==true||String(body.source||'').trim().length<12)throw fail('Confirm the published carryover/frontload policy and provide its reference.',400)
    if(body.previewToken!==plan.previewToken)throw fail('Leave balances or policies changed. Preview the opening again.')
    await applyLeaveYearPlan(db,facility,plan,String(body.source).trim().slice(0,2000),req.adminId)
   }
   await db.query('COMMIT');res.json({success:true,data:{...plan,saved:save}})
  }catch(error){await db.query('ROLLBACK');res.status(error.status||500).json({success:false,message:error.status?error.message:'Unable to open leave year.'})}finally{db.release()}
 })
}
