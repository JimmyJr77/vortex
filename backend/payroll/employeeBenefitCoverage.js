import {benefitCoverageLedger} from './benefitCoverageLedger.js'
import {payrollEmployeeAuth} from './employeeAuth.js'
export function employeeCoverageSummary(ledger,employeeId){
 return {month:ledger.month,rows:ledger.rows.filter(row=>row.employeeId===String(employeeId)).map(row=>({planId:row.planId,planName:row.planName,onboardingCycle:row.onboardingCycle,status:row.status==='REVIEWED'?row.current.review.disposition:'NEEDS_REVIEW',reviewedAt:row.current?.created_at||null,carrier:row.status==='REVIEWED'?row.current.review.carrier:null,coverageStart:row.status==='REVIEWED'?row.current.review.coverageStart:null,coverageEnd:row.status==='REVIEWED'?row.current.review.coverageEnd:null}))}
}
export function registerEmployeeBenefitCoverage(app,pool){
 app.get('/api/payroll/employee/benefit-coverage',payrollEmployeeAuth(pool),async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
   const session=req.payrollEmployee,ledger=await benefitCoverageLedger(db,session.facility_id,req.query.month)
   const data=employeeCoverageSummary(ledger,session.employee_id)
   await db.query('COMMIT');res.json({success:true,data})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load your monthly benefit coverage.'})}finally{db.release()}
 })
}
