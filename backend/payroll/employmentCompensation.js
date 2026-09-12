// PostgreSQL JSONB reorders object keys when freezing a draft.
export const compensationEvidence=value=>Array.isArray(value)?value.map(compensationEvidence):value&&typeof value==='object'?Object.keys(value).sort().map(key=>[key,compensationEvidence(value[key])]):value

const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value||'').slice(0,10)
const previous=dayString=>new Date(Date.parse(`${dayString}T00:00:00Z`)-86400000).toISOString().slice(0,10)

// Keep compensation evidence tied to its hiring period. An old agreement must
// never silently become the opening agreement for a later hiring period.
export async function employmentCompensationAt(db,facility,period){
 const start=day(period.period_start),end=day(period.period_end)
 const employment=(await db.query(`SELECT h.*,e.hire_date AS current_hire_date,e.pay_type AS current_pay_type,
   e.hourly_rate_cents,e.annual_salary_cents,e.salary_review
   FROM payroll_employment_period h JOIN payroll_employee e ON e.id=h.employee_id AND e.facility_id=h.facility_id
   WHERE h.facility_id=$1 AND h.started_on<=$3 AND (h.ended_on IS NULL OR h.ended_on>=$2)
   AND (e.employment_status IN ('ACTIVE','LEAVE','TERMINATED') OR
     (e.employment_status='ONBOARDING' AND h.started_on<e.hire_date AND h.ended_on IS NOT NULL))
   ORDER BY h.employee_id,h.started_on`,[facility,start,end])).rows
 if(!employment.length)return []
 const ids=[...new Set(employment.map(e=>e.employee_id))]
 const [rates,salaries]=await Promise.all([
  db.query('SELECT * FROM payroll_pay_rate WHERE facility_id=$1 AND employee_id=ANY($2::bigint[]) AND cancelled_at IS NULL AND effective_on<=$3 ORDER BY effective_on,id',[facility,ids,end]),
  db.query('SELECT * FROM payroll_salary_change WHERE facility_id=$1 AND employee_id=ANY($2::bigint[]) AND cancelled_at IS NULL AND effective_on<=$3 ORDER BY effective_on,id',[facility,ids,end]),
 ])
 return employment.flatMap(e=>{
  const hire=day(e.started_on),from=hire>start?hire:start,to=e.ended_on&&day(e.ended_on)<end?day(e.ended_on):end
  const records=(e.pay_type==='HOURLY'?rates:salaries).rows.filter(r=>String(r.employee_id)===String(e.employee_id)&&day(r.effective_on)>=hire&&day(r.effective_on)<=to)
  const boundaries=[from,...new Set(records.map(r=>day(r.effective_on)).filter(d=>d>from))]
  return boundaries.map((effectiveFrom,index)=>{
   const record=records.filter(r=>day(r.effective_on)<=effectiveFrom).at(-1)
   const current=hire===day(e.current_hire_date)&&e.pay_type===e.current_pay_type
   // Only a current, never-dated salary review may live solely on the profile.
   // Hourly hiring always creates a dated rate through the application.
   const profileSalary=!record&&current&&e.pay_type==='SALARY'&&records.length===0&&e.salary_review
   const salaryReview=record?.salary_review||(profileSalary?e.salary_review:null)
   const hourlyRateCents=e.pay_type==='HOURLY'&&record?Number(record.hourly_rate_cents):null
   const annualSalaryCents=e.pay_type==='SALARY'?(record?Number(record.annual_salary_cents):profileSalary?Number(e.annual_salary_cents):null):null
   const missing=e.pay_type==='HOURLY'?!(Number.isSafeInteger(hourlyRateCents)&&hourlyRateCents>0):!(Number.isSafeInteger(annualSalaryCents)&&annualSalaryCents>0&&salaryReview)
   return {employeeId:Number(e.employee_id),employmentStart:hire,employmentEnd:e.ended_on?day(e.ended_on):null,
    start:effectiveFrom,end:index+1<boundaries.length?previous(boundaries[index+1]):to,payType:e.pay_type,
    hourlyRateCents,annualSalaryCents,salaryReview,source:record?'DATED_RECORD':profileSalary?'CURRENT_SALARY_REVIEW':'MISSING',sourceId:record?Number(record.id):null,
    ...(missing?{issue:'Retain the dated compensation agreement for this employment period before calculating payroll.'}:{}),
   }
  })
 })
}
