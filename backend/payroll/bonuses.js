import {previewEarnedBonus} from './earnedBonusAllocation.js'
import {payrollEmploymentOverlaps} from './employmentPeriods.js'
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export function validateBonus(body){
 if(!Number.isSafeInteger(body.amountCents)||body.amountCents<=0)throw fail('Enter a positive bonus amount in whole cents.')
 if(!['DISCRETIONARY','NONDISCRETIONARY'].includes(body.classification))throw fail('Select the bonus regular-rate classification.')
 if(body.paymentType!=='ANNUAL_LUMP_SUM')throw fail('Select the annual lump-sum bonus payment type.')
 if(body.confirmed!==true||String(body.source||'').trim().length<20)throw fail('Verify bonus treatment and provide its evidence reference.')
 if(body.classification==='DISCRETIONARY'&&(body.amountDiscretionVerified!==true||body.paymentDiscretionVerified!==true||body.noPriorPromiseVerified!==true))throw fail('Verify discretion over both payment and amount, and that there was no prior promise or employee expectation.')
 if(body.classification==='NONDISCRETIONARY'&&(!validDate(body.earnedStart)||!validDate(body.earnedEnd)||body.earnedStart>body.earnedEnd||body.allocationMethod!=='PROPORTIONAL_EARNED_HOURS'||body.allocationMethodVerified!==true||!/^([a-f0-9]{64})$/.test(String(body.allocationFingerprint||''))))throw fail('Calculate the earned bonus using its earning dates and verify the proportional-hours agreement before recording it.')
 return {version:1,...(body.classification==='NONDISCRETIONARY'?{earnedStart:body.earnedStart,earnedEnd:body.earnedEnd,allocationMethod:body.allocationMethod,allocationMethodVerified:true,allocationFingerprint:body.allocationFingerprint}:{}),classification:body.classification,paymentType:body.paymentType,source:String(body.source).trim().slice(0,2000),amountDiscretionVerified:body.amountDiscretionVerified===true,paymentDiscretionVerified:body.paymentDiscretionVerified===true,noPriorPromiseVerified:body.noPriorPromiseVerified===true}
}
export function registerBonusRoutes(app,pool){
 app.post('/api/admin/payroll/employees/:id/bonuses',async(req,res)=>{
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId,b=req.body||{}
  try{
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const employee=(await db.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,req.params.id])).rows[0]
   if(!employee)throw fail('Employee not found.',404)
   const period=(await db.query("SELECT * FROM payroll_pay_period WHERE facility_id=$1 AND id=$2 AND status='OPEN'",[facility,b.payPeriodId])).rows[0]
   if(!period)throw fail('Select an open pay period for this bonus.',409)
   if((await db.query("SELECT id FROM payroll_run WHERE facility_id=$1 AND pay_period_id=$2 AND run_kind='REGULAR' AND status IN ('APPROVED','FINALIZED')",[facility,period.id])).rows.length)throw fail('This payroll is locked. Use a payroll correction for additional wages.',409)
   if(!await payrollEmploymentOverlaps(db,facility,employee.id,period.period_start,period.period_end))throw fail('Choose a payroll period that includes an eligible employment period. Activate the current hiring period first; later bonus-only payments require an off-cycle run.',409)
   const review=validateBonus(b)
   const requestKey=b.requestKey===undefined?null:String(b.requestKey)
   if(requestKey&&!/^[a-zA-Z0-9-]{16,80}$/.test(requestKey))throw fail('Use a valid bonus request reference.')
   if(requestKey){
    const existing=(await db.query('SELECT * FROM payroll_recurring_adjustment WHERE facility_id=$1 AND bonus_request_key=$2',[facility,requestKey])).rows[0]
    if(existing){
     if(Number(existing.employee_id)!==Number(employee.id)||Number(existing.bonus_pay_period_id)!==Number(period.id)||Number(existing.amount_cents)!==b.amountCents||existing.name!==String(b.name||'Annual bonus').trim().slice(0,160)||Object.entries(review).some(([key,value])=>existing.bonus_review?.[key]!==value))throw fail('This bonus request was already used with different details.',409)
     await db.query('COMMIT');return res.json({success:true,data:existing})
    }
   }
   if(review.classification==='NONDISCRETIONARY'){
    if(new Date(review.earnedEnd)>new Date(period.period_end))throw fail('The bonus earning period must end by the selected payroll period end.',409)
    const allocation=await previewEarnedBonus(db,facility,employee.id,b)
    if(allocation.fingerprint!==review.allocationFingerprint)throw fail('Bonus workweek inputs changed. Recalculate and review the allocation before recording the bonus.',409)
    review.allocation=allocation
   }
   review.verifiedAt=new Date().toISOString();review.verifiedBy=req.adminId
   const name=String(b.name||'Annual bonus').trim().slice(0,160)
   const row=(await db.query(`INSERT INTO payroll_recurring_adjustment(facility_id,employee_id,kind,name,amount_cents,active_from,active_to,status,authorization_reference,tax_treatment_verified,created_by,bonus_pay_period_id,bonus_review,bonus_request_key) VALUES($1,$2,'BONUS',$3,$4,$5,$6,'ACTIVE',$7,true,$8,$9,$10,$11) RETURNING *`,[facility,employee.id,name,b.amountCents,period.period_start,period.period_end,review.source,req.adminId,period.id,review,requestKey])).rows[0]
   await db.query(`INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'BONUS_REVIEWED','payroll_adjustment',$3,$4)`,[facility,req.adminId,String(row.id),row])
   await db.query('COMMIT');res.status(201).json({success:true,data:row})
  }catch(e){await db.query('ROLLBACK');res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to record bonus.'})}finally{db.release()}
 })
}
